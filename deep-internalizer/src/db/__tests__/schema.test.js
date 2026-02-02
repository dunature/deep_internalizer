import { describe, it, expect, beforeEach } from 'vitest';
import { db, createDocument, createChunk, getDocumentWithChunks } from '../schema';

describe('Database Schema', () => {
    beforeEach(async () => {
        // Clear all tables before each test
        await db.documents.clear();
        await db.chunks.clear();
        await db.words.clear();
        await db.readingSessions.clear();
    });

    it('should create and retrieve a document with chunks', async () => {
        const docId = await createDocument('Test Title', 'Test Content', 'Core Thesis');
        await createChunk(docId, 0, 'Chunk 1', 'Summary 1', 'Text 1');
        await createChunk(docId, 1, 'Chunk 2', 'Summary 2', 'Text 2');

        const doc = await getDocumentWithChunks(docId);

        expect(doc.title).toBe('Test Title');
        expect(doc.chunks).toHaveLength(2);
        expect(doc.chunks[0].title).toBe('Chunk 1');
        expect(doc.chunks[1].index).toBe(1);
    });

    it('should return null for non-existent document', async () => {
        const doc = await getDocumentWithChunks('invalid-id');
        expect(doc).toBeNull();
    });
});
