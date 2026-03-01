/**
 * Cache Manager — JSON file-based cache
 * Each analysis result is stored as `<hash>.json` under `.cache/`.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile, readdir, unlink, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CACHE_DIR = resolve(__dirname, '..', '.cache');

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
}

export async function has(hash) {
    try { await access(join(CACHE_DIR, `${hash}.json`)); return true; } catch { return false; }
}

export async function get(hash) {
    const filePath = join(CACHE_DIR, `${hash}.json`);
    try {
        const data = await readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch {
        return null;
    }
}

export async function set(hash, data) {
    const entry = { ...data, hash, createdAt: Date.now() };
    await writeFile(join(CACHE_DIR, `${hash}.json`), JSON.stringify(entry, null, 2));
    return entry;
}

export async function list() {
    try {
        const files = await readdir(CACHE_DIR);
        return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    } catch {
        return [];
    }
}

/**
 * Remove cache entries older than maxAgeMs.
 * @param {number} maxAgeMs - Maximum age in milliseconds
 * @returns {Promise<number>} Number of entries removed
 */
export async function cleanup(maxAgeMs) {
    const now = Date.now();
    let removed = 0;

    try {
        const files = await readdir(CACHE_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        await Promise.all(jsonFiles.map(async (file) => {
            const filePath = join(CACHE_DIR, file);
            try {
                const text = await readFile(filePath, 'utf-8');
                const data = JSON.parse(text);
                if (data.createdAt && (now - data.createdAt) > maxAgeMs) {
                    await unlink(filePath);
                    removed++;
                }
            } catch {
                // Corrupt file — remove it
                try { await unlink(filePath); removed++; } catch { /* ignore */ }
            }
        }));
    } catch {
        return 0; // directory might not exist or is inaccessible
    }

    return removed;
}

export default { has, get, set, list, cleanup };
