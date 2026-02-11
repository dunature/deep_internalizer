export function computeTextMetrics(text = '') {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    const chars = text.length;
    const paragraphs = trimmed
        ? trimmed.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).length
        : 0;

    const sentences = trimmed
        ? trimmed
            .replace(/([.!?])\s+/g, '$1|')
            .split('|')
            .map(s => s.trim())
            .filter(Boolean).length
        : 0;

    const estimatedChunks = sentences > 0 ? Math.max(1, Math.round(sentences / 6)) : 0;

    return {
        words,
        chars,
        sentences,
        paragraphs,
        estimatedChunks
    };
}
