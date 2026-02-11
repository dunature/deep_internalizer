/**
 * Layer 0: Global Blueprint Component
 * Shows document overview with semantic chunks and progress
 */
import { useMemo } from 'react';
import styles from './GlobalBlueprint.module.css';

export default function GlobalBlueprint({
    document,
    chunks,
    onChunkSelect,
    currentChunkIndex
}) {
    const totalProgress = useMemo(() => {
        if (!chunks || chunks.length === 0) return 0;
        const completed = chunks.filter(c => c.completed).length;
        return Math.round((completed / chunks.length) * 100);
    }, [chunks]);

    if (!document) {
        return (
            <div className={styles.empty}>
                <p>No document loaded</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header with thesis */}
            <header className={styles.header}>
                <h1 className={styles.title}>{document.title}</h1>
                {document.coreThesis && (
                    <p className={styles.thesis}>
                        {document.coreThesis}
                    </p>
                )}

                {/* Overall progress */}
                <div className={styles.progressSection}>
                    <div className={styles.progressHeader}>
                        <span>Overall Progress</span>
                        <span className={styles.progressPercent}>{totalProgress}%</span>
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${totalProgress}%` }}
                        />
                    </div>
                </div>
            </header>

            {/* Chunk map */}
            <section className={styles.chunkMap}>
                <h2 className={styles.sectionTitle}>Logic Map</h2>

                <div className={styles.chunkList}>
                    {chunks.map((chunk, index) => (
                        <ChunkCard
                            key={chunk.id}
                            chunk={chunk}
                            index={index}
                            isActive={index === currentChunkIndex}
                            onClick={() => onChunkSelect(index)}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}

function ChunkCard({ chunk, index, isActive, onClick }) {
    const progress = chunk.completed
        ? 100
        : Math.round((chunk.currentStep / chunk.totalSteps) * 100);

    return (
        <div
            className={`${styles.chunkCard} ${isActive ? styles.active : ''} ${chunk.completed ? styles.completed : ''}`}
            onClick={onClick}
        >
            <div className={styles.chunkHeader}>
                <span className={styles.chunkIndex}>#{index + 1}</span>
                <span className={styles.chunkSteps}>
                    {chunk.completed ? '✓' : `${chunk.currentStep}/${chunk.totalSteps}`}
                </span>
            </div>

            <h3 className={styles.chunkTitle}>{chunk.title}</h3>
            <p className={styles.chunkSummary}>{chunk.summary}</p>

            <div className={styles.chunkProgress}>
                <div
                    className={styles.chunkProgressFill}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}
