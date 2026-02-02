import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chunkDocument, extractKeywords, generateNewContext } from '../chunkingService';

describe('chunkingService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('chunkDocument', () => {
        it('should return a single chunk for short texts without calling API', async () => {
            const shortText = 'This is sentence one. This is sentence two.';
            const result = await chunkDocument(shortText);

            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Complete Text');
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should call API and parse response for long texts', async () => {
            const longText = 'Sentence 1. Sentence 2. Sentence 3. Sentence 4. Sentence 5. Sentence 6.';
            const mockResponse = {
                response: JSON.stringify([
                    {
                        title: 'Test Chunk',
                        summary: 'Test summary',
                        startIndex: 0,
                        endIndex: 2
                    }
                ])
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const result = await chunkDocument(longText);

            expect(global.fetch).toHaveBeenCalled();
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Test Chunk');
            expect(result[0].originalText).toContain('Sentence 1');
        });

        it('should handle markdown JSON blocks in API response', async () => {
            const longText = 'Sentence 1. Sentence 2. Sentence 3. Sentence 4. Sentence 5. Sentence 6.';
            const mockResponse = {
                response: '```json\n[\n  {\n    "title": "MD Chunk",\n    "summary": "MD summary",\n    "startIndex": 0,\n    "endIndex": 5\n  }\n]\n```'
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const result = await chunkDocument(longText);
            expect(result[0].title).toBe('MD Chunk');
        });
    });

    describe('extractKeywords', () => {
        it('should extract keywords from chunk text', async () => {
            const chunkText = 'The aggregate data was useful.';
            const mockKeywords = [
                {
                    word: 'aggregate',
                    phonetic: '/ˈæɡrɪɡeɪt/',
                    definition: 'to collect',
                    sentence: 'The aggregate data was useful.'
                }
            ];

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ response: JSON.stringify(mockKeywords) })
            });

            const result = await extractKeywords(chunkText);
            expect(result).toEqual(mockKeywords);
        });
    });
});
