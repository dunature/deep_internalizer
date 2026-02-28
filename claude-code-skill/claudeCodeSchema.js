/**
 * Deep Internalizer - Claude Code Schema
 * Defines the data structure for exporting analysis results to Deep Internalizer
 */

/**
 * Main analysis result structure compatible with Deep Internalizer IndexedDB
 */
export const ClaudeCodeAnalysisResult = {
  // Unique identifier for this analysis
  taskId: "string (UUID)",

  // Source information
  source: "claude-code-skill",
  title: "string (article title)",
  url: "string (original URL or local file path)",
  contentHash: "string (SHA-256 hash of content for caching)",

  // Analysis status
  status: "queued | processing | done | error",

  // Timestamps
  createdAt: "ISO 8601 timestamp",
  completedAt: "ISO 8601 timestamp",

  // Model used for analysis
  model: "string (e.g., glm-4.7)",

  // Analysis results
  result: {
    // Core thesis (one sentence, max 30 words)
    coreThesis: "string",

    // Combined summary (THESIS + OUTLINE)
    summary: "string",

    // Semantic chunks for deep learning
    chunks: [
      {
        // Chunk title (3-5 words)
        title: "string",

        // Summary in English (1-2 sentences)
        summary: "string",

        // Summary in Chinese (1 sentence)
        summary_zh: "string",

        // Original text of this chunk
        originalText: "string",

        // Sentence indices (optional, for reference)
        startIndex: "number",
        endIndex: "number"
      }
    ],

    // Extracted vocabulary (5-8 words per chunk)
    vocabulary: [
      {
        // The word itself
        word: "string",

        // IPA phonetic transcription
        phonetic: "string",

        // Part of speech
        pos: "string (n., v., adj., adv., phr.)",

        // Syllable slices with IPA
        slices: [
          {
            text: "string",
            phonetic: "string"
          }
        ],

        // Definition in English (max 20 words)
        definition: "string",

        // Definition in Chinese (max 7 words)
        definition_zh: "string",

        // Original sentence containing the word
        sentence: "string",

        // New example sentence (different from original)
        newContext: "string"
      }
    ],

    // Sentence analysis for articulation practice (optional)
    sentences: [
      {
        // Original sentence text
        text: "string",

        // Thought groups for phrasing
        thoughtGroups: [
          {
            text: "string",
            hint: "string (e.g., subject, action, detail)"
          }
        ],

        // Chinese translation
        translation: "string"
      }
    ]
  }
};

/**
 * Export format for file download
 */
export const ExportFormat = {
  // File name pattern
  fileName: "deep-internalizer-{title}-{date}.json",

  // MIME type
  mimeType: "application/json",

  // Version for schema tracking
  schemaVersion: "1.0.0"
};

/**
 * Cache structure for quick lookups
 */
export const CacheEntry = {
  contentHash: "string (SHA-256)",
  taskId: "string",
  title: "string",
  url: "string",
  analyzedAt: "ISO 8601 timestamp",
  model: "string",
  chunkCount: "number"
};

/**
 * Generate a UUID v4
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for Node.js environment
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate SHA-256 hash for content
 */
export async function hashContent(content) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback: simple hash (not cryptographically secure, for caching only)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export default {
  ClaudeCodeAnalysisResult,
  ExportFormat,
  CacheEntry,
  generateUUID,
  hashContent
};
