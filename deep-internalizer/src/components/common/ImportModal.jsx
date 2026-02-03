/**
 * Import Modal Component
 * For importing new documents via text paste
 */
import { useState, useRef } from 'react';
import { parseFile } from '../../utils/fileParser';
import ThinkingProcess from './ThinkingProcess';
import styles from './ImportModal.module.css';

export default function ImportModal({ isOpen, onClose, onImport, isLoading, processingLogs, processingStep }) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [error, setError] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef(null);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            await processFile(file);
        }
    };

    const processFile = async (file) => {
        setIsParsing(true);
        setError('');
        try {
            const result = await parseFile(file);
            if (!title) {
                setTitle(result.title);
            }

            // Smart append/replace logic
            if (content.trim()) {
                const shouldAppend = window.confirm(
                    'Content field is not empty. Do you want to APPEND the new file content? \n(Cancel will REPLACE existing content)'
                );

                if (shouldAppend) {
                    setContent(prev => prev + '\n\n' + result.content);
                } else {
                    setContent(result.content);
                }
            } else {
                setContent(result.content);
            }

            setSelectedFile(file);
        } catch (err) {
            console.error('File parsing error:', err);
            setError(`Failed to parse file: ${err.message}`);
        } finally {
            setIsParsing(false);
        }
    };

    const handleCleanText = () => {
        if (!content) return;
        // Logic: Replace single newlines with spaces, but keep double newlines (paragraphs)
        // 1. Split by double newlines to preserve paragraphs
        // 2. In each paragraph, replace single newlines with spaces
        // 3. Join back with double newlines
        const cleaned = content
            .split(/\n\n+/)
            .map(para => para.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
            .join('\n\n');

        setContent(cleaned);
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

        onImport({ title: title.trim(), content: content.trim() });
    };

    const handleClose = () => {
        setTitle('');
        setContent('');
        setError('');
        setSelectedFile(null);
        onClose();
    };

    if (!isOpen) return null;

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
                        <ThinkingProcess logs={processingLogs} currentStep={processingStep} />
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
                                        <p>Extracting text from file...</p>
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
                            <textarea
                                id="content"
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="Paste your English text here or use the upload above..."
                                className={styles.textarea}
                                rows={selectedFile ? 6 : 10}
                                disabled={isLoading || isParsing}
                            />
                            <span className={styles.wordCount}>
                                {content.split(/\s+/).filter(w => w).length} words
                            </span>
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
