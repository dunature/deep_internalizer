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

const DEFAULT_MODELS = {
    deepseek: 'deepseek-chat',
    glm: 'glm-4.7',
    ollama: 'llama3.1:latest'
};

const DEFAULT_BASE_URLS = {
    deepseek: import.meta.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    glm: import.meta.env.VITE_GLM_BASE_URL || 'https://api.z.ai/api/paas/v4',
    ollama: import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434'
};

const DEFAULT_API_KEYS = {
    deepseek: import.meta.env.VITE_DEEPSEEK_API_KEY || '',
    glm: import.meta.env.VITE_GLM_API_KEY || '',
    ollama: ''
};

function normalizeBaseUrl(url) {
    return url.replace(/\/+$/, '');
}

function normalizeProvider(value) {
    const provider = (value || DEFAULT_PROVIDER).toLowerCase();
    if (provider === 'deepseek' || provider === 'glm' || provider === 'ollama') {
        return provider;
    }
    return 'ollama';
}

export function getLLMConfig() {
    const fallbackProvider = normalizeProvider(DEFAULT_PROVIDER);

    // Try to load from localStorage first
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
        try {
            const parsed = JSON.parse(savedConfig);
            const provider = normalizeProvider(parsed?.provider);
            return {
                ...parsed,
                provider,
                model: parsed?.model || DEFAULT_MODELS[provider],
                baseUrl: normalizeBaseUrl(parsed?.baseUrl || DEFAULT_BASE_URLS[provider]),
                apiKey: parsed?.apiKey || DEFAULT_API_KEYS[provider]
            };
        } catch (e) {
            console.error('Failed to parse saved LLM config:', e);
        }
    }

    // Fallback to default configs for UI (The backend uses its own .env for the actual provider logic)
    return {
        provider: fallbackProvider,
        model: DEFAULT_MODELS[fallbackProvider],
        baseUrl: normalizeBaseUrl(DEFAULT_BASE_URLS[fallbackProvider]),
        apiKey: DEFAULT_API_KEYS[fallbackProvider]
    };
}

export function saveLLMConfig(config) {
    const provider = normalizeProvider(config?.provider);
    const normalized = {
        ...config,
        provider,
        model: config?.model || DEFAULT_MODELS[provider],
        baseUrl: normalizeBaseUrl(config?.baseUrl || DEFAULT_BASE_URLS[provider]),
        apiKey: config?.apiKey || DEFAULT_API_KEYS[provider]
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

/**
 * Calls the backend Bridge Server proxy to process the LLM request.
 */
async function callBridgeProxy({
    system,
    user,
    temperature = 0.3,
    maxTokens = 2048,
    signal,
    model,
    provider,
    baseUrl,
    apiKey
}) {
    const url = `${normalizeBaseUrl(BRIDGE_SERVER_URL)}/api/llm/chat`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BRIDGE_API_KEY}`
        },
        body: JSON.stringify({
            model,
            provider,
            baseUrl,
            apiKey,
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

    // Pass import-time/provider credentials through the Bridge proxy.
    return callBridgeProxy({
        system,
        user,
        temperature,
        maxTokens,
        signal,
        model: resolvedModel,
        provider: config.provider,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey
    });
}
