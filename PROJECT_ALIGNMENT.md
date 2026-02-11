# Deep Internalizer: Project Alignment & Architecture Standards

> **Status**: Living Document
> **Purpose**: Technical "Source of Truth" for developers to align with the project's cognitive and architectural goals.

## 1. Project Identity & Philosophy
**Deep Internalizer** is not a reading app; it is a **Cognitive Loading System**.
- **Core Principle**: "Debtless Learning". Users cannot proceed if they accumulate "Vocabulary Debt".
- **Interaction Model**: **Dual-Layer Funnel**.
    - **Layer 0 (Global)**: Strategic Map. Low cognitive load. Navigation.
    - **Layer 1 (Local)**: Tactical Loop. High cognitive load. 4-step intense processing.

---

## 2. Architecture & Tech Stack

### 2.1 Core Stack
| Component | Technology | Role |
|-----------|------------|------|
| **View** | React 19 + Vite | High-performance rendering. |
| **State** | Zustand | Transient UI state (views, loading, temp selections). |
| **Persistence** | Dexie.js (IndexedDB) | **Authoritative State**. User progress, Documents, Vocab. |
| **Intelligence** | Ollama (Local) | Semantic Splitting, Keyword Extraction, Context Generation. |
| **Voice** | Kokoro TTS (Python/ONNX) | Prosody-aware speech generation. |

### 2.2 Data Flow
`User Action` -> `Zustand Action` -> `Async Service (Abortable)` -> `Dexie DB (Persist)` -> `Zustand State Update` -> `UI Render`

> **Critical**: All heavy async operations (Import, Segment Processing) MUST be wrapped in `AbortController` logic (ref: `App.jsx`) to prevent race conditions during rapid navigation.

---

## 3. Data Schema (The "Truth")

The application state is grounded in `src/db/schema.js`.

### 3.1 Document (`documents`)
*   `id`: UUID
*   `title`: String
*   `rawContent`: Full text
*   `coreThesis`: One-sentence summary (AI generated)

### 3.2 Semantic Unit: Chunk (`chunks`)
*   `docId`: FK to Document
*   `index`: Ordering (0-based)
*   `originalText`: The raw text of this segment (3-8 sentences).
*   `summary`: AI-synthesized context for Step 1.
*   `currentStep`: 1-4 (Progress tracker).
*   `completed`: Boolean.

### 3.3 Atomic Unit: Word (`words`)
*   `chunkId`: FK to Chunk
*   `text`: The lemma/word.
*   `slices`: `[ { text: "syl", phonetic: "..." }, ... ]` (Key for pronunciation training).
*   `originalContext`: Sentence from the text.
*   `newContext`: AI-generated "Transfer Context" (Card B).
*   `status`: `PENDING` (Debt) | `ARCHIVED` (Learned).

---

## 4. The "Deep Loop" (Layer 1 State Machine)

The `SegmentLoop.jsx` component drives the pedagogical engine. It follows a strict linear sequence:

1.  **Macro Context (`Step1MacroContext`)**
    *   **Goal**: Prime the brain.
    *   **Action**: Read AI Summary vs Original Preview.
2.  **Vocabulary Build (`Step2VocabularyBuild`)**
    *   **Goal**: Isolate unknowns.
    *   **Interaction**: Cards with "Peek Origin" (Long press).
    *   **Debt Creation**: Adding a word here blocks the Global Map until reviewed.
3.  **Articulation (`Step3Articulation`)**
    *   **Goal**: Phonological loop training.
    *   **Data**: Uses `slices` from `words` or `splitSentenceIntoGroups` (Thought Groups).
4.  **Flow Practice (`Step4FlowPractice`)**
    *   **Goal**: Synthesize.
    *   **Metric**: WPM (Words Per Minute) tracker.

---

## 5. AI Integration & Prompt Engineering

Located in `src/services/chunkingService.js`.

| Task | Prompt Strategy | Key Output constraint |
|------|-----------------|-----------------------|
| **Chunking** | "Divide into logical thematic chunks... 3-5 sentences" | JSON Array `[{ startIndex, endIndex }]` |
| **Keywords** | "Extract 5-8 key vocabulary... split into slices" | JSON with `slices` array for phonetics. |
| **New Context** | "Generate ONE new example sentence... different from typical textbook" | Plain Text (High Entropy). |

---

## 6. Design System Guidelines

Based on `src/index.css` and "Magazine" aesthetic.

### 6.1 Tokens
-   **Backgrounds**: `#0a0a0f` (Primary), `#12121a` (Secondary/Cards).
-   **Accents**: Linear Gradient (`#818cf8` -> `#c084fc`). Used for Primary Actions/Progress.
-   **Typography**:
    -   Headings: `Playfair Display` (Serif, Premium feel).
    -   Body: `Inter` (Readability).
    -   Phonetics: `JetBrains Mono` (Alignment).

### 6.2 Visual Hierarchy rules
1.  **Glassmorphism**: Use subtle borders (`rgba(255, 255, 255, 0.08)`) over solid lines.
2.  **Elevation**: Active elements must lift (`translateY(-2px)`) and glow (`--shadow-glow`).
3.  **Whitespace**: Generous padding (`--space-6+`) to reduce cognitive noise.

---

## 7. Developer Alignment Checklist

Before committing changes, verify:
*   [ ] **Async Safety**: Did I use the `abortControllerRef` pattern if adding a new async flow?
*   [ ] **Debt Logic**: Does my change respect the "Debt" barrier? (User shouldn't bypass review).
*   [ ] **Persistence**: Is new state stored in Dexie, or just ephemeral Zustand? (Preference: Dexie for learning data, Zustand for UI).
*   [ ] **Aesthetic**: Did I use `var(--color-bg-secondary)` for cards and not hardcoded hex values?
