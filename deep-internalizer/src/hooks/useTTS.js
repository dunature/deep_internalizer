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

    const speak = useCallback(async (text) => {
        if (!text) return;

        try {
            setIsLoading(true);
            setError(null);

            // Generate audio URL
            const audioUrl = await ttsService.generateAudio(text);

            const audio = audioRef.current;
            audio.src = audioUrl;

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

    const stop = useCallback(() => {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
    }, []);

    return {
        speak,
        stop,
        isPlaying,
        isLoading,
        error
    };
}
