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
                <div className={styles.headerCenter}>
                    <span className={styles.headerLabel}>Review Session</span>
                    <h2>Vocabulary Review</h2>
                    <p className={styles.headerDesc}>Clear context debt one decision at a time.</p>
                </div>
                <div className={styles.headerRight}>
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
            </header>

            <div className={styles.reviewLayout}>
                <aside className={styles.sidePanel}>
                    <div className={styles.panelCard}>
                        <div className={styles.panelRow}>
                            <span className={styles.panelLabel}>Remaining</span>
                            <span className={styles.panelValue}>{remaining}</span>
                        </div>
                        <div className={styles.panelRow}>
                            <span className={styles.panelLabel}>Kept</span>
                            <span className={styles.panelValue}>{stats.kept}</span>
                        </div>
                        <div className={styles.panelRow}>
                            <span className={styles.panelLabel}>Archived</span>
                            <span className={styles.panelValue}>{stats.archived}</span>
                        </div>
                    </div>

                    <div className={styles.panelCard}>
                        <h4 className={styles.panelTitle}>How to Review</h4>
                        <p className={styles.panelHint}>Swipe the card to compare contexts.</p>
                        <p className={styles.panelHint}>Keep = review again. Archive = mastered.</p>
                    </div>
                </aside>

                {/* Word card */}
                <main className={styles.main}>
                    <ABCard
                        word={currentWord}
                        onKeep={handleKeep}
                        onArchive={handleArchive}
                        onNext={handleNext}
                    />
                </main>
            </div>
        </div>
    );
}
