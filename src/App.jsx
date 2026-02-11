/**
 * Deep Internalizer - Main App Component
 */
import { useState, useEffect, useRef } from 'react';
import { GlobalBlueprint } from './components/Layer0';
import { SegmentLoop } from './components/Layer1';
import { VocabularyReview } from './components/Vocabulary';
import { LaunchInterception, ImportModal, UserProfile, PWAPrompt, OfflineIndicator } from './components/common';
import { useAppStore } from './stores/appStore';
import {
  db,
  createDocument,
  createChunksBulk,
  createWordIfMissing,
  getDocumentWithChunks,
  getPendingWords,
  getAnalysisCache,
  setAnalysisCache,
  incrementUserStats,
  addReviewRecord,
  WordStatus,
  ReviewAction,
  saveReadingSession
} from './db/schema';
import {
  chunkDocument,
  generateCoreThesis,
  generateDocumentSummary
} from './services/chunkingService';
import { getLLMConfig } from './services/llmClient';
import { hashText } from './utils/hash';
import { computeTextMetrics } from './utils/textMetrics';
import { prefetchService } from './services/prefetchService';
import './App.css';

// View states
const VIEW = {
  INTERCEPTION: 'interception',
  REVIEW: 'review',
  EMPTY: 'empty',
  LAYER0: 'layer0',
  LAYER1: 'layer1',
  PROFILE: 'profile'
};

const IMPORT_STEPS = [
  { key: 'INITIALIZING', label: 'Initialize' },
  { key: 'SUMMARIZING', label: 'Summarize Document' },
  { key: 'CHUNKING', label: 'Semantic Chunking' },
  { key: 'PERSISTENCE', label: 'Create Document' },
  { key: 'SAVING', label: 'Save Chunks' },
  { key: 'PREFETCH_KEYWORDS', label: 'Preload Keywords' },
  { key: 'COMPLETE', label: 'Complete' }
];

