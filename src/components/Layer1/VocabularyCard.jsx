/**
 * Vocabulary Card Component
 * Manages individual word state (split/syllable view)
 */
import { useState, useEffect } from 'react';
import styles from './VocabularyCard.module.css';
import { HighlightedText } from '../common';

export default function VocabularyCard({
    word,
    speak,
    isTTSLoading,
    onPeekStart,
    onPeekEnd,
    isBilingual
}) {
    const [isSplit, setIsSplit] = useState(false);
    const [activeSyllable, setActiveSyllable] = useState(null);
    const [isZhVisible, setIsZhVisible] = useState(isBilingual);

    // Sync local visibility with global toggle
    useEffect(() => {
        setIsZhVisible(isBilingual);
    }, [isBilingual]);

    const toggleSplit = (e) => {
        e.stopPropagation();
        setIsSplit(!isSplit);
    };

    const handlePlaySyllable = async (e, slice, index) => {
        e.stopPropagation();
        setActiveSyllable(index);
        // Use speakSyllable for cached syllable playback at slower speed
        await speak(slice.text, { type: 'syllable', speed: 0.7 });
        setActiveSyllable(null);
    };

    const [isFlipped, setIsFlipped] = useState(false);

    // Reset flip state when word changes
    useEffect(() => {
        setIsFlipped(false);
        setIsSplit(false);
    }, [word]);

    const handleCardClick = () => {
        if (!isSplit) {
            setIsFlipped(!isFlipped);
        }
    };

    return (
        <div className={styles.cardScene}>
            <div
                className={`${styles.cardObject} ${isFlipped ? styles.flipped : ''}`}
                onClick={handleCardClick}
            >
                {/* Front Face: Target Word */}
                <div className={styles.cardFaceFront}>
                    <div className={styles.frontContent}>
                        <h2 className={styles.frontWord}>{word.word}</h2>

                        {/* Phonetics on Front */}
                        <div className={styles.phoneticRowFront}>
                            <span className={styles.phoneticText}>{word.phonetic}</span>
                            <button
                                className={`${styles.scissorBtn} ${isSplit ? styles.active : ''}`}
                                onClick={toggleSplit}
                                title="Split into syllables"
                            >
                                ✂️
                            </button>
                        </div>

                        {/* Split View on Front (if active) */}
                        {isSplit && word.slices && (
                            <div className={styles.syllableContainerFront}>
                                {word.slices.map((slice, idx) => (
                                    <div
                                        key={idx}
                                        className={styles.syllableColumn}
                                        onClick={(e) => handlePlaySyllable(e, slice, idx)}
                                    >
                                        <span className={`${styles.syllableChip} ${activeSyllable === idx ? styles.playing : ''}`}>
                                            {slice.text}
                                        </span>
                                        {slice.phonetic && (
                                            <span className={styles.syllablePhonetic}>{slice.phonetic}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {!isSplit && (
                            <div className={styles.frontHint}>
                                <span className={styles.clickToFlip}>Tap to flip</span>
                            </div>
                        )}
                    </div>

                    {/* Peek Button on Front */}
                    {/* Peek Button on Front */}
                    <button
                        className={styles.peekButtonFront}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onPeekStart(e);
                        }}
                        onMouseUp={(e) => {
                            e.stopPropagation();
                            onPeekEnd(e);
                        }}
                        onMouseLeave={(e) => {
                            e.stopPropagation();
                            onPeekEnd(e);
                        }}
                        onTouchStart={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onPeekStart(e);
                        }}
                        onTouchEnd={(e) => {
                            e.stopPropagation();
                            onPeekEnd(e);
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        👁️ Hold for context
                    </button>
                </div>

                {/* Back Face: Details */}
                <div className={styles.cardFaceBack}>
                    {/* Top Row: Word + Audio + POS */}
                    <div className={styles.cardBackHeader}>
                        <div className={styles.headerLeft}>
                            <span className={styles.backWord}>{word.word}</span>
                            <button
                                className={styles.audioBtn}
                                onClick={(e) => { e.stopPropagation(); speak(word.word); }}
                                disabled={isTTSLoading}
                            >
                                {isTTSLoading ? '...' : '🔊'}
                            </button>
                        </div>
                        {word.pos && <span className={styles.posTag}>{word.pos}</span>}
                    </div>

                    {/* Core Definition */}
                    <div className={styles.definitionSection}>
                        <p className={styles.definitionEn}>{word.definition}</p>
                        {word.definition_zh && (
                            <div className={styles.zhContainer}>
                                {isZhVisible ? (
                                    <p className={styles.definitionCn}>{word.definition_zh}</p>
                                ) : (
                                    <button
                                        className={styles.revealBtn}
                                        onClick={(e) => { e.stopPropagation(); setIsZhVisible(true); }}
                                    >
                                        中
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Example Sentences */}
                    <div className={styles.exampleSection}>
                        <div className={styles.exampleItem}>
                            <HighlightedText text={word.sentence} highlight={word.word} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
