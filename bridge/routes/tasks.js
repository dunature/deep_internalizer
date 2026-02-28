/**
 * Task routes — GET /api/tasks/:taskId
 */
import { Router } from 'express';
import * as queue from '../services/taskQueue.js';

const router = Router();

router.get('/:taskId', (req, res) => {
    const task = queue.getPublic(req.params.taskId);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
});

export default router;