function App() {
  const {
    currentDocId,
    pendingWordCount,
    emergencyAccessLeft,
    currentChunkIndex,
    currentStep,
    isLoading,
    setLoading,
    setCurrentDocument,
    setCurrentChunk,
    setCurrentStep,
    checkDebt,
    grantEmergencyAccess,
    restoreSession
  } = useAppStore();

  const [document, setDocument] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [chunkWords, setChunkWords] = useState([]);
  const [pendingWords, setPendingWords] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [processingLogs, setProcessingLogs] = useState([]);
  const [processingStep, setProcessingStep] = useState('');
  const [processingMeta, setProcessingMeta] = useState(null);
  const [currentView, setCurrentView] = useState(VIEW.EMPTY);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [summaryNotice, setSummaryNotice] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [pendingImport, setPendingImport] = useState(null);

  // Async operation guard: prevents stale callbacks from updating state
  const asyncOperationIdRef = useRef(0);
  // AbortController for cancelling in-flight network requests
  const abortControllerRef = useRef(null);

  // Helper to cancel any pending async operations
  const cancelPendingOperations = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    asyncOperationIdRef.current++;
  };

  const addLog = (message, type = 'active') => {
    setProcessingLogs(prev => {
      // Mark previous active log as done
      const updated = prev.map(log =>
        log.type === 'active' ? { ...log, type: 'done' } : log
      );
      return [...updated, {
        message,
        timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type
      }];
    });
  };

  const initProcessingMeta = (content, provider, model, parseMetrics) => {
    const docStats = computeTextMetrics(content);
    setProcessingMeta({
      startedAt: Date.now(),
      provider,
      model,
      cacheStatus: 'unknown',
      actualChunks: null,
      docStats,
      timings: {
        parseMs: parseMetrics?.parseMs ?? null,
        cleanMs: parseMetrics?.cleanMs ?? null,
        summaryMs: null,
        chunkingMs: null,
        persistenceMs: null,
        saveMs: null,
        keywordMs: null
      },
      steps: {},
      saveProgress: null,
      keywordProgress: null
    });
  };

  const updateProcessingMeta = (updater) => {
    setProcessingMeta(prev => (prev ? updater(prev) : prev));
  };

  const markStepStart = (step) => {
    updateProcessingMeta(prev => {
      const now = Date.now();
      const existing = prev.steps?.[step];
      return {
        ...prev,
        steps: {
          ...prev.steps,
          [step]: {
            status: 'active',
            startedAt: existing?.startedAt ?? now,
            endedAt: null,
            ms: null
          }
        }
      };
    });
  };

  const markStepComplete = (step, { status = 'done', ms } = {}) => {
    updateProcessingMeta(prev => {
      const now = Date.now();
      const existing = prev.steps?.[step] || {};
      const computedMs = ms ?? (existing.startedAt ? now - existing.startedAt : null);
      return {
        ...prev,
        steps: {
          ...prev.steps,
          [step]: {
            ...existing,
            status,
            endedAt: now,
            ms: computedMs
          }
        }
      };
    });
  };

  const formatDuration = (ms) => {
    if (ms == null) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const withTimeout = (promise, ms) => {
    if (!ms) return promise;
    return Promise.race([
      promise,
      new Promise(resolve => setTimeout(resolve, ms))
    ]);
  };

  const parseSummary = (summaryText = '') => {
    if (!summaryText) return { thesis: '', outline: [] };
    const lines = summaryText.split(/\r?\n/);
    let thesis = '';
    const outline = [];
    let inOutline = false;

    for (const line of lines) {
      const thesisMatch = line.match(/^THESIS:\s*(.+)$/i);
      if (thesisMatch) {
        thesis = thesisMatch[1].trim();
        continue;
      }

      if (/^OUTLINE:\s*$/i.test(line.trim())) {
        inOutline = true;
        continue;
      }

      if (inOutline) {
        const itemMatch = line.match(/^\s*\d+\.\s*(.+)$/);
        if (itemMatch) {
          outline.push(itemMatch[1].trim());
        }
      }
    }

    return { thesis, outline };
  };

  const extractThesisFromSummary = (summaryText = '') => {
    const { thesis } = parseSummary(summaryText);
    return thesis;
  };

  const validateSummary = (summaryText = '') => {
    const { thesis, outline } = parseSummary(summaryText);
    return { isValid: true, errors: [], thesis, outline };
  };

  const clearSummaryReview = () => {
    setSummaryDraft('');
    setSummaryNotice('');
    setSummaryError('');
    setPendingImport(null);
  };

  const handleImportClose = () => {
    setShowImport(false);
    clearSummaryReview();
    setProcessingMeta(null);
  };

  // Check debt and restore session on mount
  useEffect(() => {
    const init = async () => {
      const count = await checkDebt();
      if (count > 0) {
        const words = await getPendingWords();
        setPendingWords(words.map(w => ({
          id: w.id,
          text: w.text,
          phonetic: w.phonetic,
          pos: w.pos,
          definition: w.definition,
          definition_zh: w.definition_zh,
          originalContext: w.originalContext,
          newContext: w.newContext,
          slices: w.slices || []
        })));
        setCurrentView(VIEW.INTERCEPTION);
        return;
      }

      const session = await restoreSession();
      if (session) {
        await loadDocument(session.docId);

        // Restore view mode from session, defaulting to LAYER0
        const savedView = session.viewMode || VIEW.LAYER0;
        setCurrentView(savedView);

        // If restoring to Layer 1, ensure store is synced
        if (savedView === VIEW.LAYER1) {
          setCurrentChunk(session.currentChunkIndex);
          setCurrentStep(session.currentStep || 1);
        }
      } else {
        setCurrentView(VIEW.EMPTY);
      }
    };
    init();
    // Note: setCurrentChunk and setCurrentStep are stable Zustand setters
  }, [checkDebt, restoreSession, setCurrentChunk, setCurrentStep]);

  // Prefetch keywords while on Layer 0 to speed up Step 2
  useEffect(() => {
    if (currentView !== VIEW.LAYER0 || !chunks || chunks.length === 0) return;

    const targets = [];
    const current = chunks[currentChunkIndex];
    if (current?.id && current?.originalText) {
      targets.push(current);
    }

    const next = chunks[currentChunkIndex + 1];
    if (next?.id && next?.originalText) {
      targets.push(next);
    }

    targets.forEach(chunk => {
      prefetchService.prefetchKeywords(chunk.id, chunk.originalText)
        .catch(() => {});
    });
  }, [currentView, chunks, currentChunkIndex]);

  // Load document with chunks
  const loadDocument = async (docId) => {
    const doc = await getDocumentWithChunks(docId);
    if (doc) {
      setDocument(doc);
      setChunks(doc.chunks || []);
    }
  };

  const persistImportResult = async ({ title, content, coreThesis, semanticChunks, contentHash, model, cacheHit, operationId, summary = '' }) => {
    if (operationId !== asyncOperationIdRef.current) return;

    addLog(`Thesis: "${coreThesis.substring(0, 30)}..."`, 'done');
    addLog(`Created ${semanticChunks.length} semantic chunks`, 'done');
    updateProcessingMeta(prev => ({
      ...prev,
      actualChunks: semanticChunks.length
    }));

    if (!cacheHit && contentHash) {
      setAnalysisCache(contentHash, coreThesis, semanticChunks, model, summary)
        .catch((error) => console.warn('[Cache] Failed to store analysis:', error));
    }

    // Create document
    setProcessingStep('PERSISTENCE');
    markStepStart('PERSISTENCE');
    const persistenceStart = Date.now();
    addLog('Creating document structure...');
    const docId = await createDocument(title, content, coreThesis);
    const persistenceMs = Date.now() - persistenceStart;
    updateProcessingMeta(prev => ({
      ...prev,
      timings: {
        ...prev.timings,
        persistenceMs
      }
    }));
    markStepComplete('PERSISTENCE', { ms: persistenceMs });

    if (operationId !== asyncOperationIdRef.current) return;

    // Save chunks (batched bulk insert for performance + progress)
    setProcessingStep('SAVING');
    markStepStart('SAVING');
    const saveStart = Date.now();
    addLog(`Anchoring ${semanticChunks.length} knowledge points to local database...`);
    const chunkIds = await createChunksBulk(docId, semanticChunks, {
      batchSize: 50,
      onBatch: ({ inserted, total, batchIndex, batchCount }) => {
        if (batchCount > 1) {
          addLog(`Saved ${inserted}/${total} chunks (${batchIndex + 1}/${batchCount})...`);
        }
        updateProcessingMeta(prev => ({
          ...prev,
          saveProgress: { inserted, total }
        }));
      }
    });
    const saveMs = Date.now() - saveStart;
    updateProcessingMeta(prev => ({
      ...prev,
      timings: {
        ...prev.timings,
        saveMs
      },
      saveProgress: { inserted: semanticChunks.length, total: semanticChunks.length }
    }));
    markStepComplete('SAVING', { ms: saveMs });

    if (operationId !== asyncOperationIdRef.current) return;

    // Prefetch keywords for the first chunk (best-effort, time-boxed)
    const firstChunkId = chunkIds?.[0];
    const firstChunkText = semanticChunks?.[0]?.originalText;
    if (firstChunkId && firstChunkText) {
      setProcessingStep('PREFETCH_KEYWORDS');
      markStepStart('PREFETCH_KEYWORDS');
      const keywordStart = Date.now();
      updateProcessingMeta(prev => ({
        ...prev,
        keywordProgress: { done: 0, total: 1 }
      }));
      addLog('Preloading keywords for the first chunk...', 'active');
      try {
        await withTimeout(
          prefetchService.prefetchKeywords(firstChunkId, firstChunkText),
          1500
        );
      } catch (error) {
        console.warn('[Prefetch] First chunk keywords failed:', error);
      }
      const keywordMs = Date.now() - keywordStart;
      updateProcessingMeta(prev => ({
        ...prev,
        timings: {
          ...prev.timings,
          keywordMs
        },
        keywordProgress: { done: 1, total: 1 }
      }));
      markStepComplete('PREFETCH_KEYWORDS', { ms: keywordMs });
    } else {
      markStepComplete('PREFETCH_KEYWORDS', { status: 'skipped', ms: 0 });
    }

    addLog('All chunks anchored successfully', 'done');
    setProcessingStep('COMPLETE');
    markStepComplete('COMPLETE');

    // Load the new document
    await loadDocument(docId);
    setCurrentDocument(docId);
    setShowImport(false);
    clearSummaryReview();
    setCurrentView(VIEW.LAYER0);
  };

  const handleSummaryCancel = () => {
    clearSummaryReview();
    setProcessingLogs([]);
    setProcessingStep('');
    setProcessingMeta(null);
  };

  const handleSummaryConfirm = async (editedSummary) => {
    if (!pendingImport) return;

    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    const operationId = ++asyncOperationIdRef.current;
    const { title, content, contentHash, model } = pendingImport;

    setLoading(true);
    setProcessingStep('CHUNKING');
    markStepStart('CHUNKING');
    addLog('Using edited summary to guide chunking...');

    try {
      const validation = validateSummary(editedSummary);
      let coreThesis = validation.thesis || extractThesisFromSummary(editedSummary);
      let semanticChunks = [];
      const chunkingStart = Date.now();

      if (coreThesis) {
        addLog('Thesis extracted from edited summary', 'done');
        semanticChunks = await chunkDocument(content, undefined, signal, editedSummary);
      } else {
        [coreThesis, semanticChunks] = await Promise.all([
          generateCoreThesis(content, undefined, signal),
          chunkDocument(content, undefined, signal, editedSummary)
        ]);
      }

      if (operationId !== asyncOperationIdRef.current) return;
      const chunkingMs = Date.now() - chunkingStart;
      updateProcessingMeta(prev => ({
        ...prev,
        timings: {
          ...prev.timings,
          chunkingMs
        }
      }));
      markStepComplete('CHUNKING', { ms: chunkingMs });

      await persistImportResult({
        title,
        content,
        coreThesis,
        semanticChunks,
        contentHash,
        model,
        summary: editedSummary,
        cacheHit: false,
        operationId
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[AbortController] Import cancelled');
        return;
      }
      if (operationId === asyncOperationIdRef.current) {
        console.error('Import failed:', error);
        alert(`Import failed: ${error.message}. Make sure LLM service is running.`);
      }
    } finally {
      if (operationId === asyncOperationIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleSummaryRegenerate = async () => {
    if (!pendingImport) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    const operationId = ++asyncOperationIdRef.current;
    const { content } = pendingImport;

    setLoading(true);
    setProcessingLogs([]);
    setProcessingStep('SUMMARIZING');
    markStepStart('SUMMARIZING');
    addLog('Regenerating summary...', 'active');

    try {
      const summaryStart = Date.now();
      const newSummary = await generateDocumentSummary(content, undefined, signal);
      if (operationId !== asyncOperationIdRef.current) return;
      const summaryMs = Date.now() - summaryStart;
      updateProcessingMeta(prev => ({
        ...prev,
        timings: {
          ...prev.timings,
          summaryMs
        }
      }));
      markStepComplete('SUMMARIZING', { ms: summaryMs });
      setSummaryDraft(newSummary);
      setSummaryNotice('Summary regenerated. You can edit before chunking.');
      setSummaryError('');
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[AbortController] Summary regeneration cancelled');
        return;
      }
      if (operationId === asyncOperationIdRef.current) {
        console.error('Summary regeneration failed:', error);
        setSummaryError('Failed to regenerate summary. Please try again.');
      }
    } finally {
      if (operationId === asyncOperationIdRef.current) {
        setLoading(false);
      }
    }
  };

  // Handle document import
  const handleImport = async ({ title, content, parseMetrics }) => {
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    const operationId = ++asyncOperationIdRef.current;

    setLoading(true);
    setProcessingLogs([]);
    setProcessingStep('INITIALIZING');
    clearSummaryReview();
    const { provider, model } = getLLMConfig();
    initProcessingMeta(content, provider, model, parseMetrics);
    markStepStart('INITIALIZING');
    addLog('Initializing import sequence...', 'active');
    if (parseMetrics && (parseMetrics.parseMs || parseMetrics.cleanMs)) {
      const parseTime = formatDuration(parseMetrics.parseMs ?? 0);
      const cleanTime = formatDuration(parseMetrics.cleanMs ?? 0);
      const cleanNote = parseMetrics.cleanMs ? ` (auto-clean ${cleanTime})` : '';
      addLog(`File parsed in ${parseTime}${cleanNote}`, 'done');
    }

    try {
      let coreThesis = '';
      let semanticChunks = [];
      let documentSummary = '';

      const contentHash = await hashText(`${provider}|${model}|${content}`);
      if (operationId !== asyncOperationIdRef.current) return;

      const cached = await getAnalysisCache(contentHash);
      if (operationId !== asyncOperationIdRef.current) return;

      const cacheHit = Boolean(cached?.coreThesis && Array.isArray(cached.chunks) && cached.chunks.length > 0);
      markStepComplete('INITIALIZING');

      if (cacheHit) {
        updateProcessingMeta(prev => ({
          ...prev,
          cacheStatus: 'hit',
          actualChunks: cached.chunks.length
        }));
        markStepComplete('SUMMARIZING', { status: 'skipped', ms: 0 });
        markStepComplete('CHUNKING', { status: 'skipped', ms: 0 });
        coreThesis = cached.coreThesis;
        semanticChunks = cached.chunks;
        addLog('Cache hit: reusing previous analysis', 'done');
      } else {
        updateProcessingMeta(prev => ({
          ...prev,
          cacheStatus: 'miss'
        }));
        setProcessingStep('SUMMARIZING');
        markStepStart('SUMMARIZING');
        addLog('Summarizing document to guide chunking...');
        const summaryStart = Date.now();
        documentSummary = await generateDocumentSummary(content, undefined, signal);
        if (operationId !== asyncOperationIdRef.current) return;
        const summaryMs = Date.now() - summaryStart;
        updateProcessingMeta(prev => ({
          ...prev,
          timings: {
            ...prev.timings,
            summaryMs
          }
        }));
        markStepComplete('SUMMARIZING', { ms: summaryMs });
        addLog('Summary ready', 'done');

        coreThesis = extractThesisFromSummary(documentSummary);
        setSummaryDraft(documentSummary);
        setSummaryNotice('You can review and edit the summary before chunking.');
        setSummaryError('');
        setPendingImport({ title, content, parseMetrics, contentHash, provider, model });
        setShowImport(true);
        setLoading(false);
        return;
      }

      if (operationId !== asyncOperationIdRef.current) return;
      await persistImportResult({
        title,
        content,
        coreThesis,
        semanticChunks,
        contentHash,
        model,
        summary: documentSummary,
        cacheHit,
        operationId
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[AbortController] Import cancelled');
        return;
      }
      if (operationId === asyncOperationIdRef.current) {
        console.error('Import failed:', error);
        alert(`Import failed: ${error.message}. Make sure LLM service is running.`);
      }
    } finally {
      if (operationId === asyncOperationIdRef.current) {
        setLoading(false);
      }
    }
  };

  // Handle clearing debt (vocabulary review)
  const handleClearDebt = async () => {
    cancelPendingOperations();

    // Refresh pending words before entering review
    const words = await getPendingWords();
    setPendingWords(words.map(w => ({
      id: w.id,
      text: w.text,
      phonetic: w.phonetic,
      pos: w.pos,
      definition: w.definition,
      definition_zh: w.definition_zh,
      originalContext: w.originalContext,
      newContext: w.newContext,
      slices: w.slices || []
    })));

    setCurrentView(VIEW.REVIEW);
  };

  // Handle emergency access
  const handleEmergencyAccess = () => {
    if (grantEmergencyAccess()) {
      setCurrentView(document ? VIEW.LAYER0 : VIEW.EMPTY);
    }
  };

  // Handle chunk selection - enter Layer 1 IMMEDIATELY
  const handleChunkSelect = async (index) => {
    const chunk = chunks[index];
    if (!chunk) return;

    // Cancel any in-flight requests from previous operations
    cancelPendingOperations();

    // Start keyword prefetch immediately to speed up Step 2
    if (chunk.id && chunk.originalText) {
      prefetchService.prefetchKeywords(chunk.id, chunk.originalText).catch(() => {});
    }

    // Enter Layer1 immediately (no blocking LLM call)
    setCurrentChunk(index);
    setCurrentStep(1);
    setCurrentView(VIEW.LAYER1);
    setChunkWords([]); // Will be populated by SegmentLoop via prefetch

    // Save session
    await saveReadingSession({
      docId: currentDocId,
      currentChunkIndex: index,
      currentStep: 1,
      subStepProgress: 0,
      viewMode: VIEW.LAYER1 // Persist view mode
    });
  };

  // Handle going back to Layer 0
  const handleBackToMap = async () => {
    cancelPendingOperations();
    setCurrentView(VIEW.LAYER0);

    // Save session
    await saveReadingSession({
      docId: currentDocId,
      currentChunkIndex,
      currentStep,
      subStepProgress: 0,
      viewMode: VIEW.LAYER0 // Persist view mode
    });
  };

  // Handle step completion
  const handleStepComplete = async (stepNumber) => {
    const nextStep = stepNumber + 1;

    if (nextStep > 4) {
      // Chunk complete, update and go back to map
      const wasCompleted = Boolean(chunks[currentChunkIndex]?.completed);
      const updatedChunks = chunks.map((c, i) =>
        i === currentChunkIndex
          ? { ...c, completed: true, currentStep: 4 }
          : c
      );
      setChunks(updatedChunks);

      // Update in database
      await db.chunks.update(chunks[currentChunkIndex].id, {
        completed: true,
        currentStep: 4,
        completedAt: new Date().toISOString()
      });

      if (!wasCompleted) {
        await incrementUserStats({ segments: 1 });
      }

      setCurrentView(VIEW.LAYER0);

      // Save session as back to map
      await saveReadingSession({
        docId: currentDocId,
        currentChunkIndex,
        currentStep: 4,
        viewMode: VIEW.LAYER0
      });

    } else {
      setCurrentStep(nextStep);

      // Save session
      await saveReadingSession({
        docId: currentDocId,
        currentChunkIndex,
        currentStep: nextStep,
        subStepProgress: 0,
        viewMode: VIEW.LAYER1 // Persist view mode
      });
    }
  };

  // Handle word actions in vocabulary building
  const handleWordAction = async (action, word) => {
    if (action === 'add') {
      const chunk = chunks[currentChunkIndex];
      const result = await createWordIfMissing(
        chunk?.id,
        word?.word || word?.text,
        word?.phonetic,
        word?.definition,
        word?.sentence || word?.originalContext,
        word?.newContext,
        word?.slices,
        word?.pos,
        word?.definition_zh
      );

      if (result?.created) {
        await checkDebt();
      }

      return result;
    }

    return { created: false, reason: 'unsupported-action' };
  };

  // Handle vocabulary review actions
  const handleKeepWord = async (word) => {
    // Keep word in pending state, but track review record
    await addReviewRecord(word?.id, ReviewAction.KEEP);
  };

  const handleArchiveWord = async (word) => {
    // Archive word
    await db.words.update(word.id, {
      status: WordStatus.ARCHIVED,
      archivedAt: new Date().toISOString()
    });
    await addReviewRecord(word?.id, ReviewAction.ARCHIVE);
    await incrementUserStats({ words: 1 });
    await checkDebt();
  };

  const handleReviewComplete = async () => {
    await checkDebt();
    // After a review session, allow users to return to their previously active view
    // (either the Map or the Empty state)
    setCurrentView(document ? VIEW.LAYER0 : VIEW.EMPTY);
  };

  // Render based on current view
  switch (currentView) {
    case VIEW.INTERCEPTION:
      return (
        <LaunchInterception
          pendingCount={pendingWordCount}
          emergencyAccessLeft={emergencyAccessLeft}
          onClearDebt={handleClearDebt}
          onEmergencyAccess={handleEmergencyAccess}
        />
      );

    case VIEW.REVIEW:
      return (
        <VocabularyReview
          words={pendingWords}
          onKeep={handleKeepWord}
          onArchive={handleArchiveWord}
          onComplete={handleReviewComplete}
          onBack={() => {
            cancelPendingOperations();
            setCurrentView(VIEW.INTERCEPTION);
          }}
        />
      );

    case VIEW.EMPTY:
      return (
        <div className="empty-state">
          <div className="empty-content">
            <h1>Deep Internalizer</h1>
            <p>Transform reading into deep learning</p>

            <button
              className="btn btn-primary btn-large"
              onClick={() => setShowImport(true)}
            >
              Import New Document
            </button>
          </div>

          <ImportModal
            isOpen={showImport}
            onClose={handleImportClose}
            onImport={handleImport}
            isLoading={isLoading}
            processingLogs={processingLogs}
            processingStep={processingStep}
            processingMeta={processingMeta}
            processingSteps={IMPORT_STEPS}
            summaryDraft={summaryDraft}
            summaryNotice={summaryNotice}
            summaryError={summaryError}
            onSummaryChange={(value) => {
              setSummaryDraft(value);
              if (summaryError) setSummaryError('');
            }}
            onSummaryConfirm={handleSummaryConfirm}
            onSummaryCancel={handleSummaryCancel}
            onSummaryRegenerate={handleSummaryRegenerate}
          />
        </div>
      );

    case VIEW.LAYER1:
      return (
        <div className="app">
          <nav className="top-nav">
            <div className="breadcrumb">
              <span
                className="breadcrumb-item clickable"
                onClick={handleBackToMap}
              >
                Global Map
              </span>
              <span className="breadcrumb-sep">›</span>
              <span className="breadcrumb-item">
                Chunk #{currentChunkIndex + 1}
              </span>
              <span className="breadcrumb-sep">›</span>
              <span className="breadcrumb-item active">
                Step {currentStep}
              </span>
            </div>
          </nav>

          <main className="main-content">
            <SegmentLoop
              chunk={chunks[currentChunkIndex]}
              words={chunkWords}
              currentStep={currentStep}
              onStepComplete={handleStepComplete}
              onWordAction={handleWordAction}
              onBack={handleBackToMap}
            />
          </main>
        </div>
      );

    case VIEW.PROFILE:
      return (
        <UserProfile
          onBack={() => {
            cancelPendingOperations();
            setCurrentView(document ? VIEW.LAYER0 : VIEW.EMPTY);
          }}
        />
      );

    case VIEW.LAYER0:
    default:
      return (
        <div className="app">
          <nav className="top-nav">
            <div className="breadcrumb">
              <span className="breadcrumb-item active">Global Map</span>
            </div>

            <div className="nav-actions">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  cancelPendingOperations();
                  setCurrentView(VIEW.PROFILE);
                }}
                title="User Profile"
              >
                👤
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowImport(true)}
              >
                + New
              </button>
            </div>
          </nav>

          <main className="main-content">
            {isLoading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading...</p>
              </div>
            ) : (
              <GlobalBlueprint
                document={document}
                chunks={chunks}
                currentChunkIndex={currentChunkIndex}
                onChunkSelect={handleChunkSelect}
              />
            )}
          </main>

          <ImportModal
            isOpen={showImport}
            onClose={handleImportClose}
            onImport={handleImport}
            isLoading={isLoading}
            processingLogs={processingLogs}
            processingStep={processingStep}
            processingMeta={processingMeta}
            processingSteps={IMPORT_STEPS}
            summaryDraft={summaryDraft}
            summaryNotice={summaryNotice}
            summaryError={summaryError}
            onSummaryChange={(value) => {
              setSummaryDraft(value);
              if (summaryError) setSummaryError('');
            }}
            onSummaryConfirm={handleSummaryConfirm}
            onSummaryCancel={handleSummaryCancel}
            onSummaryRegenerate={handleSummaryRegenerate}
          />
          <PWAPrompt />
          <OfflineIndicator />
        </div>
      );
  }
}

export default App;
