/**
 * Prefetch Service - Background loading for keywords and TTS
 * Manages in-flight prefetch requests with AbortController support
 */
import { db } from '../db/schema';
import { extractKeywords, translateSentences } from './chunkingService';
import { ttsService } from './ttsService';

class PrefetchService {
    constructor() {
        // Track pending prefetch operations
        this.pendingKeywords = new Map(); // chunkId -> { promise, abort }
        this.pendingTranslations = new Map(); // chunkId -> { promise, abort }

        // TTS prefetch queue controls
        this.ttsQueue = [];
        this.ttsQueued = new Set();
        this.ttsInFlight = 0;
        this.ttsConcurrency = 3;
        this.ttsMaxPerChunk = 12;
    }

    /**
     * Start keyword prefetch for a chunk
     * Returns cached data if available, otherwise fetches in background
     */
    async prefetchKeywords(chunkId, chunkText, signal = null) {
        // 1. Check if already cached in DB
        const cached = await db.chunkKeywords.get(chunkId);
        if (cached) {
            console.log(`[Prefetch] Keywords cache hit: ${chunkId}`);
            return cached.keywords;
        }

        // 2. Check if already prefetching
        if (this.pendingKeywords.has(chunkId)) {
            console.log(`[Prefetch] Already fetching: ${chunkId}`);
            return this.pendingKeywords.get(chunkId).promise;
        }

        // 3. Start new prefetch
        const controller = new AbortController();
        const combinedSignal = signal
            ? this._combineSignals(signal, controller.signal)
            : controller.signal;

        const promise = this._fetchAndCacheKeywords(chunkId, chunkText, combinedSignal);

        this.pendingKeywords.set(chunkId, {
            promise,
            abort: () => controller.abort()
        });

        try {
            const result = await promise;
            return result;
        } finally {
            this.pendingKeywords.delete(chunkId);
        }
    }

    async _fetchAndCacheKeywords(chunkId, chunkText, signal) {
        console.log(`[Prefetch] Fetching keywords: ${chunkId}`);
        const keywords = await extractKeywords(chunkText, undefined, signal);

        // Cache in DB
        await db.chunkKeywords.put({ chunkId, keywords });
        console.log(`[Prefetch] Cached ${keywords.length} keywords for: ${chunkId}`);

        return keywords;
    }

    /**
     * Start translation prefetch for a chunk
     */
    async prefetchTranslations(chunkId, sentences, signal = null) {
        if (!sentences || sentences.length === 0) return [];

        // 1. Check if already cached in DB
        const cached = await db.sentenceTranslations.get(chunkId);
        if (cached) {
            console.log(`[Prefetch] Translations cache hit: ${chunkId}`);
            return cached.translations;
        }

        // 2. Check if already prefetching
        if (this.pendingTranslations.has(chunkId)) {
            return this.pendingTranslations.get(chunkId).promise;
        }

        // 3. Start new prefetch
        const controller = new AbortController();
        const combinedSignal = signal
            ? this._combineSignals(signal, controller.signal)
            : controller.signal;

        const promise = this._fetchAndCacheTranslations(chunkId, sentences, combinedSignal);

        this.pendingTranslations.set(chunkId, {
            promise,
            abort: () => controller.abort()
        });

        try {
            return await promise;
        } finally {
            this.pendingTranslations.delete(chunkId);
        }
    }

    async _fetchAndCacheTranslations(chunkId, sentences, signal) {
        console.log(`[Prefetch] Fetching translations: ${chunkId}`);
        const translations = await translateSentences(sentences, undefined, signal);

        // Cache in DB
        await db.sentenceTranslations.put({ chunkId, translations });
        console.log(`[Prefetch] Cached ${translations.length} translations for: ${chunkId}`);

        return translations;
    }

    /**
     * Prefetch TTS for all words in a chunk (non-blocking)
     */
    prefetchTTSForWords(words) {
        if (!words || words.length === 0) return;

        const wordTexts = words.map(w => w.word || w.text).filter(Boolean);
        const unique = Array.from(new Set(wordTexts)).slice(0, this.ttsMaxPerChunk);
        if (unique.length === 0) return;

        console.log(`[Prefetch] TTS prefetch queued for ${unique.length} words`);
        unique.forEach(word => {
            if (this.ttsQueued.has(word)) return;
            this.ttsQueued.add(word);
            this.ttsQueue.push(word);
        });

        this._drainTTSQueue();
    }

    /**
     * Cancel any pending prefetch for a chunk
     */
    cancelPrefetch(chunkId) {
        const pending = this.pendingKeywords.get(chunkId);
        if (pending) {
            pending.abort();
            this.pendingKeywords.delete(chunkId);
            console.log(`[Prefetch] Cancelled: ${chunkId}`);
        }
    }

    /**
     * Cancel all pending prefetches
     */
    cancelAll() {
        for (const [, pending] of this.pendingKeywords) {
            pending.abort();
        }
        for (const [, pending] of this.pendingTranslations) {
            pending.abort();
        }
        this.pendingKeywords.clear();
        this.pendingTranslations.clear();
    }

    /**
     * Check if keywords are available (cached or prefetched)
     */
    async getKeywordsIfReady(chunkId) {
        const cached = await db.chunkKeywords.get(chunkId);
        return cached ? cached.keywords : null;
    }

    _drainTTSQueue() {
        while (this.ttsInFlight < this.ttsConcurrency && this.ttsQueue.length > 0) {
            const word = this.ttsQueue.shift();
            this.ttsInFlight += 1;

            ttsService.prefetchWord(word)
                .catch(e => {
                    console.warn(`[Prefetch] TTS failed for "${word}":`, e.message);
                })
                .finally(() => {
                    this.ttsInFlight -= 1;
                    this.ttsQueued.delete(word);
                    if (this.ttsQueue.length > 0) {
                        this._drainTTSQueue();
                    }
                });
        }
    }

    /**
     * Combine two abort signals
     */
    _combineSignals(signal1, signal2) {
        const controller = new AbortController();

        const onAbort = () => controller.abort();
        signal1.addEventListener('abort', onAbort);
        signal2.addEventListener('abort', onAbort);

        return controller.signal;
    }
}

export const prefetchService = new PrefetchService();
