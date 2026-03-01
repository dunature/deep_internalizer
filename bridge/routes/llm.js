/**
 * LLM Proxy Route
 * Secures requests from the frontend and forwards them to the backend-configured LLM provider.
 */
import { Router } from 'express';
import { callLLM } from '../services/aiProcessor.js';

const router = Router();

router.post('/chat', async (req, res) => {
    try {
        const { system, user, temperature, maxTokens, model } = req.body;

        if (!user) {
            return res.status(400).json({ error: 'User prompt is required' });
        }

        const response = await callLLM({
            system,
            user,
            temperature,
            maxTokens,
            model // Only allow overriding model name, not base URL or API keys
        });

        res.json({ content: response });
    } catch (error) {
        console.error('[LLM Proxy Error]:', error.message);
        res.status(500).json({ error: error.message || 'LLM completion failed' });
    }
});

export default router;
