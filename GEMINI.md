# Deep Internalizer - Project Overview & Guidelines

Deep Internalizer is a specialized reading application designed to transform passive reading into active knowledge internalization through AI-driven context anchoring, vocabulary extraction, and immersive learning cycles.

## 🏗️ Architecture & Core Components

The application follows a "Double-Layer Cognitive Funnel" architecture:

### 1. Strategic Map (Layer 0)
- **Component**: `src/components/Layer0/GlobalBlueprint.jsx`
- **Function**: Shows a high-level overview of the document, including AI-generated summaries and semantic "chunks" (segments of 3-8 sentences).
- **Design Basis**: Pencil board `6cjsL` / `lReeq`.

### 2. Immersion Loop (Layer 1)
- **Component**: `src/components/Layer1/SegmentLoop.jsx`
- **Function**: Manages the 4-step learning cycle for each chunk:
    1.  **Macro Context**: Framing the segment within the global context.
    2.  **Vocabulary Build**: Identifying and learning key terms with context anchoring.
    3.  **Articulation Practice**: IPA-supported pronunciation and TTS practice.
    4.  **Flow Practice**: Full-passage immersive reading with recall anchors.
- **Sub-components**: `SentenceCard.jsx`, `VocabularyCard.jsx`.

### 3. Backend & Bridge
- **Bridge Server**: Located in `/bridge`, an Express server that proxies LLM requests, handles file parsing, and provides analysis caching for Claude Code integration.
- **TTS Server**: Located in `/scripts/tts_server`, a Python-based Kokoro-TTS server for high-fidelity offline audio generation.

## 🛠️ Building and Running

### Development Environment
- **Frontend**: `npm run dev` (starts Vite dev server at http://localhost:5173).
- **Bridge Server**: `npm --prefix bridge start` (starts Express at http://localhost:3737).
- **TTS Server**: `./scripts/start_tts.sh` (starts Python server at http://localhost:8000).

### Key Commands
- **Linting**: `npm run lint` (uses ESLint 9+).
- **Building**: `npm run build` (produces PWA-ready build in `/dist`).
- **Clean Cache**: The Bridge server has an automated cleanup at 2 AM for caches older than 30 days.

## 🎨 Design System & Conventions

The project is undergoing a "1:1 Visual Refactor" based on **Pencil** design specifications.

### 1. Visual Standards
- **Baseline**: Step 2 Vocabulary Build (`sSPCS` Light / `vK0th` Dark) defines the core design language.
- **Typography**: Strictly uses **Inter** (Sans-serif) for all headers and body text. Headers should never use serif fonts.
- **Dark Mode**: Uses a signature linear gradient for primary cards: `linear-gradient(180deg, #182338 0%, #121B2B 100%)`.
- **Spacing**: Follows an 8pt grid system (8px, 16px, 24px, 32px).

### 2. Coding Conventions
- **State Management**: Uses **Zustand** (`src/stores/appStore.js`) for global UI and theme state.
- **Database**: Uses **Dexie.js** for client-side persistence in IndexedDB.
- **Theme Injection**: Themes are applied via a global `:global(.darkTheme)` class injected at the `document.body` level in `App.jsx`.
- **CSS Modules**: Uses CSS Modules for component-specific styling. To target global theme classes, use the `:global(.darkTheme)` prefix.

### 3. Critical Rules for AI Agents
- **Fidelity First**: Any UI refactor must align 1:1 with Pencil node IDs and property snapshots.
- **Defensive Hooks**: Always call hooks (like `useAppStore`) at the top level of components, before any conditional returns.
- **naming**: When renaming document-related variables, prefer `currentDocument` to avoid conflicts with the global `window.document` object.

## 📂 Key Files Reference
- `src/App.jsx`: Main view router and global theme synchronization.
- `src/components/Layer1/SegmentLoop.jsx`: Orchestrator for the 4-step immersion loop.
- `src/components/Layer1/VocabularyCard.jsx`: Baseline component for vocabulary learning.
- `bridge/server.js`: Core proxy and caching logic for AI services.
- `src/index.css`: Global design system variables and reset styles.
