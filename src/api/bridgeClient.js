/**
 * Unified Bridge Server API Client
 * 
 * Centralizes all HTTP communication with the Bridge Server.
 * Handles configuration, timeouts, errors, and task polling.
 */

const BRIDGE_STORAGE_KEY = 'deep-internalizer-bridge-url';
const DEFAULT_BRIDGE_URL = import.meta.env.VITE_BRIDGE_SERVER_URL || 'http://localhost:3737';

/**
 * Get the current Bridge Server URL.
 * Prefers localStorage override, falls back to environment variable or default.
 * @returns {string} Bridge Server base URL
 */
export function getBridgeUrl() {
    return localStorage.getItem(BRIDGE_STORAGE_KEY) || DEFAULT_BRIDGE_URL;
}

export function setBridgeUrl(url) {
    localStorage.setItem(BRIDGE_STORAGE_KEY, url);
}

/**
 * Custom Error class for Bridge Server network failures.
 */
export class BridgeNetworkError extends Error {
    constructor(message, status = null) {
        super(message);
        this.name = 'BridgeNetworkError';
        this.status = status;
    }
}

/**
 * Core fetch wrapper with timeout and robust error handling.
 */
async function fetchWithTimeout(endpoint, options = {}) {
    const { timeoutMs = 5000, ...fetchOptions } = options;
    const url = `${getBridgeUrl()}${endpoint}`;

    try {
        const res = await fetch(url, {
            ...fetchOptions,
            signal: AbortSignal.timeout(timeoutMs)
        });

        if (!res.ok) {
            let errorMessage = `HTTP Error ${res.status}`;
            try {
                errorMessage = await res.text();
            } catch (e) {
                // Ignore text parsing errors
            }
            throw new BridgeNetworkError(`Bridge API Error: ${errorMessage}`, res.status);
        }

        // For 204 No Content or empty responses
        if (res.status === 204) return null;
        return await res.json();
    } catch (error) {
        if (error.name === 'TimeoutError') {
            throw new BridgeNetworkError(`Request to Bridge Server timed out after ${timeoutMs}ms`);
        }
        // Re-throw if it's already our custom error
        if (error instanceof BridgeNetworkError) {
            throw error;
        }
        throw new BridgeNetworkError(`Network Error connecting to Bridge Server: ${error.message}`);
    }
}

/**
 * Check if Bridge Server is reachable/healthy.
 * @returns {Promise<{healthy: boolean, url: string, uptime?: number}>}
 */
export async function checkHealth() {
    try {
        const data = await fetchWithTimeout('/api/health', { timeoutMs: 2000 });
        return {
            healthy: true,
            url: getBridgeUrl(),
            uptime: data.uptime
        };
    } catch (error) {
        console.warn('[BridgeClient] Health check failed:', error.message);
        return {
            healthy: false,
            url: getBridgeUrl()
        };
    }
}

/**
 * Query Bridge cache by content hash.
 * @param {string} hash - SHA-256 hex of the content
 * @returns {Promise<object|null>} Cached analysis result, or null if miss
 */
export async function getCache(hash) {
    try {
        return await fetchWithTimeout(`/api/cache/${hash}`, { timeoutMs: 3000 });
    } catch (error) {
        // 404 is a normal cache miss
        if (error.status === 404) return null;
        console.warn('[BridgeClient] Cache check failed:', error.message);
        return null; // Return null on network error to allow fallback
    }
}

/**
 * Write analysis result to Bridge cache.
 * @param {object} payload - { content, coreThesis, chunks, model, summary }
 */
export async function syncCache(payload) {
    try {
        await fetchWithTimeout('/api/cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            timeoutMs: 5000
        });
    } catch (error) {
        console.warn('[BridgeClient] Failed to sync to Bridge Server:', error.message);
        // Best effort, do not throw
    }
}

/**
 * Submit content for analysis.
 * @param {object} payload - { content, title, url, cacheOnly, source }
 * @returns {Promise<object>} Task response with taskId and status
 */
export async function submitAnalysis(payload) {
    return fetchWithTimeout('/api/content/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeoutMs: 10000 // Submitting might take a bit longer
    });
}

/**
 * Fetch task result from Bridge Server.
 * @param {string} taskId - Task UUID
 * @returns {Promise<object>} Task data with result
 */
export async function getTask(taskId) {
    return fetchWithTimeout(`/api/tasks/${taskId}`, { timeoutMs: 5000 });
}

/**
 * Poll task status until completion using exponential backoff.
 * @param {string} taskId - Task UUID
 * @param {object} options - Polling options
 * @param {number} [options.intervalMs=3000] - Initial polling interval in ms
 * @param {number} [options.timeoutMs=60000] - Total timeout in ms
 * @param {function} [options.onProgress] - Progress callback
 * @returns {Promise<object>} Task result data
 */
export async function pollTaskStatus(taskId, { intervalMs = 3000, timeoutMs = 60000, onProgress } = {}) {
    const startTime = Date.now();
    const maxRetries = Math.ceil(timeoutMs / intervalMs) + 5; // allow some extra for backoff
    let retryCount = 0;

    while (Date.now() - startTime < timeoutMs) {
        try {
            const data = await getTask(taskId);

            // Successfully fetched task
            if (onProgress) {
                onProgress({ status: data.status, taskId, data });
            }

            if (data.status === 'done') {
                return data; // Return full task data payload
            }

            if (data.status === 'error') {
                throw new BridgeNetworkError(data.error || 'Server task failed');
            }

            // Reset retry count on successful poll that is simply 'processing' or 'queued'
            retryCount = 0;

            // Still processing, wait and poll again
            await new Promise(resolve => setTimeout(resolve, intervalMs));

        } catch (error) {
            retryCount++;

            // Log error but don't fail immediately unless it's a known task logic error
            if (error.message.includes('Server task failed') || error.status === 404) {
                throw error;
            }

            console.warn(`[BridgeClient] Polling error (${retryCount}/${maxRetries}):`, error.message);

            if (retryCount >= maxRetries) {
                throw new BridgeNetworkError(
                    `Task ${taskId} polling failed after ${maxRetries} network attempts: ${error.message}`
                );
            }

            // Exponential backoff: intervalMs * retryCount, capped at 15s
            const backoffDelay = Math.min(intervalMs * retryCount, 15000);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
    }

    throw new BridgeNetworkError(`Task ${taskId} polling timed out after ${timeoutMs}ms`);
}

export default {
    getBridgeUrl,
    setBridgeUrl,
    BridgeNetworkError,
    checkHealth,
    getCache,
    syncCache,
    submitAnalysis,
    getTask,
    pollTaskStatus
};
