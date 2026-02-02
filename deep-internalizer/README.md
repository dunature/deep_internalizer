# Deep Internalizer: 智能深度阅读器 (v2.0)

[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://react.dev/)
[![Zustand](https://img.shields.io/badge/Zustand-State-orange)](https://github.com/pmndrs/zustand)
[![PWA](https://img.shields.io/badge/PWA-Supported-green)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

> “阅读的目标不是读完更多的书，而是让更少的东西在未留下痕迹的情况下穿过你的心灵。”

**Deep Internalizer** 是一款基于认知心理学开发的英语阅读应用，旨在对抗“浅层阅读”与“词汇囤积癖”。它利用独特的**双层漏斗 (Two-Layer Funnel)** 架构，将阅读过程转化为一场结构化的、自顶向下的内化之旅。

---

## 🧩 核心哲学：反囤积协议

Deep Internalizer 优先考虑**深度**而非**数量**。其设计的三个支柱是：

1.  **语境锚定学习 (Context-Anchored)**：每个单词都在其原始语义环境中学习和复习，以触发情节记忆。
2.  **词汇门禁系统 (Vocabulary Gatekeeper)**：一种强力拦截机制——如果你仍有“语义债”（待复习单词），系统将锁定新内容的进入权限。
3.  **自顶向下处理 (Top-Down Processing)**：宏观理解（核心主旨）永远优先于微观分析（词汇与音标）。

---

## 🚀 掌握漏斗：使用指南

### 1. 文档导入 (Document Import)
在控制面板点击 **"+ New"**。支持三种导入方式：
-   **文本粘贴**：直接将内容粘贴至编辑器。
-   **文件上传**：支持 **PDF, DOCX, 或 TXT** 拖拽上传。系统将自动提取文本。
-   **✨ 文本清洗 (Clean Text)**：内置魔法按钮，可修复错乱的换行符，同时保留原始段落结构。

> [!TIP]
> 针对 PDF 拷贝的文本，建议务必使用“文本清洗”功能，以确保后续的语义分析准确无误。

### 2. Layer 0: 全局蓝图 (Global Blueprint)
导入成功后，你将进入**全局地图**：
-   **核心主旨 (Core Thesis)**：预览 AI 生成的全篇逻辑架构。
-   **语义分块 (Semantic Chunks)**：文章被拆解为多个主题单元，每个单元配有标题与摘要。
-   **进入路径**：点击任意分块，开启**沉浸式内化训练**。

### 3. Layer 1: 4步沉浸式循环 (Immersion Loop)
每个分块都必须经过以下四个强制性步骤：

| 步骤 | 模式 | 目标 | 关键交互 |
| :--- | :--- | :--- | :--- |
| **1** | **宏观语境 (Macro)** | 建立认知逻辑 | 在接触正文前先阅读主题摘要。 |
| **2** | **词汇构建 (Vocab)** | 扫清语义障碍 | **窥视原句 (Peek Origin)**：长按 👁️ 图标，查看单词在文中的精确位置。 |
| **3** | **音标练习 (Articulation)** | 训练节奏与重音 | 大声朗读核心句子 3 遍，专注于意群衔接。 |
| **4** | **流态练习 (Flow)** | 平滑内化进程 | 完整朗读整个段落。系统实时显示 **WPM** (每分钟字数)。 |

### 4. 词汇门禁 (Vocabulary Gatekeeper)
当你再次启动应用时，可能会遇到 **Launch Interception** 拦截界面：
-   **债务清偿**：若存在待复习单词，进入新文章的“门票”将被锁定。
-   **A/B 语境验证**：
    -   **语境 A**：原始来源文本（唤醒记忆）。
    -   **语境 B**：AI 生成的新语境（验证迁移能力）。
-   **紧急访问**：针对极高债务情况，提供 3 次应急访问机会。

---

## 📱 PWA 支持与离线模式

Deep Internalizer 是一款**渐进式 Web 应用 (PWA)**，旨在提供移动优先的深读体验。

-   **安装方式**：
    -   **iOS**: 在 Safari 中打开 → 点击分享 → **添加到主屏幕**。
    -   **Android/Chrome**: 点击安装提示或从菜单选择**添加到主屏幕**。
-   **离线卓越性**：
    -   通过 **IndexedDB** 实现本地持久化。
    -   所有已导入文档与词汇状态均保存在本地。
    -   无网络环境下（如飞行模式或地铁）依然可以正常阅读与复习。

---

## 🛠 技术栈

-   **引擎**: Vite 7 + React 19
-   **状态**: Zustand + 持久化中间件
-   **底层**: Dexie.js (IndexedDB)
-   **智能**: 本地 LLM 驱动 (默认支持 Ollama)
-   **美学**: 极简玻璃拟态 (Glassmorphism) 与流体网格系统

---

## 📦 本地开发

1.  **克隆与安装**:
    ```bash
    git clone https://github.com/your-repo/deep-internalizer.git
    cd deep-internalizer
    npm install
    ```
2.  **运行环境**: 确保本地 **Ollama** 已启动，以驱动文本分块与语境生成功能。
3.  **启动**:
    ```bash
    npm run dev
    ```

---

## 📄 许可证
MIT License - 为个人成长与深度识读而生。

