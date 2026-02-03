/**
 * Vocabulary Review Screen
 * For clearing context debt
 */
import { useState } from 'react';
import ABCard from './ABCard';
import styles from './VocabularyReview.module.css';

export default function VocabularyReview({
    words,
    onKeep,
    onArchive,
    onComplete,
    onBack
}) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [stats, setStats] = useState({ kept: 0, archived: 0 });

    const currentWord = words[currentIndex];
    const isComplete = currentIndex >= words.length;
    const remaining = words.length - currentIndex;

    const handleSessionComplete = () => {
        onComplete?.(stats);
    };

    const handleKeep = (word) => {
        onKeep(word);
        setStats(prev => ({ ...prev, kept: prev.kept + 1 }));
    };

    const handleArchive = (word) => {
        onArchive(word);
        setStats(prev => ({ ...prev, archived: prev.archived + 1 }));
    };

    const handleNext = () => {
        setCurrentIndex(prev => prev + 1);
    };

    if (words.length === 0) {
        return (
            <div className={styles.container}>
                <div className={styles.empty}>
                    <span className={styles.emptyIcon}>✨</span>
                    <h2>All Clear!</h2>
                    <p>No words pending review</p>
                    <button className="btn btn-primary" onClick={handleSessionComplete}>
                        Continue Reading
                    </button>
                </div>
            </div>
        );
    }

    if (isComplete) {
        return (
            <div className={styles.container}>
                <div className={styles.complete}>
                    <span className={styles.completeIcon}>🎉</span>
                    <h2>Session Complete!</h2>
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <span className={styles.statNumber}>{stats.archived}</span>
                            <span className={styles.statLabel}>Archived</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statNumber}>{stats.kept}</span>
                            <span className={styles.statLabel}>To Review Again</span>
                        </div>
                    </div>
                    <button className="btn btn-primary btn-large" onClick={handleSessionComplete}>
                        Continue Reading
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <button className="btn btn-ghost" onClick={onBack}>
                    ← Exit
                </button>
                <div className={styles.progress}>
                    <span className={styles.progressText}>
                        {currentIndex + 1} / {words.length}
                    </span>
                    <div className={styles.progressBar}>
                        <div
                            className={styles.progressFill}
                            style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
                        />
                    </div>
                </div>
                <span className={styles.remaining}>
                    {remaining} left
                </span>
            </header>

            {/* Word card */}
            <main className={styles.main}>
                <ABCard
                    word={currentWord}
                    onKeep={handleKeep}
                    onArchive={handleArchive}
                    onNext={handleNext}
                />
            </main>

            {/* Session stats */}
            <footer className={styles.footer}>
                <div className={styles.sessionStats}>
                    <span>🔄 {stats.kept} kept</span>
                    <span>✓ {stats.archived} archived</span>
                </div>
            </footer>
        </div>
    );
}
