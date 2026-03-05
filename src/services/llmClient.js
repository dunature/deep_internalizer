/**
 * LLM Client
 * Proxies all requests to the Bridge Server to avoid exposing API keys in the frontend.
 */

const DEFAULT_PROVIDER = import.meta.env.VITE_LLM_PROVIDER || 'deepseek';
// Default bridge server URL fallback
const BRIDGE_SERVER_URL = import.meta.env.VITE_BRIDGE_SERVER_URL || 'http://localhost:3737';
const BRIDGE_API_KEY_STORAGE_KEY = 'deep-internalizer-bridge-api-key';

const STORAGE_KEY = 'deep-internalizer-llm-config';

const DEFAULT_MODELS = {
    deepseek: import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-chat',
    glm: import.meta.env.VITE_GLM_MODEL || 'glm-4.7'
};

const DEFAULT_BASE_URLS = {
    deepseek: import.meta.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    glm: import.meta.env.VITE_GLM_BASE_URL || 'https://api.z.ai/api/paas/v4'
};

const DEFAULT_API_KEYS = {
    deepseek: import.meta.env.VITE_DEEPSEEK_API_KEY || '',
    glm: import.meta.env.VITE_GLM_API_KEY || ''
};

function getBridgeApiKey() {
    return localStorage.getItem(BRIDGE_API_KEY_STORAGE_KEY) || '';
}

function normalizeBaseUrl(url) {
    return url.replace(/\/+$/, '');
}

function normalizeProvider(value) {
    const provider = (value || DEFAULT_PROVIDER).toLowerCase();
    if (provider === 'deepseek' || provider === 'glm') {
        return provider;
    }
    return 'deepseek';
}

function sanitizeConfig(config, rawProvider) {
    const provider = normalizeProvider(config?.provider || rawProvider);
    const migratedFromLocal = rawProvider === 'ollama';
    const fallbackModel = DEFAULT_MODELS[provider];
    const fallbackBaseUrl = normalizeBaseUrl(DEFAULT_BASE_URLS[provider]);

    const model = migratedFromLocal || !config?.model || config.model === 'llama3.1:latest'
        ? fallbackModel
        : config.model;
    const baseUrl = migratedFromLocal || !config?.baseUrl || normalizeBaseUrl(config.baseUrl) === 'http://localhost:11434'
        ? fallbackBaseUrl
        : normalizeBaseUrl(config.baseUrl);

    return {
        ...config,
        provider,
        model,
        baseUrl,
        apiKey: config?.apiKey || DEFAULT_API_KEYS[provider]
    };
}

export function getLLMConfig() {
    const fallbackProvider = normalizeProvider(DEFAULT_PROVIDER);
    let config;

    // Try to load from localStorage first
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
        try {
            const parsed = JSON.parse(savedConfig);
            config = sanitizeConfig(parsed, parsed?.provider);
        } catch (e) {
            console.error('Failed to parse saved LLM config:', e);
        }
    }

    // Fallback to default configs for UI
    if (!config) {
        config = sanitizeConfig({
            provider: fallbackProvider,
            model: DEFAULT_MODELS[fallbackProvider],
            baseUrl: DEFAULT_BASE_URLS[fallbackProvider],
            apiKey: DEFAULT_API_KEYS[fallbackProvider]
        }, fallbackProvider);
    }

    if (import.meta.env.DEV && !config.apiKey) {
        console.warn(`[LLM] Provider "${config.provider}" is missing an API key`);
    }

    return config;
}

export function saveLLMConfig(config) {
    const rawProvider = config?.provider;
    const normalized = sanitizeConfig(config, rawProvider);
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
        headers: (() => {
            const bridgeApiKey = getBridgeApiKey();
            if (!bridgeApiKey) {
                return { 'Content-Type': 'application/json' };
            }
            return {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${bridgeApiKey}`
            };
        })(),
        body: JSON.stringify({
            model,
            provider,
            baseUrl,
            ...(apiKey ? { apiKey } : {}),
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
