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
  createChunk,
  createWord,
  getDocumentWithChunks,
  getPendingWords,
  WordStatus,
  saveReadingSession
} from './db/schema';
import {
  chunkDocument,
  generateCoreThesis
} from './services/chunkingService';
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
  const [currentView, setCurrentView] = useState(VIEW.EMPTY);

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

  // Load document with chunks
  const loadDocument = async (docId) => {
    const doc = await getDocumentWithChunks(docId);
    if (doc) {
      setDocument(doc);
      setChunks(doc.chunks || []);
    }
  };

  // Handle document import
  const handleImport = async ({ title, content }) => {
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
    addLog('Initializing import sequence...', 'active');

    try {
      // Parallel LLM processing: thesis + chunking run simultaneously
      setProcessingStep('PARALLEL_PROCESSING');
      addLog('Running parallel AI analysis (thesis + chunking)...');

      const [coreThesis, semanticChunks] = await Promise.all([
        generateCoreThesis(content, undefined, signal),
        chunkDocument(content, undefined, signal)
      ]);

      if (operationId !== asyncOperationIdRef.current) return;

      addLog(`Thesis: "${coreThesis.substring(0, 30)}..."`, 'done');
      addLog(`Created ${semanticChunks.length} semantic chunks`, 'done');

      // Create document
      setProcessingStep('PERSISTENCE');
      addLog('Creating document structure...');
      const docId = await createDocument(title, content, coreThesis);

      if (operationId !== asyncOperationIdRef.current) return;

      // Save chunks
      setProcessingStep('SAVING');
      addLog('Anchoring knowledge points to local database...');
      for (let i = 0; i < semanticChunks.length; i++) {
        const chunk = semanticChunks[i];
        if (i % 2 === 0) addLog(`Processing chunk ${i + 1}/${semanticChunks.length}...`);

        await createChunk(
          docId,
          i,
          chunk.title,
          chunk.summary,
          chunk.originalText,
          chunk.summary_zh
        );
      }

      if (operationId !== asyncOperationIdRef.current) return;
      addLog('All chunks anchored successfully', 'done');
      setProcessingStep('COMPLETE');

      // Load the new document
      await loadDocument(docId);
      setCurrentDocument(docId);
      setShowImport(false);
      setCurrentView(VIEW.LAYER0);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[AbortController] Import cancelled');
        return;
      }
      if (operationId === asyncOperationIdRef.current) {
        console.error('Import failed:', error);
        alert(`Import failed: ${error.message}. Make sure Ollama is running.`);
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
      const updatedChunks = chunks.map((c, i) =>
        i === currentChunkIndex
          ? { ...c, completed: true, currentStep: 4 }
          : c
      );
      setChunks(updatedChunks);

      // Update in database
      await db.chunks.update(chunks[currentChunkIndex].id, {
        completed: true,
        currentStep: 4
      });

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
      await createWord(
        chunk.id,
        word.word,
        word.phonetic,
        word.definition,
        word.sentence,
        word.newContext,
        word.slices,
        word.pos,
        word.definition_zh
      );

      // Update debt count
      await checkDebt();
    }
  };

  // Handle vocabulary review actions
  const handleKeepWord = async (word) => {
    // Keep word in pending state
    console.log('Keep word:', word.text);
  };

  const handleArchiveWord = async (word) => {
    // Archive word
    await db.words.update(word.id, { status: WordStatus.ARCHIVED });
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
            onClose={() => setShowImport(false)}
            onImport={handleImport}
            isLoading={isLoading}
            processingLogs={processingLogs}
            processingStep={processingStep}
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
            onClose={() => setShowImport(false)}
            onImport={handleImport}
            isLoading={isLoading}
            processingLogs={processingLogs}
            processingStep={processingStep}
          />
          <PWAPrompt />
          <OfflineIndicator />
        </div>
      );
  }
}

export default App;
