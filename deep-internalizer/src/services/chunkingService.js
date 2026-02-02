/**
 * Deep Internalizer - AI Chunking Service
 * Integrates with local Ollama API for semantic text chunking
 */

const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
const DEFAULT_MODEL = 'llama3.1:latest';

// System prompt for semantic chunking
const CHUNKING_SYSTEM_PROMPT = `You are a reading comprehension assistant specializing in English text analysis.
Your task is to divide the given text into logical thematic chunks for deep reading.

For each chunk, provide:
1. A short title (3-5 words, captures the main idea)
2. A 2-sentence summary in English
3. The exact start and end sentence indices (0-indexed)

Output ONLY valid JSON array, no other text:
[
  {
    "title": "The Problem Statement",
    "summary": "The author introduces the core challenge. They argue that current approaches fall short.",
    "startIndex": 0,
    "endIndex": 4
  }
]

Rules:
- Each chunk should contain 3-8 sentences for optimal learning
- Chunks must follow the logical flow of the argument
- Identify transitions between ideas as natural chunk boundaries
- Do not overlap chunks`;

// System prompt for keyword extraction
const KEYWORD_EXTRACTION_PROMPT = `You are a vocabulary extraction assistant for English learners.
Extract 5-8 key vocabulary words from this paragraph.

For each word provide:
- word: the word itself
- phonetic: IPA transcription
- definition: brief definition in context (20 words max)
- sentence: the EXACT full sentence from the text containing this word

Output ONLY valid JSON array:
[
  {
    "word": "aggregate",
    "phonetic": "/ˈæɡrɪɡeɪt/",
    "definition": "to collect or gather into a whole",
    "sentence": "The system will aggregate all user inputs before processing."
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
async function callOllama(prompt, model = DEFAULT_MODEL, signal = null) {
    try {
        const fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt,
                stream: false,
                options: {
                    temperature: 0.3, // Lower for more consistent output
                    num_predict: 2048
                }
            })
        };

        // Attach signal if provided for request cancellation
        if (signal) {
            fetchOptions.signal = signal;
        }

        const response = await fetch(OLLAMA_API_URL, fetchOptions);

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        // Handle AbortError gracefully
        if (error.name === 'AbortError') {
            console.log('[Ollama] Request was cancelled');
            throw error; // Re-throw for caller to handle
        }
        console.error('Ollama API call failed:', error);
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
export async function chunkDocument(text, model = DEFAULT_MODEL, signal = null) {
    const sentences = tokenizeSentences(text);

    if (sentences.length === 0) {
        throw new Error('No sentences found in text');
    }

    // For very short texts, return as single chunk
    if (sentences.length <= 5) {
        return [{
            title: 'Complete Text',
            summary: sentences.slice(0, 2).join(' '),
            startIndex: 0,
            endIndex: sentences.length - 1,
            originalText: text
        }];
    }

    const prompt = `${CHUNKING_SYSTEM_PROMPT}

Text to analyze (${sentences.length} sentences):
${text}`;

    const response = await callOllama(prompt, model, signal);
    const chunks = parseJsonResponse(response);

    // Enrich chunks with original text
    return chunks.map(chunk => ({
        ...chunk,
        originalText: sentences
            .slice(chunk.startIndex, chunk.endIndex + 1)
            .join(' ')
    }));
}

/**
 * Extract keywords from a chunk
 * @param {string} chunkText - The text to extract keywords from
 * @param {string} model - The model to use
 * @param {AbortSignal} signal - Optional AbortSignal for cancellation
 */
export async function extractKeywords(chunkText, model = DEFAULT_MODEL, signal = null) {
    const prompt = `${KEYWORD_EXTRACTION_PROMPT}

Paragraph:
${chunkText}`;

    const response = await callOllama(prompt, model, signal);
    return parseJsonResponse(response);
}

/**
 * Generate a new context sentence for a word (for Card B)
 * @param {string} word - The word to generate context for
 * @param {string} definition - The word's definition
 * @param {string} model - The model to use
 * @param {AbortSignal} signal - Optional AbortSignal for cancellation
 */
export async function generateNewContext(word, definition, model = DEFAULT_MODEL, signal = null) {
    const prompt = `Generate ONE new example sentence using the word "${word}" (meaning: ${definition}).
The sentence should be different from typical textbook examples, preferably from a real-world context.
Output ONLY the sentence, nothing else.`;

    const response = await callOllama(prompt, model, signal);
    return response.trim().replace(/^["']|["']$/g, '');
}

/**
 * Generate core thesis from document
 * @param {string} text - The text to summarize
 * @param {string} model - The model to use
 * @param {AbortSignal} signal - Optional AbortSignal for cancellation
 */
export async function generateCoreThesis(text, model = DEFAULT_MODEL, signal = null) {
    const prompt = `Summarize the core thesis of this text in ONE sentence (max 30 words).
Focus on the main argument or central idea.
Output ONLY the thesis statement, nothing else.

Text:
${text.substring(0, 2000)}`; // Limit input length

    const response = await callOllama(prompt, model, signal);
    return response.trim();
}

export default {
    chunkDocument,
    extractKeywords,
    generateNewContext,
    generateCoreThesis
};
