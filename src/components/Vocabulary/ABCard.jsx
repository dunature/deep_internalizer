/**
 * A/B Context Card Component
 * Swipeable cards for vocabulary review
 * Card A: Original context (anchor)
 * Card B: New context (transfer)
 */
import { useState, useRef, useCallback } from 'react';
import styles from './ABCard.module.css';
import { HighlightedText } from '../common';

const SWIPE_THRESHOLD = 80;

export default function ABCard({
    word,
    onKeep,
    onArchive,
    onNext
}) {
    const [showingCard, setShowingCard] = useState('B'); // 'A' or 'B'
    const [isZhVisible, setIsZhVisible] = useState(false);
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
        setIsZhVisible(false);
        onKeep(word);
        setShowingCard('B');
        onNext?.();
    };

    const handleArchive = () => {
        setIsZhVisible(false);
        onArchive(word);
        setShowingCard('B');
        onNext?.();
    };

    if (!word) return null;

    return (
        <div className={styles.container}>
            {/* Card indicator */}
            <div className={styles.cardIndicator}>
                <span className={styles.cardStatus}>
                    {showingCard === 'B' ? 'Card B · New Context' : 'Card A · Original Context'}
                </span>
                <span className={styles.swipeHint}>
                    {showingCard === 'B' ? 'Swipe left for original context' : 'Swipe right for new context'}
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
                    <p className={styles.contextText}>
                        <HighlightedText
                            text={word.newContext || word.originalContext}
                            highlight={word.text}
                            as={null}
                            highlightClassName={styles.highlight}
                        />
                    </p>
                    <div className={styles.definitionBox}>
                        <p className={styles.definition}>{word.definition}</p>
                        {word.definition_zh && (
                            <div className={styles.zhContainer}>
                                {isZhVisible ? (
                                    <p className={styles.definitionZh}>{word.definition_zh}</p>
                                ) : (
                                    <button
                                        className={styles.revealBtn}
                                        onClick={() => setIsZhVisible(true)}
                                    >
                                        中
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Card A (Original Context) - Back */}
                <div
                    className={`${styles.card} ${styles.cardA} ${showingCard === 'B' ? styles.hidden : ''}`}
                >
                    <div className={styles.originalInfo}>
                        <div className={styles.wordHeader}>
                            <span className={styles.wordText}>{word.text}</span>
                            {word.pos && <span className={styles.pos}>{word.pos}</span>}
                        </div>
                        <span className={styles.phonetic}>{word.phonetic}</span>
                    </div>
                    <p className={styles.contextText}>
                        <HighlightedText
                            text={word.originalContext}
                            highlight={word.text}
                            as={null}
                            highlightClassName={styles.highlight}
                        />
                    </p>
                    <div className={styles.definitionBox}>
                        <p className={styles.definition}>{word.definition}</p>
                        {word.definition_zh && (
                            <div className={styles.zhContainer}>
                                {isZhVisible ? (
                                    <p className={styles.definitionZh}>{word.definition_zh}</p>
                                ) : (
                                    <button
                                        className={styles.revealBtn}
                                        onClick={() => setIsZhVisible(true)}
                                    >
                                        中
                                    </button>
                                )}
                            </div>
                        )}
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
