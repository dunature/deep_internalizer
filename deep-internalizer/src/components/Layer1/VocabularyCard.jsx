/**
 * Vocabulary Card Component
 * Manages individual word state (split/syllable view)
 */
import { useState } from 'react';
import styles from './VocabularyCard.module.css';

export default function VocabularyCard({
    word,
    speak,
    isTTSLoading,
    onPeekStart,
    onPeekEnd
}) {
    const [isSplit, setIsSplit] = useState(false);
    const [activeSyllable, setActiveSyllable] = useState(null);
    const [isZhVisible, setIsZhVisible] = useState(false);

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

    return (
        <div className={`${styles.wordCard} animate-in fade-in slide-in-from-top-4`}>
            {/* Scissors (Split Phonetic) Button */}
            <button
                className={`${styles.scissorBtn} ${isSplit ? styles.active : ''}`}
                onClick={toggleSplit}
                title={isSplit ? "Show full word" : "Split into syllables"}
            >
                ✂️
            </button>

            <div className={styles.wordMain}>
                {isSplit && word.slices ? (
                    <div className={styles.splitWord}>
                        {word.slices.map((slice, idx) => (
                            <div
                                key={idx}
                                className={`${styles.syllableBlock} ${activeSyllable === idx ? styles.playing : ''}`}
                                onClick={(e) => handlePlaySyllable(e, slice, idx)}
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <span className={styles.syllableText}>{slice.text}</span>
                                <span className={styles.syllablePhonetic}>{slice.phonetic}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.wordTitleRow}>
                        <div className={styles.wordHeader}>
                            <span className={styles.wordText}>{word.word}</span>
                            {word.pos && <span className={styles.pos}>{word.pos}</span>}
                        </div>
                        <div className={styles.wordMeta}>
                            <button
                                className={`btn btn-ghost ${styles.wordAudioBtn}`}
                                onClick={(e) => { e.stopPropagation(); speak(word.word); }}
                                disabled={isTTSLoading}
                                title="Listen to pronunciation"
                            >
                                {isTTSLoading ? '⏳' : '🔊'}
                            </button>
                            <span className={styles.phonetic}>{word.phonetic}</span>
                        </div>
                    </div>
                )}
            </div>

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

            {/* Peek Origin Button */}
            <button
                className={styles.peekButton}
                onMouseDown={onPeekStart}
                onMouseUp={onPeekEnd}
                onMouseLeave={onPeekEnd}
                onTouchStart={onPeekStart}
                onTouchEnd={onPeekEnd}
            >
                👁️ Hold to see original context
            </button>
        </div>
    );
}
