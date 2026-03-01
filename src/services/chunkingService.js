/**
 * Deep Internalizer - AI Chunking Service
 * Integrates with local Ollama API for semantic text chunking
 *
 * DEPRECATION NOTICE:
 * This module is a fallback for when Bridge Server is unavailable.
 * Primary document analysis should go through Bridge Server's /api/content/analyze.
 * The core analysis prompts (CHUNKING_SYSTEM_PROMPT, DOCUMENT_SUMMARY_PROMPT, CORE_THESIS_PROMPT)
 * have been moved to bridge/services/aiProcessor.js to enforce Single Source of Truth.
 *
 * Functions in this file that call LLM for document-level analysis are deprecated:
 * - generateDocumentSummary() - deprecated, use bridgeClient.analyzeContent()
 * - chunkDocument() - deprecated, use bridgeClient.analyzeContent()
 * - generateCoreThesis() - deprecated, use bridgeClient.analyzeContent()
 *
 * Functions that remain (vocabulary/sentence-level processing):
 * - extractKeywords() - active (vocabulary extraction per chunk)
 * - splitSentenceIntoGroups() - active (thought groups for pronunciation)
 * - translateSentences() - active (sentence translation)
 */

import { getThoughtGroupsCache, setThoughtGroupsCache } from '../db/schema';
import { hashText } from '../utils/hash';
import { callLLM, getLLMConfig } from './llmClient';

// Note: CHUNKING_SYSTEM_PROMPT and DOCUMENT_SUMMARY_PROMPT have been moved to bridge/services/aiProcessor.js
// to enforce a Single Source of Truth for document analysis prompts.

// System prompt for keyword extraction
const KEYWORD_EXTRACTION_PROMPT = `You are a vocabulary extraction assistant for English learners.
Extract 5-8 key vocabulary words from this paragraph.

For each word provide:
- word: the word itself
- phonetic: IPA transcription (use full word transcription)
- pos: part of speech (e.g., n., v., adj., adv., phr.)
- slices: split the word into logical syllable blocks. Output as an array of tuples: [["text", "ipa"], ...].
    - text: the character slice
    - ipa: the IPA transcription for JUST that slice
- definition: brief definition in English (20 words max)
- definition_zh: brief definition in Chinese (7 words max)
- newContext: a NEW example sentence using the word (different from the original sentence), preferably from a real-world context.

Output ONLY valid JSON array:
[
  {
    "word": "aggregate",
    "phonetic": "/ˈæɡrɪɡeɪt/",
    "pos": "v.",
    "slices": [
      ["ag", "ˈæɡ"],
      ["gre", "rɪ"],
      ["gate", "ɡeɪt"]
    ],
    "definition": "to collect or gather into a whole",
    "definition_zh": "集合；合计",
    "newContext": "We need to aggregate the data from multiple sources to get a clear picture."
  }
]

Prioritize:
1. Domain-specific or technical terms
2. Advanced vocabulary (CEFR B2+)
3. Words crucial to understanding the argument
4. Skip common words (the, is, have, etc.)`;

/**
 * Tokenize text into sentences
 */
function tokenizeSentences(text) {
    // Simple sentence tokenization (can be improved)
    const sentences = text
        .replace(/([.!?])\s+/g, '$1|')
        .split('|')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    return sentences;
}

/**
 * Call Ollama API with optional AbortController support
 * @param {string} prompt - The prompt to send
 * @param {string} model - The model to use
 * @param {AbortSignal} signal - Optional AbortSignal for cancellation
 */
async function callProviderLLM({ system, user, model, signal, temperature = 0.3, maxTokens = 2048 }) {
    try {
        return await callLLM({
            system,
            user,
            temperature,
            maxTokens,
            signal,
            model
        });
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('[LLM] Request was cancelled');
            throw error;
        }
        console.error('LLM API call failed:', error);
        throw error;
    }
}

/**
 * Parse JSON from LLM response (handles markdown code blocks)
 */
function parseJsonResponse(response) {
    // Remove markdown code blocks if present
    let cleaned = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

    // Find JSON array boundaries
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');

    if (start === -1 || end === -1) {
        throw new Error('No valid JSON array found in response');
    }

    cleaned = cleaned.substring(start, end + 1);
    return JSON.parse(cleaned);
}

/**
 * Chunk a document into semantic segments
 * @param {string} text - The text to chunk
 * @param {string} model - The model to use
 * @param {AbortSignal} signal - Optional AbortSignal for cancellation
 */
export async function generateDocumentSummary(text, model, signal = null) {
    throw new Error('generateDocumentSummary is deprecated in chunkingService.js. Use bridgeClient.analyzeContent instead.');
}

export async function chunkDocument(text, model, signal = null, documentSummary = '') {
    throw new Error('chunkDocument is deprecated in chunkingService.js. Use bridgeClient.analyzeContent instead.');
}

