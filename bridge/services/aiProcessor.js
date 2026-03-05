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
    model,
    provider,
    baseUrl,
    apiKey
}) {
    const config = resolveLLMConfig({ model, provider, baseUrl, apiKey });

    if (config.provider === 'ollama') {
        const prompt = system ? `${system}\n\n${user}` : user;
        const res = await fetch(`${config.baseUrl}/api/generate`, {
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
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: false
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `LLM error: ${res.status}`);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM returned empty content');
    return content;
}

// ── JSON parser (handles markdown fences) ──────────────────────

function parseJsonResponse(response) {
    let cleaned = response.trim();
    // Strip markdown code fences
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    // Try to extract JSON array from messy response
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');

    if (start === -1 || end === -1 || start >= end) {
        throw new Error('No valid JSON array found in response');
    }

    cleaned = cleaned.substring(start, end + 1);

    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // Try to fix common JSON issues (unquoted keys, single quotes, etc.)
        try {
            const fixed = cleaned
                .replace(/'/g, '"')  // Replace single quotes with double quotes
                .replace(/(\w+):/g, '"$1":');  // Quote unquoted keys
            return JSON.parse(fixed);
        } catch (e2) {
            throw new Error(`Failed to parse LLM JSON: ${e.message}. Raw: ${cleaned.substring(0, 200)}...`);
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

    const config = resolveLLMConfig(llmOptions);
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
        const summaryBlock = summary ? `Document summary (for guidance):\n${summary}\n\n` : '';
        const response = await callLLM({
            system: CHUNKING_SYSTEM_PROMPT,
            user: `${summaryBlock}Text to analyze (${sentences.length} sentences):\n${text}`,
            ...config
        });
        chunks = parseJsonResponse(response);
        // Enrich with original text
        chunks = chunks.map(chunk => ({
            ...chunk,
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
        chunks: chunkWithVocab
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

    try {
        const vocabModel = config.provider === 'ollama' ? 'qwen3:4b' : config.model;
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
        // Fallback to default model if the fast vocab model isn't available.
        if (config.provider !== 'ollama' || !String(error?.message || '').includes('Ollama error: 404')) {
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
