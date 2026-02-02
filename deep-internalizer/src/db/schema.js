/**
 * Deep Internalizer - Database Schema
 * Using Dexie.js (IndexedDB wrapper)
 */
import Dexie from 'dexie';

// Create database instance
export const db = new Dexie('DeepInternalizer');

// Define schema
db.version(1).stores({
  // Documents: imported articles/texts
  documents: 'id, title, importedAt, lastAccessedAt',
  
  // Chunks: semantic segments of documents
  chunks: 'id, docId, index, completed',
  
  // Words: vocabulary items extracted from chunks
  words: 'id, chunkId, text, status, addedAt',
  
  // Review records: history of word reviews
  reviewRecords: 'id, wordId, action, reviewedAt',
  
  // Reading sessions: state persistence for resume
  readingSessions: 'docId',
  
  // User stats: daily progress for heatmap
  userStats: 'date'
});

// Enums
export const WordStatus = {
  PENDING: 'pending',
  REVIEWING: 'reviewing',
  ARCHIVED: 'archived'
};

export const ReviewAction = {
  KEEP: 'keep',
  ARCHIVE: 'archive'
};

// Helper functions
export async function createDocument(title, rawContent, coreThesis = '') {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  await db.documents.add({
    id,
    title,
    rawContent,
    coreThesis,
    importedAt: now,
    lastAccessedAt: now
  });
  
  return id;
}

export async function createChunk(docId, index, title, summary, originalText) {
  const id = crypto.randomUUID();
  
  await db.chunks.add({
    id,
    docId,
    index,
    title,
    summary,
    originalText,
    currentStep: 1,
    totalSteps: 4,
    completed: false
  });
  
  return id;
}

export async function createWord(chunkId, text, phonetic, definition, originalContext) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  await db.words.add({
    id,
    chunkId,
    text,
    phonetic,
    definition,
    originalContext,
    newContext: '', // Will be filled by AI
    status: WordStatus.PENDING,
    addedAt: now
  });
  
  return id;
}

export async function getPendingWords() {
  return await db.words
    .where('status')
    .equals(WordStatus.PENDING)
    .toArray();
}

export async function getDocumentWithChunks(docId) {
  const doc = await db.documents.get(docId);
  if (!doc) return null;
  
  const chunks = await db.chunks
    .where('docId')
    .equals(docId)
    .sortBy('index');
  
  return { ...doc, chunks };
}

export async function saveReadingSession(session) {
  const now = new Date().toISOString();
  await db.readingSessions.put({
    ...session,
    updatedAt: now
  });
}

export async function getLatestSession() {
  const sessions = await db.readingSessions.toArray();
  if (sessions.length === 0) return null;
  
  return sessions.sort((a, b) => 
    new Date(b.updatedAt) - new Date(a.updatedAt)
  )[0];
}

export default db;
