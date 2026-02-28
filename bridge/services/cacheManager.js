/**
 * Cache Manager — JSON file-based cache
 * Each analysis result is stored as `<hash>.json` under `.cache/`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CACHE_DIR = resolve(__dirname, '..', '.cache');

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
}

export function has(hash) {
    return existsSync(join(CACHE_DIR, `${hash}.json`));
}

export function get(hash) {
    const filePath = join(CACHE_DIR, `${hash}.json`);
    if (!existsSync(filePath)) return null;
    try {
        return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

export function set(hash, data) {
    const entry = { ...data, hash, createdAt: Date.now() };
    writeFileSync(join(CACHE_DIR, `${hash}.json`), JSON.stringify(entry, null, 2));
    return entry;
}

export function list() {
    if (!existsSync(CACHE_DIR)) return [];
    return readdirSync(CACHE_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
}

/**
 * Remove cache entries older than maxAgeMs.
 * @param {number} maxAgeMs - Maximum age in milliseconds
 * @returns {number} Number of entries removed
 */
export function cleanup(maxAgeMs) {
    if (!existsSync(CACHE_DIR)) return 0;
    const now = Date.now();
    let removed = 0;

    for (const file of readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'))) {
        const filePath = join(CACHE_DIR, file);
        try {
            const data = JSON.parse(readFileSync(filePath, 'utf-8'));
            if (data.createdAt && (now - data.createdAt) > maxAgeMs) {
                unlinkSync(filePath);
                removed++;
            }
        } catch {
            // Corrupt file — remove it
            try { unlinkSync(filePath); removed++; } catch { /* ignore */ }
        }
    }
    return removed;
}

export default { has, get, set, list, cleanup };
