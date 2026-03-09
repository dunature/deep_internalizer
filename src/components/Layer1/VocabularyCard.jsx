/**
 * Vocabulary Card Component - Step 2 Baseline
 * 1:1 Replica of Pencil Design (sSPCS / vK0th)
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
    const wordText = word?.word || word?.text || '';
    const sentenceText = word?.sentence || word?.originalContext || '';
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
        await speak(slice.text, { type: 'syllable', speed: 0.7 });
        setActiveSyllable(null);
    };

    // Reset card-local state when word changes
    useEffect(() => {
        setIsSplit(false);
        setActiveSyllable(null);
    }, [word]);

    return (
        <div className={styles.card}>
            {/* 1:1 Front Section (I1yhf / ePQcj) */}
            <div className={styles.front}>
                <h2 className={styles.mainWord} onClick={() => speak(wordText)}>
                    {wordText}
                </h2>
                <div className={styles.phonRow}>
                    <span className={styles.phonText}>{word.phonetic}</span>
                    <div className={styles.phonActions}>
                        <button
                            className={styles.audioIconBtn}
                            onClick={() => speak(wordText)}
                            disabled={isTTSLoading}
                        >
                            {isTTSLoading ? '...' : '🔊'}
                        </button>
                        <button
                            className={`${styles.scissorBtn} ${isSplit ? styles.active : ''}`}
                            onClick={toggleSplit}
                        >
                            ✂️
                        </button>
                    </div>
                </div>

                {isSplit && word.slices && (
                    <div className={styles.syllableGrid}>
                        {word.slices.map((slice, idx) => (
                            <div
                                key={idx}
                                className={styles.syllableNode}
                                onClick={(e) => handlePlaySyllable(e, slice, idx)}
                            >
                                <span className={`${styles.syllableBox} ${activeSyllable === idx ? styles.playing : ''}`}>
                                    {slice.text}
                                </span>
                                {slice.phonetic && (
                                    <span className={styles.syllablePhon}>{slice.phonetic}</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 1:1 BackHead Section (XIoId / kLNtA) */}
            <div className={styles.backHead}>
                <div className={styles.lemmaLeft}>
                    <span className={styles.lemmaTxt}>{wordText}</span>
                    <button className={styles.smallAudioBtn} onClick={() => speak(wordText)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    </button>
                </div>
                <div className={styles.posTag}>{word.pos || 'n.'}</div>
            </div>

            {/* 1:1 Back Section (p199e / GDfqS) */}
            <div className={styles.back}>
                <div className={styles.divider}></div>
                <div className={styles.definition}>
                    <p className={styles.defEn}>{word.definition}</p>
                    {isZhVisible && word.definition_zh && (
                        <p className={styles.defZh}>{word.definition_zh}</p>
                    )}
                </div>
                <div className={styles.exampleCard}>
                    <HighlightedText text={sentenceText} highlight={wordText} />
                </div>
            </div>
        </div>
    );
}
