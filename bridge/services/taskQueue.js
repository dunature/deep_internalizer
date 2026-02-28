/**
 * Task Queue — in-memory task management
 * State machine: queued → processing → done | error
 */

const tasks = new Map();

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
