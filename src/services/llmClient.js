/**
 * LLM Client
 * Supports local Ollama and remote DeepSeek / GLM (OpenAI-compatible)
 */

const DEFAULT_PROVIDER = import.meta.env.VITE_LLM_PROVIDER || 'ollama';

const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'llama3.1:latest';

const DEEPSEEK_BASE_URL = import.meta.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const DEEPSEEK_MODEL = import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-chat';

const GLM_BASE_URL = import.meta.env.VITE_GLM_BASE_URL || 'https://api.z.ai/api/paas/v4';
const GLM_MODEL = import.meta.env.VITE_GLM_MODEL || 'glm-4.7';

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

    // Fallback to environment variables
    const provider = DEFAULT_PROVIDER.toLowerCase();
    if (provider === 'deepseek') {
        return {
            provider,
            baseUrl: normalizeBaseUrl(DEEPSEEK_BASE_URL),
            model: DEEPSEEK_MODEL,
            apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY || ''
        };
    }
    if (provider === 'glm') {
        return {
            provider,
            baseUrl: normalizeBaseUrl(GLM_BASE_URL),
            model: GLM_MODEL,
            apiKey: import.meta.env.VITE_GLM_API_KEY || ''
        };
    }

    return {
        provider: 'ollama',
        baseUrl: normalizeBaseUrl(OLLAMA_BASE_URL),
        model: OLLAMA_MODEL,
        apiKey: ''
    };
}

export function saveLLMConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

async function callOllama({ baseUrl, model, prompt, temperature = 0.3, maxTokens = 2048, signal }) {
    const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            prompt,
            stream: false,
            options: {
                temperature,
                num_predict: maxTokens
            }
        }),
        signal
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
}

async function callOpenAICompatible({ baseUrl, apiKey, model, messages, temperature = 0.3, maxTokens = 2048, signal }) {
    if (!apiKey) {
        throw new Error('Missing API key for remote LLM provider');
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: false
        }),
        signal
    });

    const data = await response.json();

    if (!response.ok) {
        const message = data?.error?.message || `LLM API error: ${response.status}`;
        throw new Error(message);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('LLM returned empty content');
    }

    return content;
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

    if (config.provider === 'ollama') {
        const prompt = system ? `${system}\n\n${user}` : user;
        return callOllama({
            baseUrl: config.baseUrl,
            model: resolvedModel,
            prompt,
            temperature,
            maxTokens,
            signal
        });
    }

    const messages = system
        ? [
            { role: 'system', content: system },
            { role: 'user', content: user }
        ]
        : [{ role: 'user', content: user }];

    return callOpenAICompatible({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: resolvedModel,
        messages,
        temperature,
        maxTokens,
        signal
    });
}
