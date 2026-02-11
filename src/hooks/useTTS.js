/**
 * useTTS Hook - React hook for TTS with caching support
 * Uses the new ttsService with word/syllable caching
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { ttsService } from '../services/ttsService';

export function useTTS() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const audioRef = useRef(new Audio());

    // Cleanup on unmount
    useEffect(() => {
        const audio = audioRef.current;
        return () => {
            audio.pause();
            audio.src = '';
        };
    }, []);

    /**
     * Speak text - automatically chooses caching strategy
     * @param {string} text - Text to speak
     * @param {object} options - { speed, voice, type: 'word'|'syllable'|'sentence' }
     */
    const speak = useCallback(async (text, options = {}) => {
        if (!text) return;
        const { speed = 1.0, voice = 'default', type = 'auto' } = options;

        try {
            setIsLoading(true);
            setError(null);

            let audioUrl;

            // Determine type automatically if not specified
            const textType = type === 'auto'
                ? (text.includes(' ') ? 'sentence' : (text.length <= 5 ? 'syllable' : 'word'))
                : type;

            switch (textType) {
                case 'syllable':
                    audioUrl = await ttsService.speakSyllable(text, speed);
                    break;
                case 'sentence':
                    audioUrl = await ttsService.speakSentence(text, voice);
                    break;
                case 'word':
                default:
                    audioUrl = await ttsService.speakWord(text, voice);
                    break;
            }

            const audio = audioRef.current;
            audio.src = audioUrl;
            audio.playbackRate = speed;

            // Setup listeners
            audio.onplay = () => setIsPlaying(true);
            audio.onended = () => setIsPlaying(false);
            audio.onerror = (e) => {
                console.error("Audio playback error", e);
                setIsPlaying(false);
                setError("Playback failed");
            };

            // Play
            await audio.play();
        } catch (err) {
            setError(err.message || 'Failed to generate speech');
            setIsPlaying(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Speak a word (with caching)
     */
    const speakWord = useCallback(async (word, options = {}) => {
        return speak(word, { ...options, type: 'word' });
    }, [speak]);

    /**
     * Speak a syllable (cached for common syllables)
     */
    const speakSyllable = useCallback(async (syllable, options = {}) => {
        return speak(syllable, { ...options, type: 'syllable', speed: options.speed || 0.7 });
    }, [speak]);

    /**
     * Speak a sentence (no caching)
     */
    const speakSentence = useCallback(async (sentence, options = {}) => {
        return speak(sentence, { ...options, type: 'sentence' });
    }, [speak]);

    const stop = useCallback(() => {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
    }, []);

    return {
        speak,
        speakWord,
        speakSyllable,
        speakSentence,
        stop,
        isPlaying,
        isLoading,
        error
    };
}
