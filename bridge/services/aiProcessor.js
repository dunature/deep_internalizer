/**
 * AI Processor — Node.js version
 *
 * Replicates the prompt logic from the frontend `chunkingService.js`
 * but calls the LLM via Node.js HTTP (no import.meta.env dependency).
 */
import 'dotenv/config';

// ── Configuration ──────────────────────────────────────────────

const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();
const LLM_BASE_URL = (process.env.LLM_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
const LLM_MODEL = process.env.LLM_MODEL || 'qwen2.5:7b';
const LLM_API_KEY = process.env.LLM_API_KEY || '';

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

// ── Sentence tokenizer ─────────────────────────────────────────

function tokenizeSentences(text) {
    return text
        .replace(/([.!?])\s+/g, '$1\n')
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

// ── LLM Call ───────────────────────────────────────────────────

export async function callLLM({ system, user, temperature = 0.3, maxTokens = 2048 }) {
    if (LLM_PROVIDER === 'ollama') {
        const prompt = system ? `${system}\n\n${user}` : user;
        const res = await fetch(`${LLM_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: LLM_MODEL,
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
    if (!LLM_API_KEY) throw new Error('LLM_API_KEY is required for non-Ollama providers');
    const messages = system
        ? [{ role: 'system', content: system }, { role: 'user', content: user }]
        : [{ role: 'user', content: user }];
    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LLM_API_KEY}`
        },
        body: JSON.stringify({
            model: LLM_MODEL,
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
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // Try to extract JSON array from messy response
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (match) return JSON.parse(match[0]);
        throw new Error(`Failed to parse LLM JSON: ${e.message}`);
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
export async function analyzeContent(text) {
    const sentences = tokenizeSentences(text);
    if (sentences.length === 0) throw new Error('No sentences found in text');

    console.log(`[AI] Analyzing ${sentences.length} sentences with ${LLM_PROVIDER}/${LLM_MODEL}...`);

    // Step 1: Generate document summary (guides chunking quality)
    let summary = '';
    try {
        summary = await callLLM({
            system: DOCUMENT_SUMMARY_PROMPT,
            user: `Text:\n${text.substring(0, 3000)}`
        });
        summary = summary.trim();
        console.log('[AI] Document summary generated.');
    } catch (err) {
        console.warn('[AI] Summary generation failed, proceeding without:', err.message);
    }

    // Step 2: Core thesis
    const coreThesis = await callLLM({
        system: CORE_THESIS_PROMPT,
        user: `Text:\n${text.substring(0, 2000)}`
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
            user: `${summaryBlock}Text to analyze (${sentences.length} sentences):\n${text}`
        });
        chunks = parseJsonResponse(response);
        // Enrich with original text
        chunks = chunks.map(chunk => ({
            ...chunk,
            originalText: sentences.slice(chunk.startIndex, chunk.endIndex + 1).join(' ')
        }));
    }

    console.log(`[AI] Chunking complete: ${chunks.length} chunks.`);

    return {
        coreThesis: coreThesis.trim(),
        summary,
        model: `${LLM_PROVIDER}/${LLM_MODEL}`,
        chunks
    };
}

export default { analyzeContent };
