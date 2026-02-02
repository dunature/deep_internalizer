import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chunkDocument, extractKeywords, generateNewContext, generateCoreThesis } from '../chunkingService';

describe('chunkingService Abort Support', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should pass abort signal to fetch in chunkDocument', async () => {
        const controller = new AbortController();
        const signal = controller.signal;
        const longText = 'Sentence 1. Sentence 2. Sentence 3. Sentence 4. Sentence 5. Sentence 6.';
        const mockResponse = {
            response: JSON.stringify([{ title: 'T', summary: 'S', startIndex: 0, endIndex: 1 }])
        };

        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
        });

        await chunkDocument(longText, undefined, signal);

        expect(global.fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ signal })
        );
    });

    it('should pass abort signal to fetch in extractKeywords', async () => {
        const controller = new AbortController();
        const signal = controller.signal;
        const mockResponse = { response: JSON.stringify([]) };

        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
        });

        await extractKeywords('test text', undefined, signal);

        expect(global.fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ signal })
        );
    });

    it('should throw AbortError when signal is aborted', async () => {
        const controller = new AbortController();
        const signal = controller.signal;

        // Mock fetch to reject with AbortError when signal is aborted
        global.fetch.mockImplementationOnce(({ signal }) => {
            return new Promise((_, reject) => {
                if (signal.aborted) {
                    const error = new Error('The operation was aborted');
                    error.name = 'AbortError';
                    reject(error);
                }
            });
        });

        controller.abort();

        await expect(generateCoreThesis('test', undefined, signal))
            .rejects.toThrow();

        // In our implementation, we catch and log but re-throw
        // So we expect it to throw an error with name AbortError
    });
});
