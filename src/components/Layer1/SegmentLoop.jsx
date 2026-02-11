/**
 * Layer 1: Segment Loop Component
 * The 4-step reading loop for each chunk
 * Now with background prefetching support
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import styles from './SegmentLoop.module.css';
import { useTTS } from '../../hooks/useTTS';
import { prefetchService } from '../../services/prefetchService';
import VocabularyCard from './VocabularyCard';
import SentenceCard from './SentenceCard';
import { HighlightedText } from '../common';

const STEPS = [
    { id: 1, name: 'Macro Context', icon: '📖' },
    { id: 2, name: 'Vocabulary Build', icon: '📝' },
    { id: 3, name: 'Articulation', icon: '🎤' },
    { id: 4, name: 'Flow Practice', icon: '🔊' }
];

export default function SegmentLoop({
    chunk,
    words: externalWords = [],
    currentStep,
    onStepComplete,
    onWordAction,
    onBack
}) {
    const [isBilingual, setIsBilingual] = useState(false);
    const [prefetchedWords, setPrefetchedWords] = useState(null); // null = loading, [] = loaded empty
    const [prefetchError, setPrefetchError] = useState(false);
    const abortRef = useRef(null);
    const lastChunkIdRef = useRef(null);

    // Reset state when chunk changes (during render, not in effect)
    const currentChunkId = chunk?.id;
    if (currentChunkId !== lastChunkIdRef.current) {
        lastChunkIdRef.current = currentChunkId;
        // These are safe to call during render when we're resetting for a new chunk
        if (prefetchedWords !== null) {
            setPrefetchedWords(null);
        }
        if (prefetchError) {
            setPrefetchError(false);
        }
    }

    // Derive loading state from data presence
    const isLoadingWords = prefetchedWords === null && !prefetchError && currentChunkId && chunk?.originalText;

    // Use external words if provided, otherwise use prefetched
    const words = useMemo(() => {
        return externalWords.length > 0 ? externalWords : (prefetchedWords || []);
    }, [externalWords, prefetchedWords]);

    // Prefetch keywords when entering Step 1
    useEffect(() => {
        if (!currentChunkId || !chunk?.originalText) {
            return;
        }

        const controller = new AbortController();
        abortRef.current = controller;

        // Fast path: load cached keywords immediately if available
        prefetchService.getKeywordsIfReady(currentChunkId)
            .then(cached => {
                if (!controller.signal.aborted && cached) {
                    setPrefetchedWords(cached);
                }
            })
            .catch(() => {});

        // Fetch keywords in background
        prefetchService.prefetchKeywords(currentChunkId, chunk.originalText, controller.signal)
            .then(keywords => {
                if (!controller.signal.aborted) {
                    setPrefetchedWords(keywords || []);
                }
            })
            .catch(e => {
                if (e.name !== 'AbortError') {
                    console.error('[SegmentLoop] Prefetch failed:', e);
                    setPrefetchError(true);
                }
            });

        return () => {
            controller.abort();
            prefetchService.cancelPrefetch(currentChunkId);
        };
    }, [currentChunkId, chunk?.originalText]);

    // Prefetch TTS when entering Step 2 (Vocabulary Build)
    useEffect(() => {
        if (currentStep !== 2 || words.length === 0) return;

        // Prioritize first 1-2 words for faster initial experience
        const firstBatch = words.slice(0, 2);
        prefetchService.prefetchTTSForWords(firstBatch);

        const rest = words.slice(2);
        if (rest.length === 0) return;

        let cancel = () => {};
        if (typeof requestIdleCallback !== 'undefined') {
            const id = requestIdleCallback(() => prefetchService.prefetchTTSForWords(rest));
            cancel = () => cancelIdleCallback(id);
        } else {
            const id = setTimeout(() => prefetchService.prefetchTTSForWords(rest), 0);
            cancel = () => clearTimeout(id);
        }

        return () => cancel();
    }, [currentStep, words]);

    // Warm up TTS for first 1-2 words during Step 1
    useEffect(() => {
        if (currentStep !== 1 || words.length === 0) return;

        const firstBatch = words.slice(0, 2);
        let cancel = () => {};

        if (typeof requestIdleCallback !== 'undefined') {
            const id = requestIdleCallback(() => prefetchService.prefetchTTSForWords(firstBatch));
            cancel = () => cancelIdleCallback(id);
        } else {
            const id = setTimeout(() => prefetchService.prefetchTTSForWords(firstBatch), 0);
            cancel = () => clearTimeout(id);
        }

        return () => cancel();
    }, [currentStep, words]);

    if (!chunk) {
        return (
            <div className={styles.empty}>
                <p>No chunk selected</p>
            </div>
        );
    }

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return <Step1MacroContext chunk={chunk} isBilingual={isBilingual} onComplete={() => onStepComplete(1)} />;
            case 2:
                return (
                    <Step2VocabularyBuild
                        words={words}
                        isLoading={isLoadingWords}
                        onWordAction={onWordAction}
                        isBilingual={isBilingual}
                        chunkId={chunk?.id}
                        onComplete={() => onStepComplete(2)}
                    />
                );
            case 3:
                return (
                    <Step3Articulation
                        chunk={chunk}
                        isBilingual={isBilingual}
                        onComplete={() => onStepComplete(3)}
                    />
                );
            case 4:
                return <Step4FlowPractice chunk={chunk} onComplete={() => onStepComplete(4)} />;
            default:
                return null;
        }
    };

    return (
        <div className={styles.container}>
            {/* Step indicator */}
            <div className={styles.stepIndicator}>
                {STEPS.map((step) => (
                    <div
                        key={step.id}
                        className={`${styles.step} ${currentStep === step.id ? styles.active : ''} ${currentStep > step.id ? styles.completed : ''}`}
                    >
                        <span className={styles.stepIcon}>{step.icon}</span>
                        <span className={styles.stepName}>{step.name}</span>
                    </div>
                ))}
            </div>

            {/* Chunk header */}
            <header className={styles.header}>
                <button className={`btn btn-ghost ${styles.backBtn}`} onClick={onBack}>
                    ← Back to Map
                </button>
                <h2 className={styles.chunkTitle}>{chunk.title}</h2>
                <button
                    className={`${styles.bilingualBtn} ${isBilingual ? styles.active : ''}`}
                    onClick={() => setIsBilingual(!isBilingual)}
                    title={isBilingual ? "Hide Chinese" : "Show Chinese"}
                >
                    中/EN
                </button>
            </header>

            {/* Step content */}
            <main className={styles.content}>
                {renderStepContent()}
            </main>
        </div>
    );
}

