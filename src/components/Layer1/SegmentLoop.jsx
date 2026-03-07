/**
 * Layer 1: Segment Loop Component
 * The 4-step reading loop for each chunk
 * Now with background prefetching support
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import styles from './SegmentLoop.module.css';
import { useTTS } from '../../hooks/useTTS';
import { prefetchService } from '../../services/prefetchService';
import { useAppStore } from '../../stores/appStore';
import VocabularyCard from './VocabularyCard';
import SentenceCard from './SentenceCard';

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
    onStepSet,
    onWordAction,
    onBack
}) {
    const toggleTheme = useAppStore(state => state.toggleTheme);
    const theme = useAppStore(state => state.theme);
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
            .catch(() => { });

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

        let cancel = () => { };
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
        let cancel = () => { };

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
                return <Step4FlowPractice chunk={chunk} words={words} onComplete={() => onStepComplete(4)} />;
            default:
                return null;
        }
    };

    return (
        <div className={`${styles.container} ${currentStep === 1 ? styles.containerStep1 : ''} ${theme === 'dark' ? `${styles.darkTheme} darkTheme` : ''}`}>
            {/* Header (Nav) */}
            <header className={`${styles.header} ${currentStep === 1 ? styles.headerStep1 : (currentStep === 2 ? styles.headerStep2 : '')}`}>
                <div className={styles.headerInner}>
                    <div className={styles.navLeft}>
                        <div className={styles.breadcrumb}>Global Map &gt; Chunk #1 &gt; Step {currentStep}</div>
                        <button className={styles.backLink} onClick={onBack}>
                            ← Back to Map
                        </button>
                    </div>

                    <h2 className={styles.chunkTitle}>
                        {currentStep === 1 ? "Macro Context Summary" : chunk.title}
                    </h2>

                    <div className={styles.topRight}>
                        <button
                            className={`${styles.themeToggle} ${theme === 'dark' ? styles.active : ''}`}
                            onClick={toggleTheme}
                        >
                            Theme
                        </button>
                        <button
                            className={`${styles.bilingualBtn} ${isBilingual ? styles.active : ''}`}
                            onClick={() => setIsBilingual(!isBilingual)}
                        >
                            中/EN
                        </button>
                    </div>
                </div>
            </header>

            {/* Step Tabs (Macro/Language) */}
            {currentStep <= 2 && (
                <div className={styles.stepTabsWrapper}>
                    <div className={styles.stepTabs}>
                        <button 
                            className={`${styles.stepTab} ${currentStep === 1 ? styles.activeTab : ''}`}
                            onClick={() => onStepSet?.(1)}
                        >
                            Step 1 · Macro Context
                        </button>
                        <button 
                            className={`${styles.stepTab} ${currentStep === 2 ? styles.activeTab : ''}`}
                            onClick={() => onStepSet?.(2)}
                        >
                            Step 2 · Baseline Language
                        </button>
                    </div>
                </div>
            )}

            {/* Step content */}
            <main className={`${styles.content} ${currentStep === 2 ? styles.contentStep2 : ''}`}>
                {renderStepContent()}
            </main>        </div>
    );
}

/**
 * Step 1: Macro Context - Summary overview
 */
