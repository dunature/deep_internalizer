/**
 * AI Text Cleaning Service
 * Cleans and formats raw extracted text (from PDF/DOCX) using LLM.
 * Removes page artifacts (headers, footers, page numbers, watermarks)
 * and reformats into clean, well-structured paragraphs.
 */

import { callLLM, getLLMConfig } from './llmClient';

const CLEANING_SYSTEM_PROMPT = `You are a professional text formatter and editor.
Your task is to clean and reformat raw text extracted from a PDF or document file.

The extracted text contains noise and formatting artifacts from the original document layout.

You MUST:
1. Remove page numbers (e.g., "- 3 -", "Page 5", "5/20", standalone numbers that are clearly page indicators)
2. Remove headers and footers that repeat across pages (e.g., journal names, author names, chapter titles that appear on every page)
3. Remove watermark text, copyright notices, and publisher metadata
4. Remove garbled or corrupted characters (e.g., "â€™", "Â", mojibake)
5. Merge broken lines back into complete sentences and paragraphs (PDF often breaks mid-sentence at line boundaries)
6. Separate distinct paragraphs with a blank line
7. Preserve the original wording, meaning, and language — do NOT paraphrase, summarize, translate, or add commentary
8. Preserve any meaningful structural elements like section headings or list items
9. Output ONLY the cleaned text, no explanations or metadata

The output should read like a properly formatted article with natural paragraph breaks.`;

const CHUNK_SIZE = 4000;
const CHUNK_OVERLAP = 200;

/**
 * Split text into overlapping chunks for processing
 */
function splitIntoChunks(text) {
    if (text.length <= CHUNK_SIZE) {
        return [text];
    }

    const chunks = [];
    let start = 0;

    while (start < text.length) {
        let end = start + CHUNK_SIZE;

        // Try to break at a paragraph or sentence boundary
        if (end < text.length) {
            const searchRegion = text.substring(end - 200, end + 200);
            const paragraphBreak = searchRegion.lastIndexOf('\n\n');
            if (paragraphBreak !== -1) {
                end = (end - 200) + paragraphBreak + 2;
            } else {
                const sentenceBreak = searchRegion.search(/[.!?]\s/);
                if (sentenceBreak !== -1) {
                    end = (end - 200) + sentenceBreak + 2;
                }
            }
        } else {
            end = text.length;
        }

        chunks.push(text.substring(start, end));
        start = end > start ? end : start + CHUNK_SIZE; // safety: always advance
    }

    return chunks;
}

/**
 * Clean a single text chunk using AI
 */
async function cleanChunk(text, model, signal) {
    const user = `Raw extracted text to clean:\n\n${text}`;

    const response = await callLLM({
        system: CLEANING_SYSTEM_PROMPT,
        user,
        temperature: 0.1,
        maxTokens: 4096,
        signal,
        model
    });

    return response.trim();
}

/**
 * Clean and format raw document text using AI.
 * Splits long text into chunks, cleans each, and reassembles.
 *
 * @param {string} text - Raw extracted text
 * @param {string} [model] - LLM model override
 * @param {AbortSignal} [signal] - Abort signal for cancellation
 * @param {function} [onProgress] - Progress callback ({ current, total })
 * @returns {Promise<{ cleanedText: string, originalText: string, chunks: number }>}
 */
export async function cleanTextWithAI(text, model, signal = null, onProgress = null) {
    if (!text || text.trim().length === 0) {
        return { cleanedText: text, originalText: text, chunks: 0 };
    }

    const resolvedModel = model || getLLMConfig().model;
    const originalText = text;
    const textChunks = splitIntoChunks(text);
    const totalChunks = textChunks.length;

    console.log(`[TextCleaning] Processing ${totalChunks} chunk(s)...`);

    const cleanedParts = [];

    for (let i = 0; i < totalChunks; i++) {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        if (onProgress) {
            onProgress({ current: i + 1, total: totalChunks });
        }

        const cleaned = await cleanChunk(textChunks[i], resolvedModel, signal);
        cleanedParts.push(cleaned);

        console.log(`[TextCleaning] Chunk ${i + 1}/${totalChunks} done.`);
    }

    const cleanedText = cleanedParts.join('\n\n').trim();

    return {
        cleanedText,
        originalText,
        chunks: totalChunks
    };
}
