/**
 * Task Queue — in-memory task management
 * State machine: queued → processing → done | error
 */

const tasks = new Map();

const TASK_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes
const STUCK_TASK_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour

// Periodically clean up old tasks to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [taskId, task] of tasks.entries()) {
        if (task.status === 'done' || task.status === 'error') {
            if (now - task.updatedAt > TASK_EXPIRATION_MS) {
                tasks.delete(taskId);
            }
        } else {
            // Also clean up stuck tasks
            if (now - task.updatedAt > STUCK_TASK_EXPIRATION_MS) {
                tasks.delete(taskId);
            }
        }
    }
}, 60 * 1000).unref();

export function create(taskId, hash, content, options = {}) {
    const task = {
        taskId,
        contentHash: hash,
        status: 'queued',
        content,
        options,
        result: null,
        error: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    tasks.set(taskId, task);
    return task;
}

export function get(taskId) {
    return tasks.get(taskId) || null;
}

export function setProcessing(taskId) {
    const task = tasks.get(taskId);
    if (!task) return null;
    task.status = 'processing';
    task.updatedAt = Date.now();
    return task;
}

export function setDone(taskId, result) {
    const task = tasks.get(taskId);
    if (!task) return null;
    task.status = 'done';
    task.result = result;
    task.updatedAt = Date.now();
    return task;
}

export function setError(taskId, error) {
    const task = tasks.get(taskId);
    if (!task) return null;
    task.status = 'error';
    task.error = error instanceof Error ? error.message : String(error);
    task.updatedAt = Date.now();
    return task;
}

/**
 * Get a safe-to-serialize view of the task (strips raw content).
 */
export function getPublic(taskId) {
    const task = tasks.get(taskId);
    if (!task) return null;
    const { content, ...rest } = task;
    return rest;
}

export default { create, get, getPublic, setProcessing, setDone, setError };
