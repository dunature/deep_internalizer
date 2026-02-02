import { describe, it, expect, vi } from 'vitest';
import { parseFile } from '../fileParser';

// Mocking mammoth and pdfjs-dist
vi.mock('mammoth', () => ({
    default: {
        extractRawText: vi.fn(),
    }
}));

vi.mock('pdfjs-dist', () => ({
    GlobalWorkerOptions: {},
    getDocument: vi.fn(),
}));

describe('fileParser', () => {
    it('should parse a TXT file correctly', async () => {
        const content = 'This is a test document content.';
        const file = new File([content], 'test.txt', { type: 'text/plain' });

        const result = await parseFile(file);

        expect(result.title).toBe('test');
        expect(result.content).toBe(content);
    });

    it('should handle filenames with multiple dots', async () => {
        const file = new File([''], 'my.document.test.txt', { type: 'text/plain' });
        const result = await parseFile(file);
        expect(result.title).toBe('my.document.test');
    });
});