/**
 * Extract keywords from a chunk
 * @param {string} chunkText - The text to extract keywords from
 * @param {string} model - The model to use
 * @param {AbortSignal} signal - Optional AbortSignal for cancellation
 */
export async function extractKeywords(chunkText, model, signal = null) {
    const resolvedModel = model || getLLMConfig().model;
    const user = `Paragraph:
${chunkText}`;

    const response = await callProviderLLM({
        system: KEYWORD_EXTRACTION_PROMPT,
        user,
        model: resolvedModel,
        signal
    });
    const rawKeywords = parseJsonResponse(response);

    // Post-process: Transform tuple slices and fill sentence
    const sentences = tokenizeSentences(chunkText);

    return rawKeywords.map(word => {
        // 1. Transform Slices: [["ag", "ipa"]] -> [{text: "ag", phonetic: "ipa"}]
        if (Array.isArray(word.slices) && Array.isArray(word.slices[0])) {
            word.slices = word.slices.map(tuple => ({
                text: tuple[0],
                phonetic: tuple[1] || '' // Allow empty if missing
            }));
        }

        // 2. Find Sentence
        if (!word.sentence) {
            // Simple robust matching: find first sentence containing the word (case-insensitive)
            const target = word.word.toLowerCase();
            const matchedSentence = sentences.find(s =>
                s.toLowerCase().includes(target)
            );
            word.sentence = matchedSentence || chunkText.substring(0, 100) + "..."; // Fallback
        }

        return word;
    });
}

// generateNewContext is deprecated as it's now merged into extractKeywords for performance
// Kept commented out for reference or fallback if needed
// export async function generateNewContext(word, definition, model, signal = null) { ... }

const THOUGHT_GROUP_PROMPT = `You are a linguistic expert specializing in English prosody and syntax.
Your task is to divide a given sentence into "Thought Groups" (semantic chunks) to help learners with phrasing and rhythm.

Rules:
- Divide based on natural pauses, grammatical boundaries, and meaningful units.
- Each group should be 2-5 words.
- Provide a brief "focus hint" for each group (e.g., "subject", "action", "detail").

Output ONLY valid JSON array:
[
  {
    "text": "The rapid advancement",
    "hint": "subject"
  },
  {
    "text": "of artificial intelligence",
    "hint": "modifier"
  }
]`;

/**
 * Split a sentence into semantic thought groups
 * @param {string} sentence - The sentence to split
 * @param {string} model - The model to use
 * @param {AbortSignal} signal - Optional AbortSignal for cancellation
 */
export async function splitSentenceIntoGroups(sentence, model, signal = null) {
    const resolvedModel = model || getLLMConfig().model;
    let cacheKey = '';
    try {
        cacheKey = await hashText(`${resolvedModel}|${sentence}`);
        if (cacheKey) {
            const cached = await getThoughtGroupsCache(cacheKey);
            if (cached?.groups && Array.isArray(cached.groups) && cached.groups.length > 0) {
                return cached.groups;
            }
        }
    } catch (error) {
        console.warn('[Cache] Thought groups lookup failed:', error);
    }

    const user = `Sentence:
${sentence}`;

    const response = await callProviderLLM({
        system: THOUGHT_GROUP_PROMPT,
        user,
        model: resolvedModel,
        signal
    });
    const groups = parseJsonResponse(response);

    if (cacheKey && Array.isArray(groups) && groups.length > 0) {
        setThoughtGroupsCache(cacheKey, groups, resolvedModel)
            .catch((error) => console.warn('[Cache] Thought groups store failed:', error));
    }

    return groups;
}

/**
 * Generate core thesis from document
 * @param {string} text - The text to summarize
 * @param {string} model - The model to use
 * @param {AbortSignal} signal - Optional AbortSignal for cancellation
 */
export async function generateCoreThesis(text, model, signal = null) {
    throw new Error('generateCoreThesis is deprecated in chunkingService.js. Use bridgeClient.analyzeContent instead.');
}

/**
 * Translate an array of sentences
 * @param {string[]} sentences - The sentences to translate
 * @param {string} model - The model to use
 * @param {AbortSignal} signal - Optional AbortSignal for cancellation
 */
export async function translateSentences(sentences, model, signal = null) {
    if (!sentences || sentences.length === 0) return [];
    const resolvedModel = model || getLLMConfig().model;
    const system = `You are a professional translator.
Translate the following English sentences into natural, accurate Chinese.
Return ONLY a JSON array of strings, in the same order as the input.
`;
    const user = `Sentences:
${JSON.stringify(sentences)}

Output Format:
["翻译1", "翻译2", ...]`;

    const response = await callProviderLLM({
        system,
        user,
        model: resolvedModel,
        signal
    });
    return parseJsonResponse(response);
}

export default {
    chunkDocument,
    extractKeywords,
    translateSentences,
    generateCoreThesis,
    generateDocumentSummary
};
