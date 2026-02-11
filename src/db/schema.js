/**
 * Deep Internalizer - Database Schema
 * Using Dexie.js (IndexedDB wrapper)
 */
import Dexie from 'dexie';

// Create database instance
export const db = new Dexie('DeepInternalizer');

// Define schema
db.version(3).stores({
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
  userStats: 'date',

  // === CACHING TABLES ===
  // Word audio cache (TTS)
  wordAudio: 'word, createdAt',

  // Syllable audio cache (common syllables only)
  syllableAudio: 'syllable, createdAt',

  // LLM response cache for keywords
  chunkKeywords: 'chunkId',

  // Sentence translations cache
  sentenceTranslations: 'chunkId'
});

db.version(4).stores({
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
  userStats: 'date',

  // === CACHING TABLES ===
  // Word audio cache (TTS)
  wordAudio: 'word, createdAt',

  // Syllable audio cache (common syllables only)
  syllableAudio: 'syllable, createdAt',

  // LLM response cache for keywords
  chunkKeywords: 'chunkId',

  // Sentence translations cache
  sentenceTranslations: 'chunkId',

  // Document analysis cache (core thesis + chunks)
  analysisCache: 'hash, createdAt'
});

db.version(5).stores({
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
  userStats: 'date',

  // === CACHING TABLES ===
  // Word audio cache (TTS)
  wordAudio: 'word, createdAt',

  // Syllable audio cache (common syllables only)
  syllableAudio: 'syllable, createdAt',

  // LLM response cache for keywords
  chunkKeywords: 'chunkId',

  // Sentence translations cache
  sentenceTranslations: 'chunkId',

  // Document analysis cache (core thesis + chunks)
  analysisCache: 'hash, createdAt',

  // Thought groups cache for sentences
  thoughtGroups: 'hash, createdAt'
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

const MAX_ANALYSIS_CACHE_SIZE = 20;
const MAX_THOUGHT_GROUP_CACHE_SIZE = 400;

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

export async function createChunk(docId, index, title, summary, originalText, summary_zh = '') {
  const id = crypto.randomUUID();

  await db.chunks.add({
    id,
    docId,
    index,
    title,
    summary,
    summary_zh,
    originalText,
    currentStep: 1,
    totalSteps: 4,
    completed: false
  });

  return id;
}

export async function createChunksBulk(docId, chunks = [], options = {}) {
  if (!chunks.length) return [];

  const { batchSize = 50, onBatch } = options;
  const ids = [];
  const total = chunks.length;
  const batchCount = Math.ceil(total / batchSize);

  for (let start = 0, batchIndex = 0; start < total; start += batchSize, batchIndex += 1) {
    const slice = chunks.slice(start, start + batchSize);
    const records = slice.map((chunk, offset) => {
      const id = crypto.randomUUID();
      ids.push(id);

      return {
        id,
        docId,
        index: start + offset,
        title: chunk.title,
        summary: chunk.summary,
        summary_zh: chunk.summary_zh || '',
        originalText: chunk.originalText,
        currentStep: 1,
        totalSteps: 4,
        completed: false
      };
    });

    await db.chunks.bulkAdd(records);

    if (typeof onBatch === 'function') {
      onBatch({
        batchIndex,
        batchCount,
        inserted: Math.min(start + slice.length, total),
        total
      });
    }
  }

  return ids;
}

export async function createWord(chunkId, text, phonetic, definition, originalContext, newContext = '', slices = [], pos = '', definition_zh = '') {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.words.add({
    id,
    chunkId,
    text,
    phonetic,
    pos,
    definition,
    definition_zh,
    originalContext,
    newContext,
    slices,
    status: WordStatus.PENDING,
    addedAt: now
  });

  return id;
}

export async function createWordIfMissing(chunkId, text, phonetic, definition, originalContext, newContext = '', slices = [], pos = '', definition_zh = '') {
  if (!chunkId || !text) {
    return { created: false, reason: 'missing-data' };
  }

  const existing = await db.words
    .where('chunkId')
    .equals(chunkId)
    .and(word => word.text === text)
    .first();

  if (existing) {
    return { created: false, id: existing.id, reason: 'duplicate' };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.words.add({
    id,
    chunkId,
    text,
    phonetic,
    pos,
    definition,
    definition_zh,
    originalContext,
    newContext,
    slices,
    status: WordStatus.PENDING,
    addedAt: now
  });

  return { created: true, id };
}

export function getDateKey(date = new Date()) {
  if (typeof date === 'string') return date;
  return date.toISOString().split('T')[0];
}

export async function incrementUserStats({ date = new Date(), segments = 0, words = 0 } = {}) {
  if (!segments && !words) return null;

  const dateKey = getDateKey(date);
  const existing = await db.userStats.get(dateKey);
  const next = {
    date: dateKey,
    segments: (existing?.segments || 0) + segments,
    words: (existing?.words || 0) + words
  };

  await db.userStats.put(next);
  return next;
}

export async function addReviewRecord(wordId, action) {
  if (!wordId || !action) return null;
  const id = crypto.randomUUID();
  const reviewedAt = new Date().toISOString();
  await db.reviewRecords.add({ id, wordId, action, reviewedAt });
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

export async function getAnalysisCache(hash) {
  if (!hash) return null;
  return await db.analysisCache.get(hash);
}

export async function setAnalysisCache(hash, coreThesis, chunks, model = '', summary = '') {
  if (!hash) return;
  await db.analysisCache.put({
    hash,
    coreThesis,
    chunks,
    summary,
    model,
    createdAt: Date.now()
  });

  try {
    const count = await db.analysisCache.count();
    if (count > MAX_ANALYSIS_CACHE_SIZE) {
      const toDelete = count - MAX_ANALYSIS_CACHE_SIZE;
      const oldest = await db.analysisCache
        .orderBy('createdAt')
        .limit(toDelete)
        .toArray();
      await db.analysisCache.bulkDelete(oldest.map(item => item.hash));
    }
  } catch (error) {
    console.warn('[Cache] Analysis cache cleanup failed:', error);
  }
}

export async function getThoughtGroupsCache(hash) {
  if (!hash) return null;
  return await db.thoughtGroups.get(hash);
}

export async function setThoughtGroupsCache(hash, groups, model = '') {
  if (!hash) return;
  await db.thoughtGroups.put({
    hash,
    groups,
    model,
    createdAt: Date.now()
  });

  try {
    const count = await db.thoughtGroups.count();
    if (count > MAX_THOUGHT_GROUP_CACHE_SIZE) {
      const toDelete = count - MAX_THOUGHT_GROUP_CACHE_SIZE;
      const oldest = await db.thoughtGroups
        .orderBy('createdAt')
        .limit(toDelete)
        .toArray();
      await db.thoughtGroups.bulkDelete(oldest.map(item => item.hash));
    }
  } catch (error) {
    console.warn('[Cache] Thought group cache cleanup failed:', error);
  }
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
