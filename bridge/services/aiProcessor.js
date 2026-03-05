/**
 * AI Processor — Node.js version
 *
 * PRIMARY DOCUMENT ANALYSIS SERVICE
 *
 * This is the Single Source of Truth for all document-level analysis prompts:
 * - CHUNKING_SYSTEM_PROMPT (semantic chunking)
 * - CORE_THESIS_PROMPT (core thesis extraction)
 * - DOCUMENT_SUMMARY_PROMPT (document summary for chunking guidance)
 *
 * The frontend chunkingService.js has been deprecated for document-level analysis
 * and should only be used for:
 * - Vocabulary extraction (extractKeywords)
 * - Thought group splitting (splitSentenceIntoGroups)
 * - Sentence translation (translateSentences)
 *
 * @see {@link https://github.com/dunature/deep_internalizer/blob/main/docs/RESTRUCTURE_PLAN.md}
 */
import 'dotenv/config';

// ── Configuration ──────────────────────────────────────────────

const DEFAULT_PROVIDER = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();
const DEFAULT_MODEL_BY_PROVIDER = {
    deepseek: 'deepseek-chat',
    glm: 'glm-4.7',
    ollama: process.env.LLM_MODEL || 'llama3.1:latest'
};
const DEFAULT_BASE_URL_BY_PROVIDER = {
    deepseek: process.env.DEEPSEEK_BASE_URL || process.env.LLM_BASE_URL || 'https://api.deepseek.com',
    glm: process.env.GLM_BASE_URL || process.env.LLM_BASE_URL || 'https://api.z.ai/api/paas/v4',
    ollama: process.env.OLLAMA_BASE_URL || process.env.LLM_BASE_URL || 'http://localhost:11434'
};
const DEFAULT_API_KEY_BY_PROVIDER = {
    deepseek: process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || '',
    glm: process.env.GLM_API_KEY || process.env.LLM_API_KEY || '',
    ollama: ''
};
const DEFAULT_LLM_REQUEST_TIMEOUT_MS = 180000;
const parsedRequestTimeout = Number.parseInt(process.env.LLM_REQUEST_TIMEOUT_MS || '', 10);
const LLM_REQUEST_TIMEOUT_MS = Number.isFinite(parsedRequestTimeout) && parsedRequestTimeout > 0
    ? parsedRequestTimeout
    : DEFAULT_LLM_REQUEST_TIMEOUT_MS;
const OLLAMA_VOCAB_MODEL = String(process.env.OLLAMA_VOCAB_MODEL || '').trim();
const MAX_SUMMARY_HINT_CHARS = Number.parseInt(process.env.CHUNKING_SUMMARY_HINT_MAX_CHARS || '1200', 10);
const CHUNKING_BASE_MAX_TOKENS = 2048;
const CHUNKING_MAX_TOKENS_CAP = Number.parseInt(process.env.CHUNKING_MAX_TOKENS_CAP || '6144', 10);
const LOCAL_FALLBACK_CHUNK_SIZE = Math.max(3, Number.parseInt(process.env.LOCAL_FALLBACK_CHUNK_SIZE || '5', 10));

class AnalysisError extends Error {
    constructor(message, { stage = 'unknown', reason = 'unknown', retryable = false, details = null } = {}) {
        super(message);
        this.name = 'AnalysisError';
        this.stage = stage;
        this.reason = reason;
        this.retryable = retryable;
        this.details = details;
    }
}

function normalizeProvider(provider) {
    const value = String(provider || DEFAULT_PROVIDER).toLowerCase();
    if (value === 'deepseek' || value === 'glm' || value === 'ollama') {
        return value;
    }
    return 'ollama';
}

function normalizeBaseUrl(url) {
    return String(url || '').replace(/\/+$/, '');
}

function resolveLLMConfig(options = {}) {
    const provider = normalizeProvider(options.provider);
    return {
        provider,
        model: options.model || DEFAULT_MODEL_BY_PROVIDER[provider],
        baseUrl: normalizeBaseUrl(options.baseUrl || DEFAULT_BASE_URL_BY_PROVIDER[provider]),
        apiKey: options.apiKey || DEFAULT_API_KEY_BY_PROVIDER[provider]
    };
}

function isAbortError(error) {
    return error?.name === 'AbortError' || error?.name === 'TimeoutError' || String(error?.message || '').includes('aborted');
}

