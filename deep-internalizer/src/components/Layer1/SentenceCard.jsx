/**
 * Sentence Card Component for Step 3
 * Manages sentence splitting into Thought Groups
 */
import { useState, useEffect } from 'react';
import { splitSentenceIntoGroups } from '../../services/chunkingService';
import styles from './SentenceCard.module.css';

export default function SentenceCard({ sentence, translation, speak, isBilingual }) {
    const [isSplit, setIsSplit] = useState(false);
    const [thoughtGroups, setThoughtGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isZhVisible, setIsZhVisible] = useState(false);

    const [activeGroup, setActiveGroup] = useState(null);

    // Reset state when sentence changes
    useEffect(() => {
        setIsSplit(false);
        setThoughtGroups([]);
        setActiveGroup(null);
        setError(null);
        // If global bilingual is on, keep it visible; otherwise hide it for the new sentence
        setIsZhVisible(isBilingual);
    }, [sentence, isBilingual]);

    const handleToggleSplit = async (e) => {
        e.stopPropagation();

        if (isSplit) {
            setIsSplit(false);
            return;
        }

        if (thoughtGroups.length > 0) {
            setIsSplit(true);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const groups = await splitSentenceIntoGroups(sentence);
            setThoughtGroups(groups);
            setIsSplit(true);
        } catch (err) {
            console.error('Failed to split sentence:', err);
            setError('Failed to analyze sentence structure.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePlayGroup = async (e, text, index) => {
        e.stopPropagation();
        setActiveGroup(index);
        // Slightly slower speed for better phrasing practice
        await speak(text, { speed: 0.8 });
        setActiveGroup(null);
    };

    // Sync with global bilingual state
    useEffect(() => {
        if (isBilingual) {
            setIsZhVisible(true);
        }
    }, [isBilingual]);

    return (
        <div className={`${styles.sentenceCard} animate-in fade-in slide-in-from-top-4`}>
            {/* Scissors (Split) Button */}
            <button
                className={`${styles.scissorBtn} ${isSplit ? styles.active : ''}`}
                onClick={handleToggleSplit}
                disabled={isLoading}
                title={isSplit ? "Show full sentence" : "Decompose into Thought Groups"}
            >
                {isLoading ? '⏳' : '✂️'}
            </button>

            <div className={styles.contentArea}>
                {isSplit && thoughtGroups.length > 0 ? (
                    <div className={styles.thoughtGroupsGrid}>
                        {thoughtGroups.map((group, idx) => (
                            <div
                                key={idx}
                                className={`${styles.thoughtBlock} ${activeGroup === idx ? styles.playing : ''}`}
                                onClick={(e) => handlePlayGroup(e, group.text, idx)}
                                style={{ animationDelay: `${idx * 80}ms` }}
                            >
                                <span className={styles.groupText}>{group.text}</span>
                                <span className={styles.groupHint}>{group.hint}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.fullSentenceView}>
                        <p className={styles.sentenceText}>{sentence}</p>
                    </div>
                )}

                {/* Translation Section (Conditional) */}
                <div className={styles.zhContainer}>
                    {isZhVisible ? (
                        <p className={styles.translationZh}>{translation || "Translation not available (demo)"}</p>
                    ) : (
                        <button
                            className={styles.revealBtn}
                            onClick={() => setIsZhVisible(true)}
                            title="Show translation"
                        >
                            中
                        </button>
                    )}
                </div>
            </div>

            {error && <p className={styles.errorMsg}>{error}</p>}

            <div className={styles.instructions}>
                {isSplit ?
                    "Tap a group to practice phrasing. Focus on the pause between blocks." :
                    "Click the scissors to see 'Thought Groups'."}
            </div>
        </div>
    );
}
