/**
 * A/B Context Card Component
 * Swipeable cards for vocabulary review
 * Card A: Original context (anchor)
 * Card B: New context (transfer)
 */
import { useState, useRef, useCallback } from 'react';
import styles from './ABCard.module.css';

const SWIPE_THRESHOLD = 80;

export default function ABCard({
    word,
    onKeep,
    onArchive,
    onNext
}) {
    const [showingCard, setShowingCard] = useState('B'); // 'A' or 'B'
    const [offset, setOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startXRef = useRef(0);
    const cardRef = useRef(null);

    const handleTouchStart = useCallback((e) => {
        startXRef.current = e.touches[0].clientX;
        setIsDragging(true);
    }, []);

    const handleTouchMove = useCallback((e) => {
        if (!isDragging) return;
        const currentX = e.touches[0].clientX;
        const delta = currentX - startXRef.current;
        // Only allow left swipe (negative) when on Card B
        if (showingCard === 'B' && delta < 0) {
            setOffset(Math.max(delta, -200));
        } else if (showingCard === 'A' && delta > 0) {
            setOffset(Math.min(delta, 200));
        }
    }, [isDragging, showingCard]);

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false);
        if (Math.abs(offset) > SWIPE_THRESHOLD) {
            if (offset < 0 && showingCard === 'B') {
                setShowingCard('A');
            } else if (offset > 0 && showingCard === 'A') {
                setShowingCard('B');
            }
        }
        setOffset(0);
    }, [offset, showingCard]);

    // Mouse events for desktop
    const handleMouseDown = useCallback((e) => {
        startXRef.current = e.clientX;
        setIsDragging(true);
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;
        const delta = e.clientX - startXRef.current;
        if (showingCard === 'B' && delta < 0) {
            setOffset(Math.max(delta, -200));
        } else if (showingCard === 'A' && delta > 0) {
            setOffset(Math.min(delta, 200));
        }
    }, [isDragging, showingCard]);

    const handleMouseUp = useCallback(() => {
        if (!isDragging) return;
        setIsDragging(false);
        if (Math.abs(offset) > SWIPE_THRESHOLD) {
            if (offset < 0 && showingCard === 'B') {
                setShowingCard('A');
            } else if (offset > 0 && showingCard === 'A') {
                setShowingCard('B');
            }
        }
        setOffset(0);
    }, [isDragging, offset, showingCard]);

    const handleKeep = () => {
        onKeep(word);
        setShowingCard('B');
        onNext?.();
    };

    const handleArchive = () => {
        onArchive(word);
        setShowingCard('B');
        onNext?.();
    };

    if (!word) return null;

    return (
        <div className={styles.container}>
            {/* Card indicator */}
            <div className={styles.cardIndicator}>
                <span className={`${styles.dot} ${showingCard === 'B' ? styles.active : ''}`}>
                    Card B (New Context)
                </span>
                <span className={styles.swipeHint}>
                    {showingCard === 'B' ? '← swipe left for original' : '→ swipe right to go back'}
                </span>
                <span className={`${styles.dot} ${showingCard === 'A' ? styles.active : ''}`}>
                    Card A (Original)
                </span>
            </div>

            {/* Card stack */}
            <div
                className={styles.cardStack}
                ref={cardRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {/* Card B (New Context) - Front */}
                <div
                    className={`${styles.card} ${styles.cardB} ${showingCard === 'A' ? styles.hidden : ''}`}
                    style={{
                        transform: `translateX(${offset}px)`,
                        transition: isDragging ? 'none' : 'transform 0.3s ease'
                    }}
                >
                    <div className={styles.cardLabel}>New Context</div>
                    <p className={styles.contextText}>{word.newContext || 'Loading new context...'}</p>
                    <div className={styles.wordReveal}>
                        <span className={styles.blankWord}>______</span>
                        <span className={styles.wordHint}>{word.text}</span>
                    </div>
                </div>

                {/* Card A (Original Context) - Back */}
                <div
                    className={`${styles.card} ${styles.cardA} ${showingCard === 'B' ? styles.hidden : ''}`}
                >
                    <div className={styles.cardLabel}>Original Context</div>
                    <p className={styles.contextText}>
                        <HighlightedText text={word.originalContext} highlight={word.text} />
                    </p>
                    <div className={styles.wordInfo}>
                        <span className={styles.wordText}>{word.text}</span>
                        <span className={styles.phonetic}>{word.phonetic}</span>
                    </div>
                </div>
            </div>

            {/* Action buttons */}
            <div className={styles.actions}>
                <button
                    className={`btn btn-secondary ${styles.keepBtn}`}
                    onClick={handleKeep}
                >
                    <span className={styles.btnIcon}>🔄</span>
                    Keep
                </button>
                <button
                    className={`btn btn-primary ${styles.archiveBtn}`}
                    onClick={handleArchive}
                >
                    <span className={styles.btnIcon}>✓</span>
                    Archive
                </button>
            </div>
        </div>
    );
}

function HighlightedText({ text, highlight }) {
    if (!text || !highlight) return text;

    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === highlight.toLowerCase()
                    ? <mark key={i} className={styles.highlight}>{part}</mark>
                    : part
            )}
        </>
    );
}
