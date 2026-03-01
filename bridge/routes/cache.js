/**
 * Cache routes — GET/POST /api/cache
 */
import { Router } from 'express';
import { z } from 'zod';
import * as cache from '../services/cacheManager.js';
import { hashText } from '../services/hashService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Cache injection limiter: 30 requests per 10 minutes per IP
const cacheLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    message: { error: 'Too many cache writing requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Query cache by content hash
// Can remain unauthenticated if cache logic allows public reading, but usually best to protect.
router.get('/:contentHash', requireAuth, asyncHandler(async (req, res) => {
    const data = await cache.get(req.params.contentHash);
    if (!data) {
        return res.status(404).json({ error: 'Cache miss' });
    }
    res.json(data);
}));

// Zod Schema for Cache Payload
const cachePayloadSchema = z.object({
    content: z.string().optional(),
    hash: z.string().optional(),
    coreThesis: z.string().optional(),
    chunks: z.array(z.any()).optional(),
    model: z.string().optional(),
    summary: z.string().optional()
}).refine(data => data.content || data.hash, {
    message: "Either content or hash must be provided"
});

// Manually write to cache (e.g. from frontend sync)
router.post('/', requireAuth, cacheLimiter, asyncHandler(async (req, res) => {
    const validation = cachePayloadSchema.safeParse(req.body);

    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid payload', details: validation.error.format() });
    }

    const { content, coreThesis, chunks, model, summary, hash: reqHash } = validation.data;

    if (!content && !reqHash) {
        return res.status(400).json({ error: 'content or hash is required' });
    }

    // Basic Structure Validation to prevent pollution
    if (chunks && !Array.isArray(chunks)) {
        return res.status(400).json({ error: 'chunks must be an array' });
    }

    // Limit chunk count size if necessary (e.g. 500 chunks)
    if (chunks && chunks.length > 500) {
        return res.status(400).json({ error: 'Payload too large: maximum 500 chunks allowed' });
    }

    const hash = reqHash || hashText(content);

    // Ensure all critical fields are stored together
    const cacheData = {
        coreThesis: coreThesis || null,
        chunks: chunks || [],
        model: model || 'unknown',
        summary: summary || null
    };

    const entry = await cache.set(hash, cacheData);
    res.status(201).json({ hash, cached: true, createdAt: entry.createdAt });
}));

export default router;
