# Deep Internalizer

[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://react.dev/)
[![Zustand](https://img.shields.io/badge/Zustand-State-orange)](https://github.com/pmndrs/zustand)
[![PWA](https://img.shields.io/badge/PWA-Supported-green)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

> "阅读的目标不是读完更多的书，而是让更少的东西在未留下痕迹的情况下穿过你的心灵。"

**Deep Internalizer** 是一款基于认知心理学原理设计的英语深度阅读应用。它专为解决现代学习者面临的两大困境而生：**浅层阅读综合征**（读完即忘）和**词汇囤积癖**（收藏了大量生词却从未真正掌握）。

通过独创的 **双层漏斗架构 (Two-Layer Funnel)**，Deep Internalizer 将每一篇阅读材料转化为一场结构化、可追踪、自顶向下的内化之旅——确保每个单词都在语境中生根，每个概念都与认知网络形成连接。

---

## 目录

- [核心设计理念](#核心设计理念)
- [功能特性](#功能特性)
- [使用指南](#使用指南)
- [技术架构](#技术架构)
- [本地开发](#本地开发)
- [TTS 语音服务](#tts-语音服务)
- [项目结构](#项目结构)
- [许可证](#许可证)

---

## 核心设计理念

Deep Internalizer 的设计围绕三个核心原则展开：

### 1. 语境锚定学习 (Context-Anchored Learning)

传统的单词卡片将词汇从语境中剥离，导致记忆脆弱且难以迁移。本应用坚持**每个单词都必须在其原始语义环境中学习**。当你复习一个单词时，系统会同时展示：

- **语境 A**：单词在原文中的精确位置（触发情节记忆）
- **语境 B**：AI 生成的全新例句（验证语义迁移能力）

### 2. 词汇门禁系统 (Vocabulary Gatekeeper)

这是一种**强制性的债务清偿机制**。如果你有未复习的"语义债务"，系统将锁定新内容的进入权限。这一设计基于间隔重复理论：

- 防止词汇无限堆积而从不巩固
- 确保学习深度优先于学习广度
- 提供"紧急访问"机制应对特殊情况（最多 3 次）

### 3. 自顶向下处理 (Top-Down Processing)

认知科学研究表明，先建立宏观框架再填充细节的学习方式更为高效。因此，Deep Internalizer 强制执行以下顺序：

1. **核心主旨** → 理解文章的整体逻辑脉络
2. **语义分块** → 将长文拆解为可消化的主题单元
3. **词汇构建** → 在已建立的语境中习得新词
4. **发音训练** → 将视觉输入转化为肌肉记忆

---

## 功能特性

### 📄 智能文档处理

| 功能 | 描述 |
|------|------|
| **多格式支持** | 直接导入 PDF、DOCX、TXT 文件，或粘贴纯文本 |
| **拖拽上传** | 将文件拖入导入窗口即可自动解析 |
| **智能文本清洗** | 一键修复 PDF 复制产生的错误换行，同时保留原始段落结构 |
| **AI 语义分块** | 基于主题边界自动将长文拆分为逻辑连贯的阅读单元 |

### 🗺️ Layer 0：全局蓝图

进入文档后，首先看到的是全局地图视图：

- **核心主旨卡片**：AI 生成的一句话概括，帮助你在阅读前建立心理预期
- **语义分块网格**：每个分块显示标题和内容摘要，点击进入深度学习模式
- **完成进度追踪**：已完成的分块会显示视觉标记

### 🔄 Layer 1：四步沉浸式循环

每个分块必须经过四个强制性步骤，这是应用的核心学习引擎：

| 步骤 | 名称 | 目标 | 交互方式 |
|:----:|:-----|:-----|:---------|
| 1 | **宏观语境** | 建立认知框架 | 阅读该分块的主题摘要，理解其在全文中的位置 |
| 2 | **词汇构建** | 扫清语义障碍 | 逐个学习核心词汇，长按 👁️ 可查看单词在原文中的精确位置 |
| 3 | **音标练习** | 训练发音节奏 | 大声朗读核心句子，关注意群划分和重音模式 |
| 4 | **流态练习** | 平滑阅读体验 | 完整朗读整个段落，系统实时显示 WPM（每分钟词数）|

### 🚧 Launch Interception（启动拦截）

当应用检测到未复习的词汇时，会在启动时显示拦截界面：

- **债务面板**：显示待复习单词总数及其来源文档
- **A/B 语境验证**：双语境复习机制确保真正掌握
- **紧急访问**：提供最多 3 次绕过机会，适用于紧急情况

### 📱 PWA 与离线支持

Deep Internalizer 是一款完整的渐进式 Web 应用：

- **一键安装**：
  - iOS：Safari → 分享 → 添加到主屏幕
  - Android/Desktop：点击地址栏的安装提示
- **完全离线**：所有数据存储在本地 IndexedDB，无网络也能正常学习
- **实时同步**：在线状态下自动与云端同步（如已配置）

### 🔊 TTS 语音合成

内置本地 TTS 服务，为发音练习步骤提供高质量语音示范：

- 基于 Kokoro TTS 模型的自然语音
- 本地部署，无需联网
- 可配置语速和音色

---

## 使用指南

### 快速开始

1. **导入文档**：点击控制面板的 **"+ New"** 按钮
   - 粘贴文本：直接将内容粘贴到编辑器
   - 上传文件：拖拽 PDF/DOCX/TXT 文件到导入区域
   - 建议：对 PDF 复制的文本使用"清洗文本"功能

2. **浏览全局地图**：查看 AI 生成的核心主旨和语义分块

3. **进入沉浸式学习**：点击任意分块，开始四步循环

4. **完成债务清偿**：下次启动时，先复习待处理的词汇

### 词汇管理策略

在词汇构建步骤中，你可以对每个单词执行以下操作：

| 操作 | 效果 |
|------|------|
| **Keep** | 保留在复习队列，下次启动时需要复习 |
| **Skip** | 暂时跳过，不计入债务 |
| **Archive** | 标记为已掌握，从队列中移除 |

---

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                  │
├─────────────────────────────────────────────────────────┤
│  App.jsx          │  全局状态协调器 & 视图路由          │
│  Layer0/          │  GlobalBlueprint - 全局地图视图    │
│  Layer1/          │  SegmentLoop - 四步沉浸式循环      │
│  Vocabulary/      │  词汇复习组件 & Launch Interception │
│  common/          │  通用组件库 (Modal, Indicators...)  │
├─────────────────────────────────────────────────────────┤
│                    State Management                     │
├─────────────────────────────────────────────────────────┤
│  Zustand Store    │  appStore.js - 全局状态容器        │
│  Dexie.js         │  IndexedDB 抽象层 - 本地持久化     │
├─────────────────────────────────────────────────────────┤
│                    Services Layer                       │
├─────────────────────────────────────────────────────────┤
│  chunkingService  │  文本分块 & AI 语境生成            │
│  ttsService       │  本地 TTS 语音合成接口             │
├─────────────────────────────────────────────────────────┤
│                    External Dependencies                │
├─────────────────────────────────────────────────────────┤
│  Ollama           │  本地 LLM 驱动语义分析             │
│  Kokoro TTS       │  本地语音合成引擎                  │
└─────────────────────────────────────────────────────────┘
```

### 核心技术栈

| 类别 | 技术选型 |
|------|----------|
| 构建工具 | Vite 7 |
| UI 框架 | React 19 |
| 状态管理 | Zustand + persist 中间件 |
| 本地存储 | Dexie.js (IndexedDB 封装) |
| 文档解析 | pdfjs-dist + mammoth |
| AI 后端 | Ollama (本地 LLM) |
| 语音合成 | Kokoro TTS (本地部署) |
| PWA 支持 | vite-plugin-pwa + Workbox |

---

## 本地开发

### 环境要求

- Node.js 18+
- npm 或 pnpm
- Ollama（用于 AI 功能）
- Python 3.11+（用于 TTS 服务，可选）

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/your-repo/deep-internalizer.git
cd deep-internalizer

# 2. 安装依赖
npm install

# 3. 配置环境变量（可选）
cp .env.example .env.local
# 编辑 .env.local 设置 Ollama API 地址等

# 4. 启动开发服务器
npm run dev
```

### 可用脚本

| 命令 | 描述 |
|------|------|
| `npm run dev` | 启动开发服务器 (默认端口 5173) |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | 运行 ESLint 代码检查 |

---

## TTS 语音服务

Deep Internalizer 集成了本地 TTS 服务，为发音练习提供语音示范。

### 启动 TTS 服务器

```bash
# 方式一：使用启动脚本
./scripts/start_tts.sh

# 方式二：手动启动
cd scripts/tts_server
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python server.py
```

TTS 服务默认运行在 `http://localhost:5001`。

### 首次运行

首次启动时，服务会自动下载 Kokoro TTS 模型（约 1GB），请确保网络畅通。模型下载完成后将缓存在本地，后续启动无需重复下载。

---

## 项目结构

```
deep-internalizer/
├── public/                 # 静态资源
│   └── icons/              # PWA 图标
├── scripts/
│   ├── start_tts.sh        # TTS 服务启动脚本
│   └── tts_server/         # Python TTS 服务
│       ├── server.py       # Flask 服务器
│       └── requirements.txt
├── src/
│   ├── components/
│   │   ├── Layer0/         # 全局蓝图组件
│   │   ├── Layer1/         # 沉浸式循环组件
│   │   ├── Vocabulary/     # 词汇复习组件
│   │   └── common/         # 通用组件
│   ├── db/                 # IndexedDB 数据库层
│   ├── hooks/              # 自定义 React Hooks
│   ├── services/           # 业务逻辑服务
│   ├── stores/             # Zustand 状态容器
│   ├── utils/              # 工具函数
│   ├── App.jsx             # 主应用组件
│   └── main.jsx            # 入口文件
├── index.html              # HTML 模板
├── vite.config.js          # Vite 配置
└── package.json
```

---

## 许可证

MIT License

为个人成长与深度识读而生。
