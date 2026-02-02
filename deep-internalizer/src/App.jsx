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
  generateCoreThesis,
  extractKeywords,
  generateNewContext
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
    isDebtCleared,
    pendingWordCount,
    emergencyAccessLeft,
    currentChunkIndex,
    currentStep,
    isLoading,
    showLayer0,
    setLoading,
    setCurrentDocument,
    setCurrentChunk,
    setCurrentStep,
    toggleLayer0,
    checkDebt,
    useEmergencyAccess,
    restoreSession
  } = useAppStore();

  const [document, setDocument] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [chunkWords, setChunkWords] = useState([]);
  const [pendingWords, setPendingWords] = useState([]);
  const [showImport, setShowImport] = useState(false);
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
          definition: w.definition,
          originalContext: w.originalContext,
          newContext: w.newContext
        })));
        setCurrentView(VIEW.INTERCEPTION);
        return;
      }

      const session = await restoreSession();
      if (session) {
        await loadDocument(session.docId);
        setCurrentView(VIEW.LAYER0);
      } else {
        setCurrentView(VIEW.EMPTY);
      }
    };
    init();
  }, []);

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
    try {
      // Generate core thesis
      const coreThesis = await generateCoreThesis(content, undefined, signal);

      if (operationId !== asyncOperationIdRef.current) return;

      // Create document
      const docId = await createDocument(title, content, coreThesis);

      if (operationId !== asyncOperationIdRef.current) return;

      // Chunk the document
      const semanticChunks = await chunkDocument(content, undefined, signal);

      if (operationId !== asyncOperationIdRef.current) return;

      // Save chunks
      for (let i = 0; i < semanticChunks.length; i++) {
        const chunk = semanticChunks[i];
        await createChunk(
          docId,
          i,
          chunk.title,
          chunk.summary,
          chunk.originalText
        );
      }

      if (operationId !== asyncOperationIdRef.current) return;

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
  const handleClearDebt = () => {
    cancelPendingOperations();
    setCurrentView(VIEW.REVIEW);
  };

  // Handle emergency access
  const handleEmergencyAccess = () => {
    if (useEmergencyAccess()) {
      setCurrentView(document ? VIEW.LAYER0 : VIEW.EMPTY);
    }
  };

  // Handle chunk selection - enter Layer 1
  const handleChunkSelect = async (index) => {
    const chunk = chunks[index];
    if (!chunk) return;

    // Cancel any in-flight requests from previous operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this operation
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    // Increment operation ID to invalidate any previous pending async calls
    const operationId = ++asyncOperationIdRef.current;

    setCurrentChunk(index);
    setLoading(true);

    try {
      // Extract keywords for this chunk (with cancellation support)
      const keywords = await extractKeywords(chunk.originalText, undefined, signal);

      // Check if this operation is still valid (user hasn't navigated away)
      if (operationId !== asyncOperationIdRef.current) {
        console.log('[AsyncGuard] Stale operation detected, aborting state update.');
        return;
      }

      // Generate new contexts for each word (with cancellation support)
      const wordsWithContext = await Promise.all(
        keywords.map(async (kw) => {
          const newContext = await generateNewContext(kw.word, kw.definition, undefined, signal);
          return { ...kw, newContext };
        })
      );

      // Final validity check before committing to view change
      if (operationId !== asyncOperationIdRef.current) {
        console.log('[AsyncGuard] Stale operation detected after context generation, aborting.');
        return;
      }

      setChunkWords(wordsWithContext);
      setCurrentStep(1);
      setCurrentView(VIEW.LAYER1);

      // Save session
      await saveReadingSession({
        docId: currentDocId,
        currentChunkIndex: index,
        currentStep: 1,
        subStepProgress: 0
      });
    } catch (error) {
      // Ignore AbortError - it's expected when user navigates away
      if (error.name === 'AbortError') {
        console.log('[AbortController] Request cancelled by user navigation');
        return;
      }
      // Only show error if this operation is still current
      if (operationId === asyncOperationIdRef.current) {
        console.error('Failed to load chunk:', error);
        alert(`Failed to extract keywords: ${error.message}`);
      }
    } finally {
      // Only reset loading if this is still the current operation
      if (operationId === asyncOperationIdRef.current) {
        setLoading(false);
      }
    }
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
      subStepProgress: 0
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
    } else {
      setCurrentStep(nextStep);

      // Save session
      await saveReadingSession({
        docId: currentDocId,
        currentChunkIndex,
        currentStep: nextStep,
        subStepProgress: 0
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
        word.sentence
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
    const count = await checkDebt();
    if (count === 0) {
      setCurrentView(document ? VIEW.LAYER0 : VIEW.EMPTY);
    }
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
          />
          <PWAPrompt />
          <OfflineIndicator />
        </div>
      );
  }
}

export default App;
