/**
 * Vocabulary Card Component
 * Single-face vocabulary card (day variant)
 */
import { useState, useEffect } from 'react';
import styles from './VocabularyCard.module.css';
import { HighlightedText } from '../common';

export default function VocabularyCard({
    word,
    speak,
    isTTSLoading,
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

    // Reset card-local state when word changes
    useEffect(() => {
        setIsSplit(false);
        setActiveSyllable(null);
    }, [word]);

    return (
        <div className={styles.cardShell}>
            <div className={styles.cardHeader}>
                <h2
                    className={styles.mainWord}
                    onClick={() => speak(word.word)}
                    style={{ cursor: 'pointer' }}
                >
                    {word.word}
                </h2>
                <div className={styles.phoneticRow}>
                    <span className={styles.phoneticText}>{word.phonetic}</span>
                    <button
                        className={styles.audioBtn}
                        onClick={() => speak(word.word)}
                        disabled={isTTSLoading}
                        title="Play word pronunciation"
                    >
                        {isTTSLoading ? '...' : '🔊'}
                    </button>
                    <button
                        className={`${styles.scissorBtn} ${isSplit ? styles.active : ''}`}
                        onClick={toggleSplit}
                        title="Split into syllables"
                    >
                        ✂️
                    </button>
                </div>
                {isSplit && word.slices && (
                    <div className={styles.syllableContainer}>
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
            </div>

            <div className={styles.cardBody}>
                <div className={styles.cardMetaRow}>
                    {word.pos && <span className={styles.posTag}>{word.pos}</span>}
                </div>
                <div className={styles.divider}></div>
                <div className={styles.definitionSection}>
                    <p className={styles.definitionEn}>{word.definition}</p>
                    {word.definition_zh && (
                        <div className={styles.zhContainer}>
                            {isZhVisible ? (
                                <p className={styles.definitionCn}>{word.definition_zh}</p>
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
                <div className={styles.exampleSection}>
                    <div className={styles.exampleItem}>
                        <HighlightedText text={word.sentence} highlight={word.word} />
                    </div>
                </div>
            </div>
        </div>
    );
}
