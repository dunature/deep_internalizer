/**
 * HighlightedText Component
 * Highlights a specific word/phrase within text
 * Used across VocabularyCard, ABCard, and SegmentLoop
 */
import { useMemo } from 'react';
import { createWordMatcher } from '../../utils/stringUtils';
import styles from './HighlightedText.module.css';

/**
 * @param {object} props
 * @param {string} props.text - Text to display
 * @param {string} props.highlight - Word/phrase to highlight
 * @param {string} [props.className] - Optional wrapper className
 * @param {string} [props.highlightClassName] - Optional highlight className
 * @param {React.ElementType} [props.as='p'] - Wrapper element type (use 'span' or null for inline)
 */
export default function HighlightedText({
    text,
    highlight,
    className = '',
    highlightClassName = '',
    as: Wrapper = 'p'
}) {
    const parts = useMemo(() => {
        if (!text) return [];
        if (!highlight) return [text];

        const regex = createWordMatcher(highlight);
        if (!regex) return [text];

        return text.split(regex);
    }, [text, highlight]);

    if (!text) return null;

    const highlightClass = highlightClassName || styles.highlight;

    const content = !highlight || parts.length === 1
        ? text
        : parts.map((part, i) =>
            part.toLowerCase() === highlight.toLowerCase()
                ? <mark key={i} className={highlightClass}>{part}</mark>
                : part
        );

    // Allow rendering without wrapper (for inline usage)
    if (Wrapper === null) {
        return <>{content}</>;
    }

    return <Wrapper className={className}>{content}</Wrapper>;
}
