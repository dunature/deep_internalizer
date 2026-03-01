/**
 * LLM Client
 * Proxies all requests to the Bridge Server to avoid exposing API keys in the frontend.
 */

const DEFAULT_PROVIDER = import.meta.env.VITE_LLM_PROVIDER || 'deepseek';
// Default bridge server URL fallback
const BRIDGE_SERVER_URL = import.meta.env.VITE_BRIDGE_SERVER_URL || 'http://localhost:3737';
// Token used to authenticate with the Bridge Server
const BRIDGE_API_KEY = import.meta.env.VITE_BRIDGE_API_KEY || 'your_secret_key_here';

const STORAGE_KEY = 'deep-internalizer-llm-config';

function normalizeBaseUrl(url) {
    return url.replace(/\/+$/, '');
}

export function getLLMConfig() {
    // Try to load from localStorage first
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
        try {
            return JSON.parse(savedConfig);
        } catch (e) {
            console.error('Failed to parse saved LLM config:', e);
        }
    }

    // Fallback to default configs for UI (The backend uses its own .env for the actual provider logic)
    const provider = DEFAULT_PROVIDER.toLowerCase();

    // We only need to store the provider/model string for the UI state
    if (provider === 'deepseek') {
        return {
            provider,
            model: 'deepseek-chat'
        };
    }
    if (provider === 'glm') {
        return {
            provider,
            model: 'glm-4.7'
        };
    }

    return {
        provider: 'ollama',
        model: 'llama3.1:latest'
    };
}

export function saveLLMConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/**
 * Calls the backend Bridge Server proxy to process the LLM request.
 */
async function callBridgeProxy({ system, user, temperature = 0.3, maxTokens = 2048, signal, model }) {
    const url = `${normalizeBaseUrl(BRIDGE_SERVER_URL)}/api/llm/chat`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BRIDGE_API_KEY}`
        },
        body: JSON.stringify({
            model,
            system,
            user,
            temperature,
            maxTokens
        }),
        signal
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error || `Bridge API error: ${response.status}`);
    }

    if (!data.content) {
        throw new Error('Bridge returned empty content');
    }

    return data.content;
}

export async function callLLM({
    system,
    user,
    temperature = 0.3,
    maxTokens = 2048,
    signal,
    model
}) {
    const config = getLLMConfig();
    const resolvedModel = model || config.model;

    // Send the configured model preference to the Bridge (the bridge may override it if forced)
    return callBridgeProxy({
        system,
        user,
        temperature,
        maxTokens,
        signal,
        model: resolvedModel
    });
}
