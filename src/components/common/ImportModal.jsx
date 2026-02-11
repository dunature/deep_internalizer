/**
 * Import Modal Component
 * For importing new documents via text paste
 */
import { useState, useRef } from 'react';
import { parseFile, cleanTextPreserveParagraphs } from '../../utils/fileParser';
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
    const [parseStartedAt, setParseStartedAt] = useState(0);
    const [parseMetrics, setParseMetrics] = useState(null);

    const fileInputRef = useRef(null);

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

        onImport({ title: title.trim(), content: content.trim(), parseMetrics });
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
        setParseStartedAt(0);
        setParseMetrics(null);
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
