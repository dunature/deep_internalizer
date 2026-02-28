/**
 * CacheBridge Service — Frontend ↔ Bridge Server communication
 *
 * Two operation modes:
 * 1. CLI push: content arrives via Bridge Server, frontend loads by bridgeHash URL param
 * 2. Direct import: user pastes/uploads in ImportModal, frontend checks Bridge cache
 */

const BRIDGE_STORAGE_KEY = 'deep-internalizer-bridge-url';
const DEFAULT_BRIDGE_URL = 'http://localhost:3737';

/**
 * Get Bridge Server URL from localStorage or default.
 * @returns {string} Bridge Server base URL
 */
export function getBridgeUrl() {
    return localStorage.getItem(BRIDGE_STORAGE_KEY) || DEFAULT_BRIDGE_URL;
}

export function setBridgeUrl(url) {
    localStorage.setItem(BRIDGE_STORAGE_KEY, url);
}

/**
 * Check if Bridge Server is reachable.
 */
export async function isBridgeAvailable() {
    try {
        const res = await fetch(`${getBridgeUrl()}/api/health`, { signal: AbortSignal.timeout(2000) });
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Query Bridge cache by content hash.
 * @param {string} hash - SHA-256 hex of the content
 * @returns {object|null} Cached analysis result, or null if miss
 */
export async function checkBridgeCache(hash) {
    try {
        const res = await fetch(`${getBridgeUrl()}/api/cache/${hash}`, {
            signal: AbortSignal.timeout(3000)
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/**
 * Fetch task result from Bridge Server.
 * @param {string} taskId - Task UUID
 * @returns {object|null} Task data with result, or null
 */
export async function fetchTaskResult(taskId) {
    try {
        const res = await fetch(`${getBridgeUrl()}/api/tasks/${taskId}`, {
            signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/**
 * Poll task status until completion.
 * @param {string} taskId - Task UUID
 * @param {object} options - Polling options
 * @param {number} [options.intervalMs=3000] - Polling interval in ms
 * @param {number} [options.timeoutMs=60000] - Total timeout in ms
 * @param {function} [options.onProgress] - Progress callback
 * @returns {Promise<object>} Task result with status
 */
export async function pollTaskStatus(taskId, { intervalMs = 3000, timeoutMs = 60000, onProgress } = {}) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const data = await fetchTaskResult(taskId);

        if (!data) {
            throw new Error(`Task ${taskId} not found`);
        }

        if (onProgress) {
            onProgress({ status: data.status, taskId, data });
        }

        if (data.status === 'done') {
            return data;
        }

        if (data.status === 'error') {
            throw new Error(data.error || 'Task failed');
        }

        // Still processing, wait and retry
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Task ${taskId} timed out after ${timeoutMs}ms`);
}

/**
 * Submit content for analysis to Bridge Server.
 * @param {object} params - Analysis parameters
 * @param {string} params.content - Raw text content
 * @param {string} [params.title] - Document title
 * @param {string} [params.url] - Source URL
 * @param {boolean} [params.cacheOnly=false] - Only cache, don't open browser
 * @param {string} [params.source='frontend'] - Source identifier
 * @returns {Promise<object>} Task response with taskId
 */
export async function submitForAnalysis({ content, title, url, cacheOnly = false, source = 'frontend' }) {
    try {
        const res = await fetch(`${getBridgeUrl()}/api/content/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, title, cacheOnly, source, url })
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Bridge Server error: ${error}`);
        }

        return await res.json();
    } catch (error) {
        console.error('[CacheBridge] Analysis submission failed:', error.message);
        throw error;
    }
}

/**
 * Fetch cached analysis by content hash (from Bridge).
 * @param {string} hash - SHA-256 hex
 * @returns {object|null} { coreThesis, summary, model, chunks, title }
 */
export async function importFromBridge(hash) {
    const data = await checkBridgeCache(hash);
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
    try {
        await fetch(`${getBridgeUrl()}/api/cache`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, ...analysisResult }),
            signal: AbortSignal.timeout(5000)
        });
    } catch {
        // Bridge sync is best-effort
        console.warn('[CacheBridge] Failed to sync to Bridge Server');
    }
}