function Step1MacroContext({ chunk, isBilingual, onComplete }) {
    return (
        <div className={styles.macroBody}>
            {/* Left Column: Primary Summary */}
            <div className={styles.primarySummary}>
                <div className={styles.macroKicker}>Macro Context</div>
                <h2 className={styles.macroMainTitle}>{chunk.title || "Macro Summary"}</h2>
                <div className={styles.macroMainBody}>
                    <p>{chunk.summary}</p>
                </div>

                <div className={styles.macroSpacer} />

                <div className={styles.macroCtaRow}>
                    <button className={`btn btn-secondary btn-large ${styles.actionBtn}`} onClick={() => window.history.back()}>
                        Explore Map
                    </button>
                    <button className={`btn btn-primary btn-large ${styles.actionBtn}`} onClick={onComplete}>
                        Build Vocabulary →
                    </button>
                </div>
            </div>

            {/* Right Column: Secondary & Tertiary Info */}
            <div className={styles.secondaryTertiary}>
                {isBilingual && chunk.summary_zh && (
                    <div className={styles.cnSummary}>
                        <div className={styles.columnLabel}>CN SUMMARY</div>
                        <p className={styles.cnText}>{chunk.summary_zh}</p>
                    </div>
                )}

                <div className={styles.originalPreviewCard}>
                    <div className={styles.columnLabel}>ORIGINAL PREVIEW</div>
                    <p className={styles.previewText}>
                        {chunk.originalText?.substring(0, 240)}
                        {chunk.originalText?.length > 240 ? '...' : ''}
                    </p>
                    <div className={styles.tertiaryStrip}>
                        <span>{chunk.originalText?.length || 0} characters</span>
                        <span>Full text below</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Step 2: Vocabulary Build - Key words with original context
 */
function Step2VocabularyBuild({ words, isLoading: isLoadingWords, onWordAction, onComplete, isBilingual, chunkId }) {
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [isDeferred, setIsDeferred] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [addedWords, setAddedWords] = useState(() => new Set());
    const vocabularyAutoNextOnAdd = useAppStore((state) => state.vocabularyAutoNextOnAdd);
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
        let cancel = () => { };

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
                if (vocabularyAutoNextOnAdd) {
                    handleNext();
                }
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



    // Show loading state while keywords are being fetched
    if (isLoadingWords) {
        return (
            <div className={`${styles.stepContent} ${styles.step2Content}`}>
                <div className={`${styles.stepHeader} ${styles.step2Header}`}>
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
            <div className={`${styles.stepContent} ${styles.step2Content}`}>
                <div className={`${styles.stepHeader} ${styles.step2Header}`}>
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
            <div className={`${styles.stepContent} ${styles.step2Content}`}>
                <div className={`${styles.stepHeader} ${styles.step2Header}`}>
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
        <div className={styles.step2Body}>
            <div className={styles.step2Header}>
                Word {currentWordIndex + 1} of {words.length}
            </div>

            {/* 1:1 Interactive Word Card (bHrtK / HF5Am) */}
            <VocabularyCard
                word={currentWord}
                speak={speak}
                isTTSLoading={isLoading}
                isBilingual={isBilingual}
            />

            {/* 1:1 Action buttons (Cf2ZK / KwbjZ) */}
            <div className={styles.wordActions}>
                <button
                    className={styles.knowBtn}
                    onClick={handleSkipWord}
                    disabled={isAdding}
                >
                    {alreadyAdded ? (isLastWord ? 'Finish →' : 'Next word →') : 'I know this'}
                </button>
                <button 
                    className={`${styles.addBtn} ${alreadyAdded ? styles.added : ''}`}
                    onClick={handleAddWord}
                    disabled={isAdding}
                >
                    {isAdding ? 'Adding...' : (alreadyAdded ? 'Added ✓' : 'Add to vocabulary')}
                </button>
            </div>
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

    // Reset state when chunk changes
    if (chunkId !== lastChunkIdRef.current) {
        lastChunkIdRef.current = chunkId;
        if (translations !== null) {
            setTranslations(null);
        }
        if (currentSentenceIndex !== 0) {
            setCurrentSentenceIndex(0);
        }
    }

    // Split chunk text into sentences
    const sentences = useMemo(() => {
        if (!originalText) return [];
        return originalText
            .split(/(?<=[.!?])\s+/)
            .filter(s => s.trim().length > 0)
            .slice(0, 5); // Limit to 5 sentences
    }, [originalText]);

    // Derive loading state
    const isLoadingTranslations = translations === null && sentences.length > 0 && chunkId;

    // Fetch translations
    useEffect(() => {
        if (!chunkId || sentences.length === 0) {
            return;
        }

        prefetchService.prefetchTranslations(chunkId, sentences)
            .then(result => setTranslations(result || []))
            .catch(() => setTranslations([]));
    }, [chunkId, sentences]);

    const currentSentence = sentences[currentSentenceIndex];
    const currentTranslation = translations?.[currentSentenceIndex];
    const isLast = currentSentenceIndex >= sentences.length - 1;

    const handleNext = () => {
        stop();
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
            <div className={styles.empty}>
                <p>No sentences to practice</p>
                <button className="btn btn-primary" onClick={onComplete}>
                    Continue →
                </button>
            </div>
        );
    }

    return (
        <div className={styles.articulationBody}>
            <div className={styles.stepInfo}>
                Sentence {currentSentenceIndex + 1} of {sentences.length}
            </div>

            {/* 1:1 Sentence Card (KUXuU / hcMLo) */}
            <SentenceCard
                sentence={currentSentence}
                translation={currentTranslation || (isLoadingTranslations ? "Translating..." : "")}
                speak={speak}
                isBilingual={isBilingual}
            />

            {/* 1:1 Action Rows (nHjs1 / wrgBa) */}
            <div className={styles.actionRowPrimary}>
                <button
                    className={`${styles.playCta} ${isPlaying ? styles.isPlaying : ''}`}
                    onClick={handlePlay}
                    disabled={isLoading}
                >
                    {isLoading ? 'Loading...' : (isPlaying ? 'Stop Audio' : 'Play Audio')}
                </button>
            </div>

            <div className={styles.actionRowSecondary}>
                <button className={styles.nextCta} onClick={handleNext}>
                    {isLast ? 'Complete Articulation ✓' : 'Next Sentence →'}
                </button>
            </div>

            {error && <div className={styles.errorBanner}>⚠️ {error}</div>}
        </div>
    );
}

/**
 * Step 4: Flow Practice - Immersive full-passage reading
 * Highlights vocabulary learned in Step 2 as "recall anchors"
 */
function Step4FlowPractice({ chunk, words = [], onComplete }) {
    // Split text into paragraphs for clean rendering
    const paragraphs = useMemo(() => {
        if (!chunk?.originalText) return [];
        return chunk.originalText
            .split(/\n\s*\n/)
            .map(p => p.trim())
            .filter(p => p.length > 0);
    }, [chunk.originalText]);

    // Build a set of learned word texts for highlighting
    const learnedWords = useMemo(() => {
        return words
            .map(w => w.word || w.text)
            .filter(Boolean);
    }, [words]);

    // Render paragraph text with vocabulary highlights
    const renderWithHighlights = (text) => {
        if (learnedWords.length === 0) return text;

        // Build regex matching any learned word (word-boundary, case-insensitive)
        const escaped = learnedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

        const parts = text.split(regex);
        if (parts.length === 1) return text;

        const lowerSet = new Set(learnedWords.map(w => w.toLowerCase()));

        return parts.map((part, i) => {
            if (lowerSet.has(part.toLowerCase())) {
                return <mark key={i} className={styles.flowHighlight}>{part}</mark>;
            }
            return part;
        });
    };

    return (
        <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
                <span className={styles.stepLabel}>Step 4</span>
                <h3>Flow Practice</h3>
                <p className={styles.stepDesc}>
                    Read the full passage — words you've learned are highlighted
                </p>
            </div>

            <div className={styles.flowPassage}>
                {paragraphs.map((para, idx) => (
                    <p key={idx} className={styles.flowParagraph}>
                        {renderWithHighlights(para)}
                    </p>
                ))}
            </div>

            <button className="btn btn-primary btn-large" onClick={onComplete}>
                Complete Chunk ✓
            </button>
        </div>
    );
}

/**
 * Helper: Add Button with Feedback
 */
function AddButton({ onClick, isBusy = false, isAdded = false, className = '' }) {
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
            className={`btn ${showAdded ? 'btn-success' : 'btn-primary'} ${className}`}
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
