/**
 * Content routes — POST /api/content/analyze
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { hashText } from '../services/hashService.js';
import * as cache from '../services/cacheManager.js';
import * as queue from '../services/taskQueue.js';
import { analyzeContent } from '../services/aiProcessor.js';

const router = Router();

const MAX_CONTENT_LENGTH = 50_000;

router.post('/analyze', async (req, res) => {
    const { content, title, cacheOnly = false, source = 'unknown' } = req.body;

    if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'content is required and must be a string' });
    }
    if (content.length > MAX_CONTENT_LENGTH) {
        return res.status(400).json({ error: `content exceeds ${MAX_CONTENT_LENGTH} characters` });
    }

    const contentHash = hashText(content);

    // Cache hit?
    const cached = cache.get(contentHash);
    if (cached) {
        console.log(`[Content] Cache hit for ${contentHash.substring(0, 12)}...`);
        return res.json({
            taskId: null,
            contentHash,
            status: 'cached',
            cacheHit: true,
            result: cached
        });
    }

    // Create task
    const taskId = randomUUID();
    queue.create(taskId, contentHash, content, { title, cacheOnly, source });

    console.log(`[Content] Task ${taskId} queued for ${contentHash.substring(0, 12)}... (${content.length} chars)`);

    // Process asynchronously (fire-and-forget)
    processTask(taskId, contentHash, content, title).catch(err => {
        console.error(`[Content] Task ${taskId} failed:`, err.message);
    });

    res.status(202).json({
        taskId,
        contentHash,
        status: 'queued',
        cacheHit: false
    });
});

async function processTask(taskId, hash, content, title) {
    queue.setProcessing(taskId);

    try {
        const result = await analyzeContent(content);

        // Attach title
        result.title = title || inferTitle(content);

        // Store in cache
        cache.set(hash, result);

        // Update task
        queue.setDone(taskId, { hash, ...result });
        console.log(`[Content] Task ${taskId} done — ${result.chunks.length} chunks.`);
    } catch (err) {
        queue.setError(taskId, err);
        throw err;
    }
}

function inferTitle(text) {
    const firstLine = text.split('\n').find(l => l.trim().length > 0) || '';
    return firstLine.substring(0, 80).trim() || 'Untitled';
}

export default router;
