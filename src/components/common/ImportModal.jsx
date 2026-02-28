/**
 * Import Modal Component
 * For importing new documents via text paste
 * Enhanced with Bridge Server cache detection
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { parseFile, cleanTextPreserveParagraphs } from '../../utils/fileParser';
import { getLLMConfig, saveLLMConfig } from '../../services/llmClient';
import { hashText } from '../../utils/hash';
import { checkBridgeCache, importFromBridge, isBridgeAvailable } from '../../services/cacheBridgeService';
import { getAnalysisCache } from '../../db/schema';
import ThinkingProcess from './ThinkingProcess';
import styles from './ImportModal.module.css';

export default function ImportModal({
    isOpen,
    onClose,
    onImport,
    isLoading,
    processingLogs,
    processingStep,
    processingMeta,
    processingSteps,
    summaryDraft,
    summaryNotice,
    summaryError,
    onSummaryChange,
    onSummaryConfirm,
    onSummaryCancel,
    onSummaryRegenerate
}) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [error, setError] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [parseProgress, setParseProgress] = useState({});
    const [autoCleaned, setAutoCleaned] = useState(false);
    const [autoCleanOriginal, setAutoCleanOriginal] = useState('');
    const [autoCleanEnabled, setAutoCleanEnabled] = useState(true);
    const [aiFormatEnabled, setAiFormatEnabled] = useState(true);
    const [parseStartedAt, setParseStartedAt] = useState(0);
    const [parseMetrics, setParseMetrics] = useState(null);
    const [llmConfig, setLlmConfig] = useState(() => getLLMConfig());
    // Bridge cache detection state
    const [bridgeCache, setBridgeCache] = useState(null); // { source: 'local'|'bridge', data: {...} }
    const [bridgeChecking, setBridgeChecking] = useState(false);
    const [bridgeAvailable, setBridgeAvailable] = useState(false);

    const fileInputRef = useRef(null);
    const cacheCheckTimer = useRef(null);

    // Sync LLM config and check Bridge availability when modal opens
    useEffect(() => {
        if (isOpen) {
            setLlmConfig(getLLMConfig());
            isBridgeAvailable().then(setBridgeAvailable);
        }
    }, [isOpen]);

    // Check for ?bridgeHash URL parameter (CLI-triggered import)
    useEffect(() => {
        if (!isOpen) return;
        const params = new URLSearchParams(window.location.search);
        const bridgeHash = params.get('bridgeHash');
        if (bridgeHash) {
            // Remove param from URL
            const url = new URL(window.location);
            url.searchParams.delete('bridgeHash');
            window.history.replaceState({}, '', url);
            // Load from Bridge
            loadBridgeByHash(bridgeHash);
        }
    }, [isOpen]);

    // Debounced cache check when content changes
    const checkContentCache = useCallback(async (text) => {
        if (!text || text.trim().length < 50) {
            setBridgeCache(null);
            return;
        }
        setBridgeChecking(true);
        try {
            const hash = await hashText(text.trim());
            // 1. Check local analysisCache
            const local = await getAnalysisCache(hash);
            if (local) {
                setBridgeCache({ source: 'local', data: local, hash });
                setBridgeChecking(false);
                return;
            }
            // 2. Check Bridge Server
            if (bridgeAvailable) {
                const remote = await checkBridgeCache(hash);
                if (remote) {
                    setBridgeCache({ source: 'bridge', data: remote, hash });
                    setBridgeChecking(false);
                    return;
                }
            }
            setBridgeCache(null);
        } catch {
            setBridgeCache(null);
        } finally {
            setBridgeChecking(false);
        }
    }, [bridgeAvailable]);

    // Trigger debounced cache check when content changes
    useEffect(() => {
        if (cacheCheckTimer.current) clearTimeout(cacheCheckTimer.current);
        cacheCheckTimer.current = setTimeout(() => checkContentCache(content), 800);
        return () => clearTimeout(cacheCheckTimer.current);
    }, [content, checkContentCache]);

    // Load content from Bridge by hash
    async function loadBridgeByHash(hash) {
        setBridgeChecking(true);
        try {
            const data = await importFromBridge(hash);
            if (data) {
                setBridgeCache({ source: 'bridge', data, hash });
                if (data.title) setTitle(data.title);
            }
        } catch {
            // Silently fail
        } finally {
            setBridgeChecking(false);
        }
    }

    // Handle "Load Cache" action
    function handleLoadCache() {
        if (!bridgeCache?.data) return;
        const { data, hash } = bridgeCache;
        onImport({
            title: title.trim() || data.title || 'Untitled',
            content: content.trim(),
            parseMetrics,
            aiFormatEnabled,
            cachedAnalysis: {
                hash,
                coreThesis: data.coreThesis || '',
                summary: data.summary || '',
                model: data.model || '',
                chunks: data.chunks || []
            }
        });
    }

    const handleLlmFieldChange = (e) => {
        const { name, value } = e.target;
        const updated = { ...llmConfig, [name]: value };
        setLlmConfig(updated);
        saveLLMConfig(updated);
    };

    const handleProviderSwitch = (e) => {
        const provider = e.target.value;
        let updated = { ...llmConfig, provider };

        if (provider === 'deepseek' && (!updated.baseUrl || updated.baseUrl.includes('localhost'))) {
            updated.baseUrl = 'https://api.deepseek.com';
            updated.model = 'deepseek-chat';
        } else if (provider === 'ollama' && (!updated.baseUrl || !updated.baseUrl.includes('localhost'))) {
            updated.baseUrl = 'http://localhost:11434';
            updated.model = 'llama3.1:latest';
        }

        setLlmConfig(updated);
        saveLLMConfig(updated);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            await processFile(file);
        }
    };

    const handleCleanText = () => {
        if (!content) return;
        const cleaned = cleanTextPreserveParagraphs(content);

        setContent(cleaned);
        setAutoCleaned(false);
        setAutoCleanOriginal('');
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            await processFile(file);
        }
    };

    const clearSelectedFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!title.trim()) {
            setError('Please enter a title');
            return;
        }

        if (!content.trim()) {
            setError('Please paste some content or upload a file');
            return;
        }

        if (content.split(/\s+/).length < 50) {
            setError('Content should be at least 50 words for meaningful chunking');
            return;
        }

        onImport({ title: title.trim(), content: content.trim(), parseMetrics, aiFormatEnabled });
    };

    const handleClose = () => {
        setTitle('');
        setContent('');
        setError('');
        setSelectedFile(null);
        setParseProgress({});
        setAutoCleaned(false);
        setAutoCleanOriginal('');
        setAutoCleanEnabled(true);
        setAiFormatEnabled(true);
        setParseStartedAt(0);
        setParseMetrics(null);
        setBridgeCache(null);
        setBridgeChecking(false);
        onClose();
    };

    const formatMs = (ms) => {
        if (ms == null) return '';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const formatParseError = (file, err) => {
        const extension = file?.name?.split('.').pop()?.toLowerCase() || '';
        const base = err?.message ? ` (${err.message})` : '';

        if (extension === 'pdf') {
            return `PDF 解析失败。可能是扫描版或加密文件，请尝试导出为文本后再导入${base}`;
        }
        if (extension === 'docx') {
            return `DOCX 解析失败。文件可能受保护或损坏，请另存为 .docx 或 .txt 后重试${base}`;
        }
        if (extension === 'txt') {
            return `文本读取失败。请确认编码为 UTF-8 或重新另存为 .txt${base}`;
        }
        return `文件解析失败，请尝试转换格式后再导入${base}`;
    };

    const processFile = async (file) => {
        const existingContent = content;
        const hasExistingContent = Boolean(existingContent.trim());

        setIsParsing(true);
        setError('');
        setParseProgress({ message: 'Preparing to read file...' });
        setAutoCleaned(false);
        setAutoCleanOriginal('');
        setParseStartedAt(Date.now());
        setParseMetrics(null);
        try {
            const result = await parseFile(file, {
                onProgress: (progress) => setParseProgress(progress || {}),
                autoClean: autoCleanEnabled
            });
            if (!title) {
                setTitle(result.title);
            }

            // Smart append/replace logic
            let didAppend = false;
            if (hasExistingContent) {
                const shouldAppend = window.confirm(
                    'Content field is not empty. Do you want to APPEND the new file content? \n(Cancel will REPLACE existing content)'
                );

                if (shouldAppend) {
                    didAppend = true;
                    setContent(prev => prev + '\n\n' + result.content);
                } else {
                    setContent(result.content);
                }
            } else {
                setContent(result.content);
            }

            setSelectedFile(file);
            if (result.cleaned) {
                const rawContent = result.rawContent || result.content;
                setAutoCleaned(true);
                setAutoCleanOriginal(didAppend ? `${existingContent}\n\n${rawContent}` : rawContent);
            } else {
                setAutoCleaned(false);
                setAutoCleanOriginal('');
            }
            setParseMetrics({
                parseMs: result.parseMs ?? 0,
                cleanMs: result.cleanMs ?? 0
            });
        } catch (err) {
            console.error('File parsing error:', err);
            setError(formatParseError(file, err));
        } finally {
            setIsParsing(false);
        }
    };

    if (!isOpen) return null;
    const isSummaryReview = Boolean(summaryDraft);

    return (
        <div className="overlay" onClick={handleClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <header className={styles.header}>
                    <h2>Import New Document</h2>
                    <button
                        className={`btn btn-ghost ${styles.closeBtn}`}
                        onClick={handleClose}
                    >
                        ✕
                    </button>
                </header>

                {isLoading ? (
                    <div className={styles.thinkingContainer}>
                        <ThinkingProcess
                            logs={processingLogs}
                            currentStep={processingStep}
                            meta={processingMeta}
                            steps={processingSteps}
                        />
                    </div>
                ) : isSummaryReview ? (
                    <div className={styles.summaryContainer}>
                        <header className={styles.summaryHeader}>
                            <h2>Review Summary</h2>
                            <p className={styles.summaryHint}>
                                Please keep the <strong>THESIS</strong> and <strong>OUTLINE</strong> headings.
                            </p>
                            {summaryNotice && (
                                <p className={styles.summaryNotice}>{summaryNotice}</p>
                            )}
                            {summaryError && (
                                <p className={styles.summaryError}>{summaryError}</p>
                            )}
                        </header>
                        <textarea
                            className={styles.summaryTextarea}
                            value={summaryDraft}
                            onChange={(e) => onSummaryChange?.(e.target.value)}
                            rows={10}
                        />
                        <div className={styles.summaryActions}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={onSummaryCancel}
                            >
                                Back to Edit
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={onSummaryRegenerate}
                            >
                                Regenerate Summary
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => onSummaryConfirm?.(summaryDraft)}
                            >
                                Continue to Chunking
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.field}>
                            <label>Document Source</label>
                            <div
                                className={`${styles.dropZone} ${isDragging ? styles.dragging : ''} ${selectedFile ? styles.hasFile : ''}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".pdf,.docx,.txt"
                                    className={styles.hiddenInput}
                                />
                                {isParsing ? (
                                    <div className={styles.parsingState}>
                                        <span className="spinner" />
                                        <p>{parseProgress.message || 'Extracting text from file...'}</p>
                                        {parseProgress.current && parseProgress.total ? (
                                            <span className={styles.parseHint}>
                                                {Math.round((parseProgress.current / parseProgress.total) * 100)}% · {parseProgress.current}/{parseProgress.total}
                                                {parseStartedAt && parseProgress.current > 0 ? (() => {
                                                    const elapsed = Date.now() - parseStartedAt;
                                                    const remaining = Math.max(0, Math.round((elapsed / parseProgress.current) * (parseProgress.total - parseProgress.current) / 1000));
                                                    return remaining > 0 ? ` · ~${remaining}s` : '';
                                                })() : ''}
                                            </span>
                                        ) : null}
                                    </div>
                                ) : selectedFile ? (
                                    <div className={styles.fileInfo}>
                                        <span className={styles.fileIcon}>📄</span>
                                        <div className={styles.fileDetails}>
                                            <span className={styles.fileName}>{selectedFile.name}</span>
                                            <span className={styles.fileSize}>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                                        </div>
                                        <button
                                            type="button"
                                            className={styles.clearBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                clearSelectedFile();
                                            }}
                                            title="Clear file"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ) : (
                                    <div className={styles.dropPrompt}>
                                        <span className={styles.uploadIcon}>📁</span>
                                        <p>Click or drag PDF, DOCX, or TXT here</p>
                                    </div>
                                )}
                            </div>
                            {selectedFile && !isParsing && parseMetrics ? (
                                <div className={styles.parseMetrics}>
                                    解析耗时 {formatMs(parseMetrics.parseMs)} · 清洗耗时 {formatMs(parseMetrics.cleanMs)}
                                </div>
                            ) : null}
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="title">Document Title</label>
                            <input
                                id="title"
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g., The Art of Deep Work"
                                className={styles.input}
                                disabled={isLoading || isParsing}
                            />
                        </div>

                        {/* AI Settings - collapsible */}
                        <details
                            className={styles.llmSettings}
                            open={llmConfig.provider !== 'ollama' && !llmConfig.apiKey}
                        >
                            <summary className={styles.llmSettingsSummary}>
                                ⚙️ AI Settings
                                <span className={styles.llmProvider}>
                                    {llmConfig.provider === 'ollama' ? 'Ollama (Local)' : 'DeepSeek (Cloud)'}
                                </span>
                            </summary>
                            <div className={styles.llmSettingsGrid}>
                                <div className={styles.llmField}>
                                    <label>Provider</label>
                                    <select
                                        name="provider"
                                        value={llmConfig.provider}
                                        onChange={handleProviderSwitch}
                                        className={styles.input}
                                        disabled={isLoading || isParsing}
                                    >
                                        <option value="deepseek">DeepSeek (Cloud)</option>
                                        <option value="ollama">Ollama (Local)</option>
                                    </select>
                                </div>
                                <div className={styles.llmField}>
                                    <label>Model</label>
                                    <input
                                        type="text"
                                        name="model"
                                        value={llmConfig.model}
                                        onChange={handleLlmFieldChange}
                                        placeholder="e.g. deepseek-chat"
                                        className={styles.input}
                                        disabled={isLoading || isParsing}
                                    />
                                </div>
                                <div className={`${styles.llmField} ${styles.llmFieldFull}`}>
                                    <label>Base URL</label>
                                    <input
                                        type="text"
                                        name="baseUrl"
                                        value={llmConfig.baseUrl}
                                        onChange={handleLlmFieldChange}
                                        placeholder="e.g. https://api.deepseek.com"
                                        className={styles.input}
                                        disabled={isLoading || isParsing}
                                    />
                                </div>
                                {llmConfig.provider !== 'ollama' && (
                                    <div className={`${styles.llmField} ${styles.llmFieldFull}`}>
                                        <label>API Key</label>
                                        <input
                                            type="password"
                                            name="apiKey"
                                            value={llmConfig.apiKey}
                                            onChange={handleLlmFieldChange}
                                            placeholder="Enter your API key"
                                            className={styles.input}
                                            disabled={isLoading || isParsing}
                                        />
                                    </div>
                                )}
                            </div>
                        </details>

                        <div className={styles.field}>
                            <div className={styles.labelRow}>
                                <label htmlFor="content">Content Preview</label>
                                <div className={styles.cleanControls}>
                                    <label className={styles.toggle}>
                                        <input
                                            type="checkbox"
                                            checked={autoCleanEnabled}
                                            onChange={(e) => setAutoCleanEnabled(e.target.checked)}
                                            disabled={isParsing || isLoading}
                                        />
                                        <span>Auto-clean on import</span>
                                    </label>
                                    <label className={styles.toggle} title="AI will remove page artifacts and format text into clean paragraphs">
                                        <input
                                            type="checkbox"
                                            checked={aiFormatEnabled}
                                            onChange={(e) => setAiFormatEnabled(e.target.checked)}
                                            disabled={isParsing || isLoading}
                                        />
                                        <span>🤖 AI Format</span>
                                    </label>
                                    {content && (
                                        <button
                                            type="button"
                                            onClick={handleCleanText}
                                            className={styles.textActionBtn}
                                            title="Fix broken lines (keep paragraphs)"
                                        >
                                            ✨ Clean Text
                                        </button>
                                    )}
                                </div>
                            </div>
                            <textarea
                                id="content"
                                value={content}
                                onChange={e => {
                                    setContent(e.target.value);
                                    if (autoCleaned || autoCleanOriginal) {
                                        setAutoCleaned(false);
                                        setAutoCleanOriginal('');
                                    }
                                }}
                                placeholder="Paste your English text here or use the upload above..."
                                className={styles.textarea}
                                rows={selectedFile ? 6 : 10}
                                disabled={isLoading || isParsing}
                            />
                            <span className={styles.wordCount}>
                                {content.split(/\s+/).filter(w => w).length} words
                            </span>
                            {autoCleaned && (
                                <div className={styles.autoCleanNotice}>
                                    Auto-clean applied to fix broken line breaks.
                                    {autoCleanOriginal ? (
                                        <button
                                            type="button"
                                            className={styles.undoBtn}
                                            onClick={() => {
                                                setContent(autoCleanOriginal);
                                                setAutoCleaned(false);
                                                setAutoCleanOriginal('');
                                            }}
                                        >
                                            Undo
                                        </button>
                                    ) : null}
                                </div>
                            )}
                        </div>

                        {/* Bridge Cache Detection Banner */}
                        {bridgeCache && (
                            <div className={styles.cacheBanner}>
                                <div className={styles.cacheBannerContent}>
                                    <span className={styles.cacheBannerIcon}>⚡</span>
                                    <div>
                                        <strong>缓存命中</strong> — 此内容已分析过
                                        <span className={styles.cacheBadge}>
                                            {bridgeCache.source === 'local' ? 'Local' : 'Bridge'}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.cacheBannerActions}>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handleLoadCache}
                                    >
                                        加载缓存
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={() => setBridgeCache(null)}
                                    >
                                        重新分析
                                    </button>
                                </div>
                            </div>
                        )}
                        {bridgeChecking && (
                            <div className={styles.cacheChecking}>
                                <span className="spinner" /> 检查缓存中...
                            </div>
                        )}

                        {error && (
                            <div className={styles.error}>{error}</div>
                        )}

                        <div className={styles.actions}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleClose}
                                disabled={isLoading || isParsing}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={isLoading || isParsing || !content.trim()}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="spinner" />
                                        Analyzing...
                                    </>
                                ) : (
                                    'Import & Analyze'
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
