/**
 * Claude Code Importer Service
 *
 * Bridges Bridge Server analysis results to Deep Internalizer's IndexedDB.
 * Provides seamless content import from Claude Code Skill with caching support.
 */

import {
  createDocument,
  createChunksBulk,
  createWordIfMissing,
  getAnalysisCache,
  setAnalysisCache,
  getDocumentWithChunks
} from '../db/schema';
import { hashText } from '../utils/hash';

// Bridge Server base URL
const BRIDGE_BASE_URL = import.meta.env.VITE_BRIDGE_SERVER_URL || 'http://localhost:3737';

/**
 * Analysis result structure from Bridge Server
 */
export class ClaudeCodeAnalysisResult {
  constructor({ taskId, contentHash, status, result, title, url, source }) {
    this.taskId = taskId;
    this.contentHash = contentHash;
    this.status = status; // 'queued' | 'processing' | 'done' | 'cached' | 'error'
    this.result = result; // { coreThesis, summary, chunks, vocabulary, sentences }
    this.title = title;
    this.url = url;
    this.source = source || 'claude-code-skill';
  }
}

/**
 * Check if content has been analyzed (cache detection)
 * Uses two-layer detection: Local IndexedDB → Bridge Server
 *
 * @param {string} content - Raw text content
 * @returns {Promise<{cached: boolean, source: 'local'|'bridge'|null, data: object|null}>}
 */
export async function checkContentCache(content) {
  const contentHash = hashText(content);

  // Layer 1: Check local IndexedDB
  const localCache = await getAnalysisCache(contentHash);
  if (localCache && localCache.chunks && localCache.chunks.length > 0) {
    console.log('[ClaudeCodeImporter] Local cache hit:', contentHash.substring(0, 12));
    return {
      cached: true,
      source: 'local',
      data: localCache,
      contentHash
    };
  }

  // Layer 2: Check Bridge Server
  try {
    const response = await fetch(`${BRIDGE_BASE_URL}/api/cache/${contentHash}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const bridgeCache = await response.json();
      console.log('[ClaudeCodeImporter] Bridge cache hit:', contentHash.substring(0, 12));
      return {
        cached: true,
        source: 'bridge',
        data: bridgeCache,
        contentHash
      };
    }
  } catch (error) {
    console.warn('[ClaudeCodeImporter] Bridge cache check failed:', error.message);
  }

  // Cache miss
  console.log('[ClaudeCodeImporter] Cache miss:', contentHash.substring(0, 12));
  return {
    cached: false,
    source: null,
    data: null,
    contentHash
  };
}

/**
 * Submit content for analysis to Bridge Server
 *
 * @param {Object} params
 * @param {string} params.content - Raw text content
 * @param {string} [params.title] - Document title (optional)
 * @param {string} [params.url] - Source URL (optional)
 * @param {boolean} [params.cacheOnly=false] - Only cache, don't open browser
 * @param {string} [params.source='claude-code'] - Source identifier
 * @returns {Promise<{taskId: string, status: string, contentHash: string}>}
 */
export async function submitForAnalysis({ content, title, url, cacheOnly = false, source = 'claude-code' }) {
  try {
    const response = await fetch(`${BRIDGE_BASE_URL}/api/content/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        title,
        cacheOnly,
        source,
        url
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bridge Server error: ${error}`);
    }

    const data = await response.json();
    return {
      taskId: data.taskId,
      status: data.status,
      contentHash: data.contentHash,
      cacheHit: data.cacheHit
    };
  } catch (error) {
    console.error('[ClaudeCodeImporter] Analysis submission failed:', error.message);
    throw error;
  }
}

/**
 * Poll task status from Bridge Server
 *
 * @param {string} taskId - Task UUID
 * @param {Object} [options]
 * @param {number} [options.intervalMs=3000] - Polling interval in ms
 * @param {number} [options.timeoutMs=60000] - Total timeout in ms
 * @param {Function} [options.onProgress] - Optional progress callback
 * @returns {Promise<ClaudeCodeAnalysisResult>}
 */
export async function pollTaskStatus(taskId, { intervalMs = 3000, timeoutMs = 60000, onProgress } = {}) {
  const startTime = Date.now();
  const maxRetries = Math.ceil(timeoutMs / intervalMs);
  let retryCount = 0;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${BRIDGE_BASE_URL}/api/tasks/${taskId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Task status error: ${response.status}`);
      }

      const data = await response.json();

      if (onProgress) {
        onProgress({ status: data.status, taskId });
      }

      if (data.status === 'done') {
        return new ClaudeCodeAnalysisResult({
          taskId,
          contentHash: data.contentHash,
          status: 'done',
          result: data.result,
          source: 'bridge'
        });
      }

      if (data.status === 'error') {
        throw new Error(data.error || 'Task failed');
      }

      // Still processing, wait and retry
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    } catch (error) {
      retryCount++;

      // Log all errors with retry count
      console.warn(
        `[ClaudeCodeImporter] Polling error (${retryCount}/${maxRetries}):`,
        error.message
      );

      // Throw error if it's a task failure or max retries reached
      if (error.message.includes('failed') || error.message.includes('error')) {
        throw error;
      }

      if (retryCount >= maxRetries) {
        throw new Error(
          `Task ${taskId} polling failed after ${maxRetries} attempts: ${error.message}`
        );
      }

      // Exponential backoff: intervalMs * retryCount, capped at 15s
      const backoffDelay = Math.min(intervalMs * retryCount, 15000);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  throw new Error(`Task ${taskId} timed out after ${timeoutMs}ms`);
}

