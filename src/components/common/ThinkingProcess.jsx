/**
 * Thinking Process UI
 * Visualizes the internal AI logic during long-running operations.
 */
import { useEffect, useRef, useState } from 'react';
import styles from './ThinkingProcess.module.css';

export default function ThinkingProcess({ logs = [], currentStep, meta, steps = [] }) {
    const scrollRef = useRef(null);
    const [now, setNow] = useState(Date.now());

    // Auto-scroll to bottom of logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const formatDuration = (ms) => {
        if (ms == null) return '—';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const elapsedMs = meta?.startedAt ? Math.max(0, now - meta.startedAt) : null;
    const progressTotal = steps.length;
    const progressDone = steps.reduce((count, step) => {
        const status = meta?.steps?.[step.key]?.status;
        if (status === 'done' || status === 'skipped') {
            return count + 1;
        }
        return count;
    }, 0);
    const progressPct = progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.pulseContainer}>
                    <div className={styles.pulse}></div>
                </div>
                <h3 className={styles.title}>AI Reasoning Engine</h3>
            </div>

            {meta ? (
                <div className={styles.metricsGrid}>
                    <div className={styles.metricCard}>
                        <div className={styles.metricLabel}>Provider</div>
                        <div className={styles.metricValue}>{meta.provider || '—'}</div>
                        <div className={styles.metricSub}>{meta.model || '—'}</div>
                    </div>
                    <div className={styles.metricCard}>
                        <div className={styles.metricLabel}>Cache</div>
                        <div className={styles.metricValue}>
                            {meta.cacheStatus === 'hit' ? 'HIT' : meta.cacheStatus === 'miss' ? 'MISS' : '—'}
                        </div>
                        <div className={styles.metricSub}>
                            {meta.actualChunks != null ? `${meta.actualChunks} chunks` : '—'}
                        </div>
                    </div>
                    <div className={styles.metricCard}>
                        <div className={styles.metricLabel}>Doc Stats</div>
                        <div className={styles.metricValue}>
                            {meta.docStats?.words ?? '—'} words
                        </div>
                        <div className={styles.metricSub}>
                            {(meta.docStats?.sentences ?? '—')} sentences · {(meta.docStats?.paragraphs ?? '—')} paragraphs
                        </div>
                        <div className={styles.metricSub}>
                            {(meta.docStats?.chars ?? '—')} chars · {(meta.docStats?.estimatedChunks ?? '—')} est. chunks
                        </div>
                    </div>
                    <div className={styles.metricCard}>
                        <div className={styles.metricLabel}>Timings</div>
                        <div className={styles.metricValue}>{formatDuration(elapsedMs)} elapsed</div>
                        <div className={styles.metricSub}>
                            Summary {formatDuration(meta.timings?.summaryMs)} · Chunking {formatDuration(meta.timings?.chunkingMs)}
                        </div>
                        <div className={styles.metricSub}>
                            Save {formatDuration(meta.timings?.saveMs)} · Keywords {formatDuration(meta.timings?.keywordMs)}
                        </div>
                        <div className={styles.metricSub}>
                            Parse {formatDuration(meta.timings?.parseMs)} · Clean {formatDuration(meta.timings?.cleanMs)}
                        </div>
                    </div>
                </div>
            ) : null}

            {steps.length > 0 ? (
                <div className={styles.stepsSection}>
                    <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className={styles.stepList}>
                        {steps.map(step => {
                            const stepMeta = meta?.steps?.[step.key];
                            const status = stepMeta?.status || (currentStep === step.key ? 'active' : 'pending');
                            const extras = [];

                            if (step.key === 'SAVING' && meta?.saveProgress?.total) {
                                extras.push(`${meta.saveProgress.inserted}/${meta.saveProgress.total}`);
                            }
                            if (step.key === 'PREFETCH_KEYWORDS' && meta?.keywordProgress?.total) {
                                extras.push(`${meta.keywordProgress.done}/${meta.keywordProgress.total}`);
                            }
                            if (stepMeta?.ms != null) {
                                extras.push(formatDuration(stepMeta.ms));
                            }

                            return (
                                <div key={step.key} className={styles.stepItem}>
                                    <div className={styles.stepLabel}>{step.label}</div>
                                    <div className={styles.stepMeta}>
                                        {extras.length > 0 ? (
                                            <span className={styles.stepExtras}>{extras.join(' · ')}</span>
                                        ) : null}
                                        <span className={`${styles.stepStatus} ${styles[`stepStatus_${status}`] || ''}`}>
                                            {status.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : null}

            <div className={styles.terminal} ref={scrollRef}>
                {logs.map((log, index) => (
                    <div
                        key={index}
                        className={`${styles.logLine} ${log.type === 'active' ? styles.active : ''} ${log.type === 'done' ? styles.done : ''}`}
                    >
                        <span className={styles.timestamp}>[{log.timestamp}]</span>
                        <span className={styles.message}>{log.message}</span>
                        {log.type === 'active' && <span className={styles.cursor}>_</span>}
                    </div>
                ))}
            </div>

            <div className={styles.status}>
                <span className={styles.statusLabel}>STATUS:</span>
                <span className={styles.statusValue}>{currentStep || 'INITIALIZING'}</span>
            </div>
        </div>
    );
}
