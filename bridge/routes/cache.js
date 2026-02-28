/**
 * Cache routes — GET/POST /api/cache
 */
import { Router } from 'express';
import * as cache from '../services/cacheManager.js';
import { hashText } from '../services/hashService.js';

const router = Router();

// Query cache by content hash
router.get('/:contentHash', (req, res) => {
    const data = cache.get(req.params.contentHash);
    if (!data) {
        return res.status(404).json({ error: 'Cache miss' });
    }
    res.json(data);
});

// Manually write to cache (e.g. from frontend sync)
router.post('/', (req, res) => {
    const { content, coreThesis, chunks, model, summary } = req.body;

    if (!content && !req.body.hash) {
        return res.status(400).json({ error: 'content or hash is required' });
    }

    const hash = req.body.hash || hashText(content);
    const entry = cache.set(hash, { coreThesis, chunks, model, summary });
    res.status(201).json({ hash, cached: true, createdAt: entry.createdAt });
});

export default router;
