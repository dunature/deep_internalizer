/**
 * Layer 1: Segment Loop Component
 * The 4-step reading loop for each chunk
 */
import { useState, useEffect } from 'react';
import styles from './SegmentLoop.module.css';
import { useTTS } from '../../hooks/useTTS';

const STEPS = [
    { id: 1, name: 'Macro Context', icon: '📖' },
    { id: 2, name: 'Vocabulary Build', icon: '📝' },
    { id: 3, name: 'Articulation', icon: '🎤' },
    { id: 4, name: 'Flow Practice', icon: '🔊' }
];

export default function SegmentLoop({
    chunk,
    words = [],
    currentStep,
    onStepComplete,
    onWordAction,
    onBack
}) {


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
                return <Step1MacroContext chunk={chunk} onComplete={() => onStepComplete(1)} />;
            case 2:
                return (
                    <Step2VocabularyBuild
                        words={words}
                        onWordAction={onWordAction}
                        onComplete={() => onStepComplete(2)}
                    />
                );
            case 3:
                return <Step3Articulation chunk={chunk} onComplete={() => onStepComplete(3)} />;
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
function Step1MacroContext({ chunk, onComplete }) {
    return (
        <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
                <span className={styles.stepLabel}>Step 1</span>
                <h3>Macro Context</h3>
                <p className={styles.stepDesc}>Read the summary to understand the big picture</p>
            </div>

            <div className={styles.summaryCard}>
                <p className={styles.summary}>{chunk.summary}</p>
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
/**
 * Step 2: Vocabulary Build - Key words with original context
 */
function Step2VocabularyBuild({ words, onWordAction, onComplete }) {
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [showPeek, setShowPeek] = useState(false);
    const { speak, isPlaying, isLoading } = useTTS();

    const currentWord = words[currentWordIndex];
    const hasWords = words.length > 0;
    const isLastWord = currentWordIndex >= words.length - 1;

    const handleNext = () => {
        if (isLastWord) {
            onComplete();
        } else {
            setCurrentWordIndex(prev => prev + 1);
            setShowPeek(false);
        }
    };

    const handleAddWord = () => {
        if (currentWord) {
            onWordAction('add', currentWord);
            handleNext();
        }
    };

    const handleSkipWord = () => {
        handleNext();
    };

    const handlePlayWord = (e) => {
        e.stopPropagation();
        if (currentWord) {
            speak(currentWord.word);
        }
    };

    // Long press handlers for Peek Origin
    const handlePeekStart = () => {
        setShowPeek(true);
    };

    const handlePeekEnd = () => {
        setShowPeek(false);
    };

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

            {/* Word Card */}
            <div className={styles.wordCard}>
                <div className={styles.wordMain}>
                    <span className={styles.wordText}>{currentWord.word}</span>
                    <button
                        className={`btn btn-ghost ${styles.wordAudioBtn}`}
                        onClick={handlePlayWord}
                        disabled={isLoading}
                        title="Listen to pronunciation"
                        style={{ marginLeft: '10px' }}
                    >
                        {isLoading && isPlaying ? '⏳' : '🔊'}
                    </button>
                    <span className={styles.phonetic}>{currentWord.phonetic}</span>
                </div>
                <p className={styles.definition}>{currentWord.definition}</p>

                {/* Peek Origin Button */}
                <button
                    className={styles.peekButton}
                    onMouseDown={handlePeekStart}
                    onMouseUp={handlePeekEnd}
                    onMouseLeave={handlePeekEnd}
                    onTouchStart={handlePeekStart}
                    onTouchEnd={handlePeekEnd}
                >
                    👁️ Hold to see original context
                </button>
            </div>

            {/* Action buttons */}
            <div className={styles.wordActions}>
                <button
                    className="btn btn-secondary"
                    onClick={handleSkipWord}
                >
                    I know this
                </button>
                <button
                    className="btn btn-primary"
                    onClick={handleAddWord}
                >
                    Add to vocabulary
                </button>
            </div>

            {/* Peek Origin Overlay */}
            {showPeek && (
                <div className={styles.peekOverlay}>
                    <div className={styles.peekContent}>
                        <HighlightedSentence
                            text={currentWord.sentence}
                            highlight={currentWord.word}
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
function Step3Articulation({ chunk, onComplete }) {
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
    const { speak, stop, isPlaying, isLoading, error } = useTTS();

    // Split chunk text into sentences
    const sentences = chunk.originalText
        ?.split(/(?<=[.!?])\s+/)
        .filter(s => s.trim().length > 0)
        .slice(0, 5) || []; // Limit to 5 sentences

    const currentSentence = sentences[currentSentenceIndex];
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

            <div className={styles.sentenceCard}>
                <p className={styles.sentenceText}>{currentSentence}</p>

                <div className={styles.audioControls}>
                    <button
                        className={`btn ${isPlaying ? 'btn-secondary' : 'btn-ghost'} ${styles.audioBtn}`}
                        onClick={handlePlay}
                        disabled={isLoading}
                        title={error ? `Error: ${error}` : "Listen to pronunciation"}
                    >
                        {isLoading ? '⏳ Loading...' : isPlaying ? '⏹️ Stop' : '🔊 Listen'}
                    </button>
                    {error && <span className={styles.errorText} style={{ color: 'red', fontSize: '12px', marginLeft: '10px' }}>⚠️ TTS Error</span>}

                    <button className={`btn btn-ghost ${styles.audioBtn}`} title="Record (Coming soon)">
                        🎙️ Record
                    </button>
                    <button className={`btn btn-ghost ${styles.audioBtn}`} title="Slow playback (Coming soon)">
                        🐢 Slow
                    </button>
                </div>

                <p className={styles.tipText}>
                    💡 Tip: Read the sentence aloud 3 times, focusing on rhythm and stress patterns
                </p>
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
 * Helper: Highlight word in sentence
 */
function HighlightedSentence({ text, highlight }) {
    if (!text || !highlight) return <p>{text}</p>;

    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);

    return (
        <p>
            {parts.map((part, i) =>
                part.toLowerCase() === highlight.toLowerCase()
                    ? <mark key={i} className={styles.highlight}>{part}</mark>
                    : part
            )}
        </p>
    );
}