/**
 * Import analysis result to Deep Internalizer IndexedDB
 *
 * @param {ClaudeCodeAnalysisResult} analysisResult - Analysis result from Bridge
 * @param {Object} [options]
 * @param {Function} [options.onProgress] - Progress callback for chunk import
 * @returns {Promise<{docId: string, chunkIds: string[]}>}
 */
export async function importToDatabase(analysisResult, { onProgress } = {}) {
  const { result, contentHash, title, source } = analysisResult;

  if (!result || !result.chunks || result.chunks.length === 0) {
    throw new Error('No chunks to import');
  }

  // Step 1: Save to local analysis cache
  await setAnalysisCache(
    contentHash,
    result.coreThesis || '',
    result.chunks,
    result.model || 'unknown',
    result.summary || ''
  );

  // Step 2: Create document
  const rawContent = result.chunks.map(c => c.originalText).join('\n\n');
  const docId = await createDocument(
    title || 'Untitled Document',
    rawContent,
    result.coreThesis || ''
  );

  // Step 3: Bulk create chunks
  const chunkIds = await createChunksBulk(docId, result.chunks, {
    batchSize: 10,
    onProgress: onProgress
  });

  console.log(`[ClaudeCodeImporter] Imported ${chunkIds.length} chunks to document ${docId}`);

  // Step 4: Extract and import vocabulary (if available)
  if (result.vocabulary && result.vocabulary.length > 0) {
    let vocabCount = 0;
    for (const [chunkIndex, chunk] of result.chunks.entries()) {
      const chunkWords = result.vocabulary.filter(w => w.chunkIndex === chunkIndex || !w.chunkIndex);
      for (const word of chunkWords) {
        try {
          await createWordIfMissing(
            chunkIds[chunkIndex],
            word.word,
            word.phonetic || '',
            word.definition || '',
            word.sentence || word.originalContext || '',
            word.newContext || '',
            word.slices || [],
            word.pos || '',
            word.definition_zh || ''
          );
          vocabCount++;
        } catch (error) {
          console.warn('[ClaudeCodeImporter] Failed to import word:', word.word, error);
        }
      }
    }
    console.log(`[ClaudeCodeImporter] Imported ${vocabCount} vocabulary items`);
  }

  return {
    docId,
    chunkIds,
    chunkCount: chunkIds.length
  };
}

/**
 * Complete import flow: check cache → submit → poll → import
 *
 * @param {Object} params
 * @param {string} params.content - Raw text content
 * @param {string} [params.title] - Document title
 * @param {string} [params.url] - Source URL
 * @param {boolean} [params.useCache=true] - Whether to use cache
 * @param {Function} [params.onProgress] - Progress callback
 * @returns {Promise<{docId: string, chunkIds: string[], fromCache: boolean}>}
 */
export async function completeImportFlow({ content, title, url, useCache = true, onProgress }) {
  // Step 1: Check cache
  if (useCache) {
    const cacheResult = await checkContentCache(content);
    if (cacheResult.cached) {
      console.log('[ClaudeCodeImporter] Cache hit, importing directly...');

      const analysisResult = new ClaudeCodeAnalysisResult({
        taskId: null,
        contentHash: cacheResult.contentHash,
        status: 'cached',
        result: cacheResult.data,
        title,
        url,
        source: 'cache'
      });

      const importResult = await importToDatabase(analysisResult, { onProgress });
      return {
        ...importResult,
        fromCache: true,
        source: cacheResult.source
      };
    }
  }

  // Step 2: Submit for analysis
  console.log('[ClaudeCodeImporter] Submitting for analysis...');
  const { taskId, status, contentHash } = await submitForAnalysis({
    content,
    title,
    url,
    source: 'claude-code'
  });

  // Step 3: Poll for completion
  console.log('[ClaudeCodeImporter] Polling task status...');
  const analysisResult = await pollTaskStatus(taskId, {
    onProgress: (progress) => {
      if (onProgress) {
        onProgress({
          step: 'ANALYZING',
          status: progress.status,
          taskId
        });
      }
    }
  });

  // Step 4: Import to database
  console.log('[ClaudeCodeImporter] Importing to database...');
  const importResult = await importToDatabase(analysisResult, { onProgress });

  return {
    ...importResult,
    fromCache: false,
    taskId,
    contentHash
  };
}

/**
 * Health check for Bridge Server
 *
 * @returns {Promise<{healthy: boolean, url: string}>}
 */
export async function checkBridgeHealth() {
  try {
    const response = await fetch(`${BRIDGE_BASE_URL}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      return {
        healthy: true,
        url: BRIDGE_BASE_URL,
        uptime: data.uptime
      };
    }
  } catch (error) {
    console.warn('[ClaudeCodeImporter] Bridge health check failed:', error.message);
  }

  return {
    healthy: false,
    url: BRIDGE_BASE_URL
  };
}

export default {
  ClaudeCodeAnalysisResult,
  checkContentCache,
  submitForAnalysis,
  pollTaskStatus,
  importToDatabase,
  completeImportFlow,
  checkBridgeHealth
};
