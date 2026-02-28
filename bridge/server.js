/**
 * Deep Internalizer — Bridge Server
 * Connects CLI / Claude Code → AI Processing → Cache → Frontend
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import contentRoutes from './routes/content.js';
import taskRoutes from './routes/tasks.js';
import cacheRoutes from './routes/cache.js';

const app = express();
const PORT = parseInt(process.env.BRIDGE_PORT || '3737', 10);
const FRONTEND_URL = process.env.BRIDGE_FRONTEND_URL || 'http://localhost:5173';

// ── Middleware ──────────────────────────────────────────────────

// Request logging
app.use(morgan('combined'));

// Global rate limit: 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(globalLimiter);

// Stricter limit for analysis endpoint (AI processing is expensive)
const analyzeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { error: 'Analysis limit exceeded, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(cors({ origin: [FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '5mb' }));

// ── Routes ─────────────────────────────────────────────────────

app.use('/api/content', analyzeLimiter, contentRoutes);  // Analysis endpoint with stricter limit
app.use('/api/tasks', taskRoutes);
app.use('/api/cache', cacheRoutes);

app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// ── Error handler ──────────────────────────────────────────────

app.use((err, _req, res, _next) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ── Start ──────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\n🌉 Bridge Server running at http://localhost:${PORT}`);
    console.log(`   Frontend URL: ${FRONTEND_URL}`);
    console.log(`   LLM Provider: ${process.env.LLM_PROVIDER || 'ollama'}`);
    console.log(`   LLM Model:    ${process.env.LLM_MODEL || 'qwen2.5:7b'}\n`);
});
