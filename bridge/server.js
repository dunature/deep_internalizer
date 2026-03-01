/**
 * Deep Internalizer — Bridge Server
 * Connects CLI / Claude Code → AI Processing → Cache → Frontend
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import contentRoutes from './routes/content.js';
import taskRoutes from './routes/tasks.js';
import cacheRoutes from './routes/cache.js';
import llmRoutes from './routes/llm.js';
import { requireAuth } from './middleware/authMiddleware.js';
import cacheManager from './services/cacheManager.js';

const app = express();
const PORT = parseInt(process.env.BRIDGE_PORT || '3737', 10);
const FRONTEND_URL = process.env.BRIDGE_FRONTEND_URL || 'http://localhost:5173';

// ── Middleware ──────────────────────────────────────────────────

// Security headers
app.use(helmet());

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

// Only allow configured frontend URL (default to localhost:5173 for dev fallback)
const allowedOrigins = process.env.BRIDGE_FRONTEND_URL ? [process.env.BRIDGE_FRONTEND_URL] : ['http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '5mb' }));

// ── Routes ─────────────────────────────────────────────────────

// Mount auth middleware on protected routes
app.use('/api/content', requireAuth, analyzeLimiter, contentRoutes);  // Analysis endpoint with stricter limit
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/cache', requireAuth, cacheRoutes);
app.use('/api/llm', requireAuth, llmRoutes);

app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// ── Error handler ──────────────────────────────────────────────

app.use((err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const isOperational = err.isOperational || false;

    console.error(`[Server] ${req.method} ${req.path}:`, err.stack || err);

    res.status(status).json({
        error: isOperational ? err.message : (status === 500 ? 'Internal server error' : err.message),
        code: err.code || 'UNKNOWN_ERROR'
    });
});

// ── Background Tasks ───────────────────────────────────────────

function scheduleCacheCleanup() {
    // Clean up 30-day old cache files daily at 2:00 AM
    const CLEANUP_TIME = 2 * 60 * 60 * 1000; // 2:00 AM offset
    const INTERVAL = 24 * 60 * 60 * 1000;    // 24 hours
    const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

    const now = new Date();
    const millisSinceMidnight = now.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let delayToNextRun = CLEANUP_TIME - millisSinceMidnight;

    // If we're already past 2 AM today, schedule for tomorrow
    if (delayToNextRun < 0) {
        delayToNextRun += INTERVAL;
    }

    setTimeout(function runCleanup() {
        cacheManager.cleanup(MAX_AGE)
            .then(count => {
                if (count > 0) console.log(`[Cache] Cleaned ${count} old cache entries.`);
            })
            .catch(e => console.error('[Cache] Cleanup failed:', e));

        setTimeout(runCleanup, INTERVAL).unref();
    }, delayToNextRun).unref();
}

scheduleCacheCleanup();

// ── Start ──────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\n🌉 Bridge Server running at http://localhost:${PORT}`);
    console.log(`   Frontend URL: ${FRONTEND_URL}`);
    console.log(`   LLM Provider: ${process.env.LLM_PROVIDER || 'ollama'}`);
    console.log(`   LLM Model:    ${process.env.LLM_MODEL || 'qwen2.5:7b'}\n`);
});
