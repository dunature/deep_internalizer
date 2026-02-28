/**
 * Hash Service — Node.js version
 * Produces the same SHA-256 hex output as the frontend `utils/hash.js`.
 */
import { createHash } from 'node:crypto';

export function hashText(text) {
    if (!text) return '';
    return createHash('sha256').update(text).digest('hex');
}