/**
 * Step 1: Macro Context - Summary overview
 */
function Step1MacroContext({ chunk, isBilingual, onComplete }) {
    return (
        <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
                <span className={styles.stepLabel}>Step 1</span>
                <h3>Macro Context</h3>
                <p className={styles.stepDesc}>Read the summary to understand the big picture</p>
            </div>

            <div className={styles.summaryCard}>
                <p className={styles.summary}>{chunk.summary}</p>
                {isBilingual && chunk.summary_zh && (
                    <p className={styles.summaryZh}>{chunk.summary_zh}</p>
                )}
            </div>

            <div className={styles.originalPreview}>
                <h4>Original Text Preview</h4>
                <p className={styles.originalText}>
                    {chunk.originalText?.substring(0, 300)}
                    {chunk.originalText?.length > 300 ? '...' : ''}
                </p>
            </div>

            <button className="btn btn-primary btn-large" onClick={onComplete}>
                I understand the context →
            </button>
        </div>
    );
}

/**
 * Step 2: Vocabulary Build - Key words with original context
 */
function Step2VocabularyBuild({ words, isLoading: isLoadingWords, onWordAction, onComplete, isBilingual, chunkId }) {
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [showPeek, setShowPeek] = useState(false);
    const [isDeferred, setIsDeferred] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [addedWords, setAddedWords] = useState(() => new Set());
    const { speak, isLoading } = useTTS();
    const lastAddKeyRef = useRef(null);
    const addLockRef = useRef(false);
    const lastAddAtRef = useRef(0);

    const currentWord = words[currentWordIndex];
    const hasWords = words.length > 0;
    const isLastWord = currentWordIndex >= words.length - 1;
    const currentWordKey = currentWord?.word || currentWord?.text || '';
    const alreadyAdded = currentWordKey ? addedWords.has(currentWordKey) : false;

    useEffect(() => {
        if (isLoadingWords) {
            setIsDeferred(false);
            return;
        }

        setIsDeferred(true);
        let cancel = () => {};

        if (typeof requestIdleCallback !== 'undefined') {
            const id = requestIdleCallback(() => setIsDeferred(false));
            cancel = () => cancelIdleCallback(id);
        } else {
            const id = setTimeout(() => setIsDeferred(false), 0);
            cancel = () => clearTimeout(id);
        }

        return () => cancel();
    }, [isLoadingWords, words.length]);

    useEffect(() => {
        setCurrentWordIndex(0);
        setShowPeek(false);
        setIsAdding(false);
        setAddedWords(new Set());
        lastAddKeyRef.current = null;
        addLockRef.current = false;
        lastAddAtRef.current = 0;
    }, [chunkId]);

    useEffect(() => {
        if (words.length > 0 && currentWordIndex >= words.length) {
            setCurrentWordIndex(0);
        }
    }, [words.length, currentWordIndex]);

    const handleNext = () => {
        if (isLastWord) {
            onComplete();
        } else {
            setCurrentWordIndex(prev => prev + 1);
            setShowPeek(false);
        }
    };

    const handleAddWord = async () => {
        if (!currentWord || isAdding || addLockRef.current) return { created: false, reason: 'busy' };

        const key = currentWord.word || currentWord.text || '';
        if (!key) return { created: false, reason: 'missing-key' };

        const now = Date.now();
        if (now - lastAddAtRef.current < 350) {
            return { created: false, reason: 'throttled' };
        }
        lastAddAtRef.current = now;

        // Guard against duplicate triggers on the same word
        if (lastAddKeyRef.current === key) {
            return { created: false, reason: 'duplicate-click' };
        }

        if (alreadyAdded) {
            return { created: false, reason: 'already-added' };
        }

        lastAddKeyRef.current = key;
        addLockRef.current = true;
        setIsAdding(true);

        try {
            const result = await onWordAction('add', currentWord);
            const stored = result?.created || result?.reason === 'duplicate';
            if (stored) {
                setAddedWords(prev => {
                    const next = new Set(prev);
                    next.add(key);
                    return next;
                });
            }
            return result || { created: false };
        } finally {
            setIsAdding(false);
            addLockRef.current = false;
        }
    };

    const handleSkipWord = () => {
        if (isAdding || addLockRef.current) return;
        handleNext();
    };

    // Peek Origin handlers
    const handlePeekStart = () => {
        setShowPeek(true);
        // Add global listeners to ensure we catch the release even if cursor moves off
        window.addEventListener('mouseup', handlePeekEndGlobal);
        window.addEventListener('touchend', handlePeekEndGlobal);
    };

    const handlePeekEndGlobal = () => {
        setShowPeek(false);
        window.removeEventListener('mouseup', handlePeekEndGlobal);
        window.removeEventListener('touchend', handlePeekEndGlobal);
    };

    const handlePeekEnd = () => {
        // Local handler just in case, but global covers it
        handlePeekEndGlobal();
    };

    // Show loading state while keywords are being fetched
    if (isLoadingWords) {
        return (
            <div className={styles.stepContent}>
                <div className={styles.stepHeader}>
                    <span className={styles.stepLabel}>Step 2</span>
                    <h3>Vocabulary Build</h3>
                    <p className={styles.stepDesc}>AI is analyzing text...</p>
                </div>

                {/* Skeleton Loading Cards */}
                <div className={styles.skeletonContainer}>
                    <div className={styles.skeletonCard}>
                        <div className={styles.skeletonWord}></div>
                        <div className={styles.skeletonPhonetic}></div>
                        <div className={styles.skeletonDefinition}></div>
                    </div>
                </div>

                <div className={styles.loadingSpinner}>
                    <div className="spinner"></div>
                    <p>🔍 Extracting key vocabulary<span className={styles.loadingDots}></span></p>
                </div>
            </div>
        );
    }

    if (isDeferred) {
        return (
            <div className={styles.stepContent}>
                <div className={styles.stepHeader}>
                    <span className={styles.stepLabel}>Step 2</span>
                    <h3>Vocabulary Build</h3>
                    <p className={styles.stepDesc}>Preparing word cards...</p>
                </div>

                <div className={styles.skeletonContainer}>
                    <div className={styles.skeletonCard}>
                        <div className={styles.skeletonWord}></div>
                        <div className={styles.skeletonPhonetic}></div>
                        <div className={styles.skeletonDefinition}></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!hasWords) {
        return (
            <div className={styles.stepContent}>
                <div className={styles.stepHeader}>
                    <span className={styles.stepLabel}>Step 2</span>
                    <h3>Vocabulary Build</h3>
                    <p className={styles.stepDesc}>No key words extracted for this chunk</p>
                </div>
                <button className="btn btn-primary" onClick={onComplete}>
                    Continue to next step →
                </button>
            </div>
        );
    }

    return (
        <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
                <span className={styles.stepLabel}>Step 2</span>
                <h3>Vocabulary Build</h3>
                <p className={styles.stepDesc}>
                    Word {currentWordIndex + 1} of {words.length}
                </p>
            </div>

            {/* Interactive Word Card Component */}
            <VocabularyCard
                word={currentWord}
                speak={speak}
                isTTSLoading={isLoading}
                onPeekStart={handlePeekStart}
                onPeekEnd={handlePeekEnd}
                isBilingual={isBilingual}
            />

            {/* Action buttons */}
            <div className={styles.wordActions}>
                <button
                    className="btn btn-secondary"
                    onClick={handleSkipWord}
                    disabled={isAdding}
                >
                    {alreadyAdded ? (isLastWord ? 'Finish →' : 'Next word →') : 'I know this'}
                </button>
                <AddButton onClick={handleAddWord} isBusy={isAdding} isAdded={alreadyAdded} />
            </div>


            {/* Peek Origin Overlay */}
            {showPeek && (
                <div className={styles.peekOverlay}>
                    <div className={styles.peekContent}>
                        <HighlightedText
                            text={currentWord.sentence}
                            highlight={currentWord.word}
                            highlightClassName={styles.highlight}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Step 3: Articulation - Pronunciation practice with sentences
 */
function Step3Articulation({ chunk, onComplete, isBilingual }) {
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
    const [translations, setTranslations] = useState(null); // null = not loaded yet
    const { speak, stop, isPlaying, isLoading, error } = useTTS();
    const lastChunkIdRef = useRef(null);

    // Get originalText safely
    const originalText = chunk?.originalText;
    const chunkId = chunk?.id;

    // Reset state when chunk changes (during render, not in effect)
    if (chunkId !== lastChunkIdRef.current) {
        lastChunkIdRef.current = chunkId;
        if (translations !== null) {
            setTranslations(null);
        }
        if (currentSentenceIndex !== 0) {
            setCurrentSentenceIndex(0);
        }
    }

    // Split chunk text into sentences - memoize to stabilize reference
    const sentences = useMemo(() => {
        if (!originalText) return [];
        return originalText
            .split(/(?<=[.!?])\s+/)
            .filter(s => s.trim().length > 0)
            .slice(0, 5); // Limit to 5 sentences
    }, [originalText]);

    // Derive loading state from data presence
    const isLoadingTranslations = translations === null && sentences.length > 0 && chunkId;

    // Fetch translations on mount
    useEffect(() => {
        if (!chunkId || sentences.length === 0) {
            return;
        }

        prefetchService.prefetchTranslations(chunkId, sentences)
            .then(result => setTranslations(result || []))
            .catch(() => setTranslations([])); // On error, set empty array
    }, [chunkId, sentences]);

    const currentSentence = sentences[currentSentenceIndex];
    const currentTranslation = translations?.[currentSentenceIndex];
    const isLast = currentSentenceIndex >= sentences.length - 1;

    const handleNext = () => {
        stop(); // Stop audio if playing
        if (isLast) {
            onComplete();
        } else {
            setCurrentSentenceIndex(prev => prev + 1);
        }
    };

    const handlePlay = () => {
        if (isPlaying) {
            stop();
        } else {
            speak(currentSentence);
        }
    };

    if (sentences.length === 0) {
        return (
            <div className={styles.stepContent}>
                <div className={styles.stepHeader}>
                    <span className={styles.stepLabel}>Step 3</span>
                    <h3>Articulation</h3>
                    <p className={styles.stepDesc}>No sentences to practice</p>
                </div>
                <button className="btn btn-primary" onClick={onComplete}>
                    Continue →
                </button>
            </div>
        );
    }

    return (
        <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
                <span className={styles.stepLabel}>Step 3</span>
                <h3>Articulation</h3>
                <p className={styles.stepDesc}>
                    Sentence {currentSentenceIndex + 1} of {sentences.length}
                </p>
            </div>

            {/* Thought Group Interactive Card */}
            <SentenceCard
                sentence={currentSentence}
                translation={currentTranslation || (isLoadingTranslations ? "Translating..." : "")}
                speak={speak}
                isBilingual={isBilingual}
            />

            <div className={styles.audioControls}>
                <button
                    className={`btn ${isPlaying ? 'btn-secondary' : 'btn-ghost'} ${styles.audioBtn}`}
                    onClick={handlePlay}
                    disabled={isLoading}
                    title={error ? `Error: ${error}` : "Listen to full sentence"}
                    style={{ opacity: 1, cursor: 'pointer' }}
                >
                    {isLoading ? '⏳' : isPlaying ? '⏹️ Stop Full' : '🔊 Full Sentence'}
                </button>
                {error && <span className={styles.errorText} style={{ color: 'red', fontSize: '12px', marginLeft: '10px' }}>⚠️ TTS Error</span>}
            </div>

            <button className="btn btn-primary btn-large" onClick={handleNext}>
                {isLast ? 'Continue to Flow Practice →' : 'Next Sentence →'}
            </button>
        </div>
    );
}

/**
 * Step 4: Flow Practice - Full paragraph reading
 */
function Step4FlowPractice({ chunk, onComplete }) {
    const [readingStarted, setReadingStarted] = useState(false);
    const [timer, setTimer] = useState(0);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        let interval;
        if (isRunning) {
            interval = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning]);

    const handleStartReading = () => {
        setReadingStarted(true);
        setIsRunning(true);
    };

    const handleStopReading = () => {
        setIsRunning(false);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Calculate approximate word count and WPM
    const wordCount = chunk.originalText?.split(/\s+/).length || 0;
    const wpm = timer > 0 ? Math.round((wordCount / timer) * 60) : 0;

    return (
        <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
                <span className={styles.stepLabel}>Step 4</span>
                <h3>Flow Practice</h3>
                <p className={styles.stepDesc}>
                    Read the full passage smoothly
                </p>
            </div>

            {!readingStarted ? (
                <div className={styles.flowIntro}>
                    <div className={styles.flowStats}>
                        <div className={styles.flowStat}>
                            <span className={styles.flowStatValue}>{wordCount}</span>
                            <span className={styles.flowStatLabel}>words</span>
                        </div>
                        <div className={styles.flowStat}>
                            <span className={styles.flowStatValue}>~{Math.ceil(wordCount / 150)}</span>
                            <span className={styles.flowStatLabel}>min</span>
                        </div>
                    </div>

                    <p className={styles.tipText}>
                        💡 Goal: Read the entire passage aloud without stopping.
                        Focus on maintaining a natural flow and connecting ideas.
                    </p>

                    <button className="btn btn-primary btn-large" onClick={handleStartReading}>
                        Start Reading 📖
                    </button>
                </div>
            ) : (
                <>
                    <div className={styles.flowTimer}>
                        <span className={styles.timerValue}>{formatTime(timer)}</span>
                        {timer > 0 && (
                            <span className={styles.wpmValue}>{wpm} WPM</span>
                        )}
                    </div>

                    <div className={styles.fullTextCard}>
                        <p className={styles.fullText}>{chunk.originalText}</p>
                    </div>

                    <div className={styles.flowActions}>
                        {isRunning ? (
                            <button className="btn btn-secondary" onClick={handleStopReading}>
                                ⏸️ Pause
                            </button>
                        ) : (
                            <button className="btn btn-secondary" onClick={() => setIsRunning(true)}>
                                ▶️ Resume
                            </button>
                        )}
                        <button className="btn btn-primary" onClick={onComplete}>
                            Complete Chunk ✓
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * Helper: Add Button with Feedback
 */
function AddButton({ onClick, isBusy = false, isAdded = false }) {
    const [justAdded, setJustAdded] = useState(false);
    const [isPressing, setIsPressing] = useState(false);
    const skipClickRef = useRef(false);
    const skipTimeoutRef = useRef(null);

    useEffect(() => {
        return () => {
            if (skipTimeoutRef.current) {
                clearTimeout(skipTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isBusy) {
            setIsPressing(false);
        }
    }, [isBusy]);

    const triggerAdd = async () => {
        if (isBusy || isAdded) return;
        setIsPressing(true);

        let stored = false;
        try {
            const result = await onClick?.();
            stored = result?.created || result?.reason === 'duplicate';
        } finally {
            if (stored) {
                setJustAdded(true);
                setTimeout(() => setJustAdded(false), 1500);
            }
            setIsPressing(false);
        }
    };

    const handlePointerDown = (e) => {
        if (isBusy || isAdded) return;
        if (e.button != null && e.button !== 0) return;
        e.preventDefault();

        skipClickRef.current = true;
        if (skipTimeoutRef.current) {
            clearTimeout(skipTimeoutRef.current);
        }
        skipTimeoutRef.current = setTimeout(() => {
            skipClickRef.current = false;
        }, 400);

        triggerAdd();
    };

    const handleClick = (e) => {
        if (skipClickRef.current) {
            e.preventDefault();
            return;
        }
        triggerAdd();
    };

    const showAdded = isAdded || justAdded;
    const showAdding = isBusy || isPressing;
    const disabled = showAdding || isAdded || justAdded;
    const label = showAdding ? 'Adding...' : (showAdded ? 'Added ✓' : 'Add to vocabulary');

    return (
        <button
            className={`btn ${showAdded ? 'btn-success' : 'btn-primary'}`}
            onPointerDown={handlePointerDown}
            onClick={handleClick}
            disabled={disabled}
            style={{
                backgroundColor: showAdded ? 'var(--color-success)' : undefined,
                borderColor: showAdded ? 'var(--color-success)' : undefined,
                transition: 'all 0.3s ease'
            }}
        >
            {label}
        </button>
    );
}
