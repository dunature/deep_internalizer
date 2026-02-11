/**
 * TTS Service with Caching and Prefetching
 * - speakWord: cached in IndexedDB (words repeat across documents)
 * - speakSyllable: cached for common syllables only
 * - speakSentence: not cached (sentences are unique)
 */
import { db } from '../db/schema';

const API_URL = import.meta.env.VITE_TTS_API_URL || 'http://localhost:8000/v1/audio/speech';

// Common syllables that should be cached
const COMMON_SYLLABLES = new Set([
    'tion', 'sion', 'ing', 'ness', 'ment', 'able', 'ible',
    'pre', 'pro', 'con', 'dis', 'un', 're', 'ly', 'ful',
    'less', 'ous', 'ive', 'al', 'er', 'est', 'ed', 'en'
]);

const MAX_WORD_CACHE_SIZE = 500;

class TTSService {
    constructor() {
        // Track in-flight requests to prevent duplicates
        this.inFlightRequests = new Map();
        this.inFlightPrefetch = new Map();
    }

    /**
     * Fetch audio from TTS server
     */
    async fetchFromServer(text, voice = 'default', speed = 1.0) {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen3-tts',
                input: text,
                voice: voice,
                speed: speed,
                response_format: 'wav'
            })
        });

        if (!response.ok) {
            throw new Error(`TTS API Error: ${response.statusText}`);
        }

        return await response.blob();
    }

    /**
     * Speak a word - WITH CACHING
     */
    async speakWord(word, voice = 'default', retries = 2) {
        const cacheKey = word.toLowerCase();

        try {
            // 1. Check IndexedDB cache
            const cached = await db.wordAudio.get(cacheKey);
            if (cached) {
                console.log(`[TTS] Cache hit: "${word}"`);
                return URL.createObjectURL(cached.blob);
            }

            // 2. Check if request is already in-flight
            if (this.inFlightRequests.has(cacheKey)) {
                console.log(`[TTS] Waiting for in-flight: "${word}"`);
                return this.inFlightRequests.get(cacheKey);
            }

            // 2.5 If a prefetch is in-flight, wait for it and retry cache
            if (this.inFlightPrefetch.has(cacheKey)) {
                console.log(`[TTS] Waiting for prefetch: "${word}"`);
                await this.inFlightPrefetch.get(cacheKey);
                const prefetched = await db.wordAudio.get(cacheKey);
                if (prefetched) {
                    return URL.createObjectURL(prefetched.blob);
                }
            }

            // 3. Fetch and cache
            const promise = this._fetchAndCacheWord(cacheKey, voice);
            this.inFlightRequests.set(cacheKey, promise);

            try {
                return await promise;
            } finally {
                this.inFlightRequests.delete(cacheKey);
            }
        } catch (error) {
            if (retries > 0) {
                console.log(`[TTS] Retry "${word}" (${retries} left)`);
                await this._delay(500);
                return this.speakWord(word, voice, retries - 1);
            }
            throw error;
        }
    }

    async _fetchAndCacheWord(word, voice) {
        console.log(`[TTS] Fetching: "${word}"`);
        const blob = await this.fetchFromServer(word, voice);

        // Store in cache
        await db.wordAudio.put({
            word: word,
            blob: blob,
            createdAt: Date.now()
        });

        // Trigger cache cleanup if needed (non-blocking)
        this._cleanupCacheIfNeeded();

        return URL.createObjectURL(blob);
    }

    async _fetchAndCacheWordBlob(word, voice) {
        console.log(`[TTS] Prefetching: "${word}"`);
        const blob = await this.fetchFromServer(word, voice);

        await db.wordAudio.put({
            word: word,
            blob: blob,
            createdAt: Date.now()
        });

        this._cleanupCacheIfNeeded();
    }

    /**
     * Prefetch a word without creating an object URL
     */
    async prefetchWord(word, voice = 'default') {
        const cacheKey = word.toLowerCase();

        const cached = await db.wordAudio.get(cacheKey);
        if (cached) {
            return;
        }

        if (this.inFlightRequests.has(cacheKey)) {
            await this.inFlightRequests.get(cacheKey);
            return;
        }

        if (this.inFlightPrefetch.has(cacheKey)) {
            await this.inFlightPrefetch.get(cacheKey);
            return;
        }

        const promise = this._fetchAndCacheWordBlob(cacheKey, voice);
        this.inFlightPrefetch.set(cacheKey, promise);

        try {
            await promise;
        } finally {
            this.inFlightPrefetch.delete(cacheKey);
        }
    }

    /**
     * Speak a syllable - CACHED ONLY FOR COMMON SYLLABLES
     */
    async speakSyllable(syllableText, speed = 0.7) {
        const text = syllableText.toLowerCase();
        const shouldCache = COMMON_SYLLABLES.has(text);

        if (shouldCache) {
            // Check cache
            const cached = await db.syllableAudio.get(text);
            if (cached) {
                console.log(`[TTS] Syllable cache hit: "${text}"`);
                return URL.createObjectURL(cached.blob);
            }

            // Check in-flight
            const inFlightKey = `syllable:${text}`;
            if (this.inFlightRequests.has(inFlightKey)) {
                return this.inFlightRequests.get(inFlightKey);
            }

            // Fetch and cache
            const promise = (async () => {
                const blob = await this.fetchFromServer(text, 'default', speed);
                await db.syllableAudio.put({
                    syllable: text,
                    blob: blob,
                    createdAt: Date.now()
                });
                return URL.createObjectURL(blob);
            })();

            this.inFlightRequests.set(inFlightKey, promise);
            try {
                return await promise;
            } finally {
                this.inFlightRequests.delete(inFlightKey);
            }
        }

        // Not a common syllable - don't cache
        const blob = await this.fetchFromServer(text, 'default', speed);
        return URL.createObjectURL(blob);
    }

    /**
     * Speak a sentence - NO CACHING (sentences are unique)
     */
    async speakSentence(sentence, voice = 'default') {
        console.log(`[TTS] Sentence (no cache): "${sentence.substring(0, 30)}..."`);
        const blob = await this.fetchFromServer(sentence, voice);
        return URL.createObjectURL(blob);
    }

    /**
     * Prefetch audio for words (non-blocking)
     */
    prefetchWords(words) {
        words.forEach(word => {
            // Don't await - fire and forget
            this.prefetchWord(word).catch(e => {
                console.warn(`[TTS] Prefetch failed for "${word}":`, e.message);
            });
        });
    }

    /**
     * LRU cleanup: keep only MAX_WORD_CACHE_SIZE entries
     */
    async _cleanupCacheIfNeeded() {
        try {
            const count = await db.wordAudio.count();
            if (count > MAX_WORD_CACHE_SIZE) {
                const toDelete = count - MAX_WORD_CACHE_SIZE;
                const oldest = await db.wordAudio
                    .orderBy('createdAt')
                    .limit(toDelete)
                    .toArray();

                await db.wordAudio.bulkDelete(oldest.map(o => o.word));
                console.log(`[TTS] Cleaned up ${toDelete} old cache entries`);
            }
        } catch (e) {
            console.warn('[TTS] Cache cleanup failed:', e);
        }
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Legacy method for backward compatibility
    async generateAudio(text, voice = 'default') {
        // Treat as sentence (no caching) for generic calls
        return this.speakSentence(text, voice);
    }
}

export const ttsService = new TTSService();
