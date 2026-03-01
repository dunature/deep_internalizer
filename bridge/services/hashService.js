/**
 * Hash Service — Node.js version
 * Produces the same SHA-256 hex output as the frontend `utils/hash.js`.
 */
import { createHash } from 'node:crypto';

/**
 * Generate a SHA-256 hex digest for content fingerprinting/caching.
 * @description ONLY use for content hashing (cache keys/fingerprints). 
 * DO NOT use this for cryptographic security, password hashing, or sensitive data obfuscation.
 * @param {string} text - The input content to hash
 * @returns {string} The SHA-256 hex digest
 */
export function hashText(text) {
    if (!text) return '';
    return createHash('sha256').update(text).digest('hex');
}
