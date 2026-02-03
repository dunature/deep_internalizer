# Deep Internalizer (深度内化阅读器)

[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://react.dev/)
[![Performance](https://img.shields.io/badge/Performance-Optimized-brightgreen)]()
[![Dexie](https://img.shields.io/badge/IndexedDB-Local_First-blue)](https://dexie.org/)
[![PWA](https://img.shields.io/badge/PWA-Supported-orange)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

> **"The goal of reading is not to get through more books, but to let fewer things pass through your soul without leaving a trace."**
>
> **"阅读的目的不是为了读完更多的书，而是为了让更少的内容在穿过你的灵魂时不留痕迹。"**

**Deep Internalizer** is a specialized cognitive reading platform. It transforms passive reading into a structured, multi-layered "internalization" process, ensuring every word and concept is anchored in its original context.

**Deep Internalizer** 是一个基于认知心理学的深度阅读平台。它将被动阅读转化为结构化的多层“内化”过程，确保每个单词和概念都牢固地锚定在其原始语境中。

---

## 🚀 Performance Optimizations (2026 Update)
**最新性能优化**

We have re-engineered the core data flow to achieve a **"Zero-Wait"** user experience.
我们重构了核心数据流，实现了**“零等待”**的用户体验。

### 1. Parallel Intelligence (并行智能)
- **Problem**: Sequential execution of "Thesis Synthesis" and "Document Chunking" caused long wait times during import.
- **Solution**: Implemented `Promise.all` parallelism to run both LLM tasks concurrently, reducing import time by **~50%**.
- **问题**：“核心论点合成”与“文档切片”的串行执行导致导入时间过长。
- **方案**：采用 `Promise.all` 并行执行两个 LLM 任务，导入速度提升 **~50%**。

### 2. Zero-Wait Interaction (零等待交互)
- **Problem**: Transitioning to Layer 1 required waiting for keyword extraction (LLM), blocking the UI.
- **Solution**: **Immediate Transition + Background Prefetch**. The UI enters the reading mode instantly while the `PrefetchService` loads keywords and TTS audio in the background.
- **问题**：进入 Layer 1 阅读模式需要等待关键词提取，阻塞了界面。
- **方案**：**立即跳转 + 后台预加载**。界面瞬间切换，`PrefetchService` 在后台静默加载关键词和 TTS 音频。

### 3. Smart Audio Caching (智能音频缓存)
- **Strategy**:
  - **Words**: Cached permanently in IndexedDB (`wordAudio`). Reused across all documents.
  - **Syllables**: Common suffixes/prefixes (e.g., `-tion`, `pre-`) are cached globally.
  - **Sentences**: Generated on-demand (no cache).
- **Result**: Drastically reduced TTS API calls and network latency.
- **策略**：
  - **单词**：永久缓存于 IndexedDB (`wordAudio`)，跨文章复用。
  - **音节**：全局缓存常用词缀（如 `-tion`, `pre-`）。
  - **句子**：即时生成，不占用缓存。
- **结果**：大幅减少 TTS API 调用和网络延迟。

---

## 🏗️ Architecture: The Dual-Layer Funnel
**双层漏斗架构**

### Layer 0: Global Strategic Map (全局战略地图)
- **Core Thesis**: Synthesizes the entire document into a single, high-impact thesis statement using Local LLM.
- **Semantic Segmentation**: Breaks documents into thematic chunks (3-8 sentences) based on meaning, not length.
- **核心论点**：利用本地 LLM 将全文浓缩为唯一的强力论点。
- **语义切片**：基于语义而非长度，将文档拆分为主题切片（每片 3-8 句）。

### Layer 1: Tactical Immersion Cycle (战术沉浸循环)
A 4-step loop for every semantic chunk:
每个语义切片的 4 步循环：

1.  **Macro Context (宏观语境)**: Review the chunk's summary within the global framework.
2.  **Vocabulary Build (词汇构建)**: Extract 5-8 key terms with **X-Ray Context** (Long-press to see origin).
3.  **Articulation (发音训练)**: Train the "inner ear" with IPA transcriptions and high-fidelity TTS.
4.  **Flow Practice (心流练习)**: Continuous reading with real-time WPM tracking.

1.  **宏观语境**：在全局框架下审视切片摘要。
2.  **词汇构建**：提取 5-8 个核心词，支持**X光语境**（长按查看原文出处）。
3.  **发音训练**：通过 IPA 音标和高保真 TTS 训练“内耳”。
4.  **心流练习**：实时 WPM 追踪的连续阅读训练。

---

## 🛠️ Technology Stack (技术栈)

### Frontend (User Interface)
- **Framework**: React 19 + Vite 7
- **State Management**: Zustand (UI State) + Context API
- **Persistence**: Dexie.js (IndexedDB Wrapper) - **Local-First & Offline-Ready**
- **Styling**: Vanilla CSS Variables (Magazine Aesthetic)

### Backend Services (Local AI)
- **Cognitive Model**: Ollama (Llama 3.1) - for logical analysis & extraction.
- **Voice Engine**: Kokoro-TTS (Python/ONNX) - 82M parameter model for natural speech.
  - *New*: **Request Deduplication** & **LRU Cache** implemented in `ttsService.js`.

---

## 📂 Project Structure (项目结构)

```text
src/
├── components/
│   ├── Layer0/          # Global Map (全局地图)
│   ├── Layer1/          # Immersion Loop (沉浸循环)
│   └── common/          # Shared Generators (Thinking UI, etc.)
├── services/
│   ├── chunkingService.js  # LLM Bridge (Ollama)
│   ├── ttsService.js       # Audio Engine (Caching enabled)
│   └── prefetchService.js  # Background Loading Manager
├── db/
│   └── schema.js        # IndexedDB Schema (v3)
└── hooks/
    └── useTTS.js        # React Adapter for Speech
```

## � Quick Start (快速开始)

### Prerequisites (前置要求)
- Node.js 18+
- Python 3.11+ (for TTS)
- Ollama (running locally)

### 1. Start Frontend (启动前端)
```bash
npm install
npm run dev
# App runs on http://localhost:5173
```

### 2. Start TTS Server (启动语音服务)
```bash
./scripts/start_tts.sh
# API runs on http://localhost:8000
```

---

## 📜 License
MIT - Designed for personal growth and deep literacy.
MIT - 为个人成长与深度阅读而设计。