async function fetchWithLlmTimeout(url, options = {}, timeoutMs = LLM_REQUEST_TIMEOUT_MS) {
    try {
        return await fetch(url, {
            ...options,
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch (error) {
        if (isAbortError(error)) {
            throw new Error(`LLM request timed out after ${timeoutMs}ms`);
        }
        throw error;
    }
}

// ── Prompts (mirrored from chunkingService.js) ─────────────────

const CHUNKING_SYSTEM_PROMPT = `You are a professional reading analyst.
Divide the following text into semantic chunks of 3-8 sentences each.

Output format: ONLY valid JSON array, no markdown, no explanation.
[
  {
    "title": "Chunk Title (max 8 words)",
    "summary": "2-3 sentence summary in English",
    "summary_zh": "中文摘要 (2-3 sentences)",
    "startIndex": 0,
    "endIndex": 4
  }
]

Rules:
- Indices refer to sentence positions (0-based)
- Cover ALL sentences — no gaps, no overlaps
- Chunks must follow the logical flow of the argument
- Identify transitions between ideas as natural chunk boundaries
- Do not overlap chunks`;

const CORE_THESIS_PROMPT = `Summarize the core thesis of this text in ONE sentence (max 30 words).
Focus on the main argument or central idea.
Output ONLY the thesis statement, nothing else.`;

const DOCUMENT_SUMMARY_PROMPT = `You are a professional reading analyst.
Create a structured summary that will guide semantic chunking.

Output format (plain text only, exact headings):
THESIS: <one sentence, max 30 words>
OUTLINE:
- <main point 1>
- <main point 2>
- <main point 3> (up to 6 points)`;

const VOCABULARY_EXTRACTION_PROMPT = `You are a vocabulary extraction expert for English learners.
For EACH paragraph/chunk provided, extract 8-12 key vocabulary words that are:
1. Domain-specific or technical terms
2. Advanced vocabulary (CEFR B2+ level and above)
3. Words crucial to understanding the text's argument
4. Words that might be unfamiliar to intermediate English learners

For EACH word, provide ONLY:
- word: the word itself (lowercase)
- phonetic: IPA phonetic transcription in slashes (e.g., /ˈæɡrɪɡeɪt/)
- pos: part of speech abbreviation (n., v., adj., adv., phr.)
- definition: concise English definition (max 15 words)
- definition_zh: concise Chinese definition (max 10 characters)
- sentence: the exact original sentence where the word appears

Output format: ONLY valid JSON array, no markdown, no explanation.
Example:
[
  {
    "word": "paralyzing",
    "phonetic": "/ˈpærəlaɪzɪŋ/",
    "pos": "adj.",
    "definition": "making unable to think or act",
    "definition_zh": "使瘫痪的",
    "sentence": "Fear of the unknown is one of the most paralyzing reactions."
  }
]

IMPORTANT: Extract 8-12 words per chunk. Return ONLY the JSON array.`;

// ── Sentence tokenizer ─────────────────────────────────────────

function tokenizeSentences(text) {
    return text
        .replace(/([.!?])\s+/g, '$1\n')
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

// ── LLM Call ───────────────────────────────────────────────────

export async function callLLM({
    system,
    user,
    temperature = 0.3,
    maxTokens = 2048,
    responseFormat,
    model,
    provider,
    baseUrl,
    apiKey
}) {
    const config = resolveLLMConfig({ model, provider, baseUrl, apiKey });

    if (config.provider === 'ollama') {
        const prompt = system ? `${system}\n\n${user}` : user;
        const res = await fetchWithLlmTimeout(`${config.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model,
                prompt,
                stream: false,
                options: { temperature, num_predict: maxTokens }
            })
        });
        if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
        const data = await res.json();
        return data.response;
    }

    // OpenAI-compatible (DeepSeek, GLM, etc.)
    if (!config.apiKey) throw new Error(`API key is required for provider "${config.provider}"`);
    const messages = system
        ? [{ role: 'system', content: system }, { role: 'user', content: user }]
        : [{ role: 'user', content: user }];
    const payload = {
        model: config.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false
    };
    if (responseFormat) {
        payload.response_format = responseFormat;
    }
    const res = await fetchWithLlmTimeout(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `LLM error: ${res.status}`);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM returned empty content');
    return content;
}

// ── JSON parser (handles markdown fences) ──────────────────────

function sanitizeJsonString(text) {
    return String(text || '')
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
}

function extractJsonCandidates(raw) {
    const cleaned = sanitizeJsonString(raw);
    const candidates = [];

    if (cleaned) {
        candidates.push(cleaned);
    }

    const objectStart = cleaned.indexOf('{');
    const objectEnd = cleaned.lastIndexOf('}');
    if (objectStart !== -1 && objectEnd !== -1 && objectStart < objectEnd) {
        candidates.push(cleaned.substring(objectStart, objectEnd + 1));
    }

    const arrayStart = cleaned.indexOf('[');
    const arrayEnd = cleaned.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayStart < arrayEnd) {
        candidates.push(cleaned.substring(arrayStart, arrayEnd + 1));
    }

    return [...new Set(candidates.filter(Boolean))];
}

function parseJsonLoose(text) {
    const attempt = sanitizeJsonString(text);
    try {
        return JSON.parse(attempt);
    } catch {
        const fixed = attempt
            .replace(/'/g, '"')
            .replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(fixed);
    }
}

function normalizeChunksPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.chunks)) return payload.chunks;
    if (payload && payload.data && Array.isArray(payload.data.chunks)) return payload.data.chunks;
    if (payload && payload.result && Array.isArray(payload.result.chunks)) return payload.result.chunks;
    throw new Error('No valid chunks array found in response payload');
}

function normalizeChunk(chunk, sentenceCount) {
    if (!chunk || typeof chunk !== 'object') return null;

    const start = Number.parseInt(chunk.startIndex, 10);
    const end = Number.parseInt(chunk.endIndex, 10);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

    const clampedStart = Math.max(0, Math.min(sentenceCount - 1, start));
    const clampedEnd = Math.max(0, Math.min(sentenceCount - 1, end));
    if (clampedStart > clampedEnd) return null;

    return {
        title: String(chunk.title || '').trim() || 'Untitled Chunk',
        summary: String(chunk.summary || '').trim(),
        summary_zh: String(chunk.summary_zh || '').trim(),
        startIndex: clampedStart,
        endIndex: clampedEnd
    };
}

function fallbackChunkSummary(sentences, start, end) {
    return sentences.slice(start, Math.min(end + 1, start + 2)).join(' ').trim();
}

function buildDeterministicChunks(sentences, chunkSize = LOCAL_FALLBACK_CHUNK_SIZE) {
    const chunks = [];
    for (let start = 0, index = 1; start < sentences.length; start += chunkSize, index += 1) {
        const end = Math.min(start + chunkSize - 1, sentences.length - 1);
        chunks.push({
            title: `Chunk ${index}`,
            summary: fallbackChunkSummary(sentences, start, end),
            summary_zh: '',
            startIndex: start,
            endIndex: end
        });
    }
    return chunks;
}

function ensureChunkCoverage(chunks, sentences) {
    const sentenceCount = sentences.length;
    const normalized = chunks
        .map(chunk => normalizeChunk(chunk, sentenceCount))
        .filter(Boolean)
        .sort((a, b) => a.startIndex - b.startIndex);

    if (!normalized.length) {
        return buildDeterministicChunks(sentences);
    }

    const covered = [];
    let previousEnd = -1;
    for (const chunk of normalized) {
        const adjustedStart = Math.max(chunk.startIndex, previousEnd + 1);
        if (adjustedStart > chunk.endIndex) continue;
        covered.push({ ...chunk, startIndex: adjustedStart });
        previousEnd = chunk.endIndex;
    }

    if (!covered.length) {
        return buildDeterministicChunks(sentences);
    }

    const completed = [];
    let cursor = 0;
    for (const chunk of covered) {
        if (chunk.startIndex > cursor) {
            completed.push(...buildDeterministicChunks(sentences.slice(cursor, chunk.startIndex)).map((c, idx) => ({
                ...c,
                title: `Chunk F${completed.length + idx + 1}`,
                startIndex: c.startIndex + cursor,
                endIndex: c.endIndex + cursor
            })));
        }
        completed.push(chunk);
        cursor = chunk.endIndex + 1;
    }
    if (cursor < sentenceCount) {
        completed.push(...buildDeterministicChunks(sentences.slice(cursor)).map((c, idx) => ({
            ...c,
            title: `Chunk F${completed.length + idx + 1}`,
            startIndex: c.startIndex + cursor,
            endIndex: c.endIndex + cursor
        })));
    }

    return completed.map((chunk, index) => ({
        ...chunk,
        title: chunk.title || `Chunk ${index + 1}`,
        summary: chunk.summary || fallbackChunkSummary(sentences, chunk.startIndex, chunk.endIndex)
    }));
}

function extractRawSnippet(raw, max = 280) {
    const text = sanitizeJsonString(raw);
    if (text.length <= max * 2) return text;
    return `${text.slice(0, max)} ... ${text.slice(-max)}`;
}

function logChunkingDiagnostic({
    taskId = null,
    config,
    sentenceCount,
    maxTokens,
    rawResponse,
    reason
}) {
    const payload = {
        stage: 'chunking_parse',
        reason,
        taskId,
        provider: config.provider,
        model: config.model,
        sentenceCount,
        maxTokens,
        responseLength: String(rawResponse || '').length,
        rawSnippet: extractRawSnippet(rawResponse, 200)
    };
    console.warn('[AI][Diagnostic]', JSON.stringify(payload));
}

function getChunkingMaxTokens(sentenceCount) {
    const calculated = CHUNKING_BASE_MAX_TOKENS + sentenceCount * 20;
    return Math.max(CHUNKING_BASE_MAX_TOKENS, Math.min(CHUNKING_MAX_TOKENS_CAP, calculated));
}

function parseJsonResponse(response) {
    const candidates = extractJsonCandidates(response);
    let lastError = null;

    for (const candidate of candidates) {
        try {
            return parseJsonLoose(candidate);
        } catch (error) {
            lastError = error;
        }
    }

    const message = lastError ? `Failed to parse JSON payload: ${lastError.message}` : 'No valid JSON payload found in response';
    throw new Error(message);
}

async function attemptChunkingFormatRepair({ response, sentenceCount, config }) {
    const repairPrompt = `Repair the malformed JSON into a valid JSON object with this exact shape:
{"chunks":[{"title":"...","summary":"...","summary_zh":"...","startIndex":0,"endIndex":2}]}
Rules:
- Keep the same chunk meaning and index boundaries as much as possible.
- Return JSON only, no markdown.`;

    return callLLM({
        system: repairPrompt,
        user: `Sentence count: ${sentenceCount}\nMalformed output:\n${String(response || '').substring(0, 6000)}`,
        temperature: 0,
        maxTokens: Math.min(3000, getChunkingMaxTokens(sentenceCount)),
        responseFormat: { type: 'json_object' },
        ...config
    });
}

async function callChunkingLLM({ text, summary, sentences, config, taskId }) {
    const maxTokens = getChunkingMaxTokens(sentences.length);
    const summaryHint = String(summary || '').replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY_HINT_CHARS);
    const summaryBlock = summaryHint ? `Document summary (for guidance):\n${summaryHint}\n\n` : '';
    const user = `${summaryBlock}Text to analyze (${sentences.length} sentences):\n${text}`;

    let response;
    try {
        response = await callLLM({
            system: CHUNKING_SYSTEM_PROMPT,
            user,
            temperature: 0,
            maxTokens,
            responseFormat: { type: 'json_object' },
            ...config
        });
    } catch (error) {
        // Some providers/models do not support response_format json_object.
        if (!String(error?.message || '').toLowerCase().includes('response_format')) {
            throw error;
        }
        response = await callLLM({
            system: CHUNKING_SYSTEM_PROMPT,
            user,
            temperature: 0,
            maxTokens,
            ...config
        });
    }

    try {
        return normalizeChunksPayload(parseJsonResponse(response));
    } catch (firstError) {
        logChunkingDiagnostic({
            taskId,
            config,
            sentenceCount: sentences.length,
            maxTokens,
            rawResponse: response,
            reason: 'first_parse_failed'
        });

        try {
            const repaired = await attemptChunkingFormatRepair({ response, sentenceCount: sentences.length, config });
            return normalizeChunksPayload(parseJsonResponse(repaired));
        } catch (repairError) {
            logChunkingDiagnostic({
                taskId,
                config,
                sentenceCount: sentences.length,
                maxTokens,
                rawResponse: response,
                reason: `repair_failed:${repairError.message}`
            });
            throw new AnalysisError('No valid JSON array found in response', {
                stage: 'chunking_parse',
                reason: 'invalid_json',
                retryable: false,
                details: {
                    maxTokens,
                    sentenceCount: sentences.length,
                    rawSnippet: extractRawSnippet(response)
                }
            });
        }
    }
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Full analysis pipeline:
 * 1. Generate document summary (guides chunking)
 * 2. Generate core thesis
 * 3. Semantic chunking
 *
 * @param {string} text - Raw document text
 * @returns {{ coreThesis: string, summary: string, model: string, chunks: Array }}
 */
export async function analyzeContent(text, llmOptions = {}) {
    const sentences = tokenizeSentences(text);
    if (sentences.length === 0) throw new Error('No sentences found in text');

    const taskId = llmOptions?.taskId || null;
    const config = resolveLLMConfig(llmOptions);
    const warnings = [];
    console.log(`[AI] Analyzing ${sentences.length} sentences with ${config.provider}/${config.model}...`);

    // Step 1: Generate document summary (guides chunking quality)
    let summary = '';
    try {
        summary = await callLLM({
            system: DOCUMENT_SUMMARY_PROMPT,
            user: `Text:\n${text.substring(0, 3000)}`,
            ...config
        });
        summary = summary.trim();
        console.log('[AI] Document summary generated.');
    } catch (err) {
        console.warn('[AI] Summary generation failed, proceeding without:', err.message);
    }

    // Step 2: Core thesis
    const coreThesis = await callLLM({
        system: CORE_THESIS_PROMPT,
        user: `Text:\n${text.substring(0, 2000)}`,
        ...config
    });
    console.log('[AI] Core thesis generated.');

    // Step 3: Semantic chunking
    let chunks;
    if (sentences.length <= 5) {
        chunks = [{
            title: 'Complete Text',
            summary: sentences.slice(0, 2).join(' '),
            summary_zh: '',
            startIndex: 0,
            endIndex: sentences.length - 1,
            originalText: text
        }];
    } else {
        try {
            const rawChunks = await callChunkingLLM({ text, summary, sentences, config, taskId });
            chunks = ensureChunkCoverage(rawChunks, sentences);
        } catch (error) {
            if (!(error instanceof AnalysisError)) {
                throw error;
            }

            warnings.push({
                code: 'CHUNKING_FALLBACK',
                stage: error.stage,
                message: 'AI chunking format was invalid. Applied deterministic fallback chunking.',
                details: error.details || null
            });
            console.warn('[AI] Chunking fallback activated due to parse failure.');
            chunks = buildDeterministicChunks(sentences);
        }

        chunks = chunks.map((chunk, index) => ({
            title: chunk.title || `Chunk ${index + 1}`,
            summary: chunk.summary || fallbackChunkSummary(sentences, chunk.startIndex, chunk.endIndex),
            summary_zh: chunk.summary_zh || '',
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            originalText: sentences.slice(chunk.startIndex, chunk.endIndex + 1).join(' ')
        }));
    }

    console.log(`[AI] Chunking complete: ${chunks.length} chunks.`);

    // Step 4: Extract vocabulary for each chunk (sequential processing to avoid overwhelming Ollama)
    console.log('[AI] Extracting vocabulary for each chunk...');
    const chunkWithVocab = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
            const vocab = await extractVocabulary(chunk.originalText, config);
            console.log(`[AI] Chunk ${i + 1}: extracted ${vocab.length} words`);
            chunkWithVocab.push({ ...chunk, vocabulary: vocab });
        } catch (err) {
            console.warn(`[AI] Vocabulary extraction failed for chunk ${i + 1}:`, err.message);
            chunkWithVocab.push({ ...chunk, vocabulary: [] });
        }
    }

    console.log(`[AI] Vocabulary extraction complete for ${chunkWithVocab.length} chunks.`);

    return {
        coreThesis: coreThesis.trim(),
        summary,
        model: `${config.provider}/${config.model}`,
        chunks: chunkWithVocab,
        warnings
    };
}

/**
 * Extract vocabulary from a text chunk
 * @param {string} text - The text to extract vocabulary from
 * @returns {Promise<Array>} Array of vocabulary items
 */
export async function extractVocabulary(text, llmOptions = {}) {
    if (!text || text.trim().length === 0) return [];
    const config = resolveLLMConfig(llmOptions);
    const preferredOllamaModel = OLLAMA_VOCAB_MODEL || config.model;

    try {
        const vocabModel = config.provider === 'ollama' ? preferredOllamaModel : config.model;
        const response = await callLLM({
            system: VOCABULARY_EXTRACTION_PROMPT,
            user: `Paragraph:\n${text.substring(0, 1000)}`,
            temperature: 0.3,
            maxTokens: 1500,
            ...config,
            model: vocabModel
        });
        return parseJsonResponse(response);
    } catch (error) {
        // Fallback only when a dedicated vocab model is configured and fails.
        if (config.provider !== 'ollama' || !OLLAMA_VOCAB_MODEL || OLLAMA_VOCAB_MODEL === config.model) {
            throw error;
        }

        const response = await callLLM({
            system: VOCABULARY_EXTRACTION_PROMPT,
            user: `Paragraph:\n${text.substring(0, 1000)}`,
            temperature: 0.3,
            maxTokens: 1500,
            ...config
        });
        return parseJsonResponse(response);
    }
}

export default { analyzeContent };
