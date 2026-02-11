/**
 * Hash utilities for cache keys
 */

function fallbackHash(text) {
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = (hash * 33) ^ text.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
}

export async function hashText(text) {
    if (!text) return '';
    if (globalThis.crypto?.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    return fallbackHash(text);
}
