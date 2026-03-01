/**
 * CacheBridge Service — Frontend ↔ Bridge Server communication
 * 
 * Refactored to proxy all communication through the unified src/api/bridgeClient.js layer.
 */

import bridgeClient from '../api/bridgeClient';

export const getBridgeUrl = bridgeClient.getBridgeUrl;
export const setBridgeUrl = bridgeClient.setBridgeUrl;

/**
 * Check if Bridge Server is reachable.
 */
export async function isBridgeAvailable() {
    const status = await bridgeClient.checkHealth();
    return status.healthy;
}

/**
 * Query Bridge cache by content hash.
 * @param {string} hash - SHA-256 hex of the content
 * @returns {object|null} Cached analysis result, or null if miss
 */
export const checkBridgeCache = bridgeClient.getCache;

/**
 * Fetch task result from Bridge Server.
 * @param {string} taskId - Task UUID
 * @returns {object|null} Task data with result, or null
 */
export const fetchTaskResult = bridgeClient.getTask;

/**
 * Poll task status until completion.
 */
export const pollTaskStatus = bridgeClient.pollTaskStatus;

/**
 * Submit content for analysis to Bridge Server.
 */
export const submitForAnalysis = bridgeClient.submitAnalysis;

/**
 * Fetch cached analysis by content hash (from Bridge).
 * @param {string} hash - SHA-256 hex
 * @returns {object|null} { coreThesis, summary, model, chunks, title }
 */
export async function importFromBridge(hash) {
    const data = await bridgeClient.getCache(hash);
    if (!data) return null;
    return {
        coreThesis: data.coreThesis || '',
        summary: data.summary || '',
        model: data.model || '',
        title: data.title || 'Untitled',
        chunks: data.chunks || []
    };
}

/**
 * Write analysis result to Bridge cache (sync from frontend → Bridge).
 * @param {string} content - Raw text
 * @param {object} analysisResult - { coreThesis, chunks, model, summary }
 */
export async function syncToBridge(content, analysisResult) {
    await bridgeClient.syncCache({ content, ...analysisResult });
}
