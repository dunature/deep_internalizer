/**
 * String utilities for Deep Internalizer
 */

/**
 * Escape special RegExp characters to prevent injection
 * @param {string} string - String to escape
 * @returns {string} - Escaped string safe for RegExp
 */
export function escapeRegExp(string) {
    if (!string) return '';
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a case-insensitive RegExp for word matching
 * @param {string} word - Word to match
 * @returns {RegExp} - Safe RegExp for matching
 */
export function createWordMatcher(word) {
    if (!word) return null;
    return new RegExp(`(${escapeRegExp(word)})`, 'gi');
}
