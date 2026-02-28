# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 项目概述

**Deep Internalizer** - 基于 AI 语义分析的深度阅读 PWA 应用。将被动阅读转化为主动内化，通过 AI 生成核心论点、语义切片、词汇提取和句子分析。

### 核心架构

```
Claude Code Skill → Bridge Server → IndexedDB → Deep Internalizer
     ↓                    ↓              ↓           ↓
  JSON 导出          Express 服务     Dexie.js     React 前端
  (~/.claude/skills)  (端口 3737)    (本地存储)    (Vite 5173)
```

### 三层缓存策略

| 层级 | 位置 | 容量 | 过期策略 |
|------|------|------|----------|
| L1 | IndexedDB `analysisCache` | 20 条 | LRU |
| L2 | IndexedDB `claudeCodeCache` | 30 条 | LRU |
| L3 | Bridge Server (JSON 文件) | 无限制 | 可配置 |

---

## 开发命令

### 前端开发
```bash
cd /Users/a2030/02-Area/deep_internalizer
npm run dev          # Vite 开发服务器 (localhost:5173)
npm run build        # 生产构建
npm run lint         # ESLint 检查
```

### Bridge Server
```bash
cd /Users/a2030/02-Area/deep_internalizer/bridge
npm start            # 启动服务器 (localhost:3737)
npm run dev          # 监听模式开发
```

### 语法检查
```bash
node --check src/services/xxx.js
node --check bridge/server.js
bash -n ~/.claude/skills/deep-internalizer-analyzer/generate-json.sh
```

---

## 启动顺序

1. **启动 LLM 服务**（如使用本地 Ollama）:
   ```bash
   ollama serve
   ```

2. **启动 Bridge Server**:
   ```bash
   cd bridge && node server.js
   ```

3. **启动前端**:
   ```bash
   npm run dev
   ```

---

## 目录结构

```
src/
├── components/
│   ├── Layer0/           # 全局语义地图
│   ├── Layer1/           # 4 步沉浸循环
│   └── common/           # 共享组件 (ImportModal, UserProfile)
├── services/
│   ├── claudeCodeImporter.js  # Claude Code 导入服务
│   ├── cacheBridgeService.js  # Bridge 通信服务
│   ├── chunkingService.js     # AI 语义切片
│   ├── textCleaningService.js # 文本清洗
│   ├── ttsService.js          # TTS 音频
│   └── llmClient.js           # 多 LLM 客户端
├── db/
│   └── schema.js              # Dexie.js IndexedDB Schema
└── hooks/

bridge/
├── server.js                  # Express 主服务器
├── routes/
│   ├── content.js             # POST /api/content/analyze
│   ├── tasks.js               # GET /api/tasks/:taskId
│   └── cache.js               # GET/POST /api/cache/:hash
└── services/
    ├── aiProcessor.js         # LLM 调用 (Ollama/OpenAI)
    ├── taskQueue.js           # 异步任务队列
    ├── cacheManager.js        # 文件缓存管理
    └── hashService.js         # SHA-256 哈希计算
```

---

## 环境变量

### 前端 (.env.local)
```bash
VITE_LLM_PROVIDER=ollama|deepseek|glm
VITE_OLLAMA_BASE_URL=http://localhost:11434
VITE_BRIDGE_SERVER_URL=http://localhost:3737
VITE_TTS_API_URL=http://localhost:8000/v1/audio/speech
```

### Bridge Server (bridge/.env)
```bash
BRIDGE_PORT=3737
BRIDGE_FRONTEND_URL=http://localhost:5173
LLM_PROVIDER=ollama
LLM_MODEL=qwen2.5:7b
OLLAMA_BASE_URL=http://localhost:11434
```

---

## Claude Code Skill

**目录**: `~/.claude/skills/deep-internalizer-analyzer/`

### 主要脚本
- `analyzer.sh` - 主分析脚本
- `extract-content.sh` - 内容提取 (三级策略：web_fetch → Jina AI → Puppeteer)
- `generate-json.sh` - JSON 导出生成器 (需要 `jq`)
- `cache-manager.js` - 缓存管理 CLI

### 使用方式
```bash
# 在 Claude Code 中
/analyze-article https://example.com/article

# 导出 JSON
# 在 Deep Internalizer 中粘贴 JSON 或通过 Bridge Server API 提交
```

---

## API 端点 (Bridge Server)

| 端点 | 方法 | 说明 | 速率限制 |
|------|------|------|----------|
| `/api/health` | GET | 健康检查 | 100 req/15min |
| `/api/content/analyze` | POST | 提交内容分析 | 20 req/hour |
| `/api/tasks/:taskId` | GET | 查询任务状态 | 100 req/15min |
| `/api/cache/:hash` | GET/POST | 缓存查询/写入 | 100 req/15min |

---

## 数据库 Schema

**文件**: `src/db/schema.js`

```javascript
// Dexie.js IndexedDB
db.version(6).stores({
  // 内容导入
  contentImport: '++id, hash, title, createdAt',

  // AI 分析缓存
  analysisCache: 'hash, createdAt',
  claudeCodeCache: 'hash, taskId, source, createdAt',

  // 语义切片
  chunks: 'hash, chunkId, createdAt',

  // 词汇/句子
  vocabulary: 'hash, word, createdAt',
  sentences: 'hash, sentenceId, createdAt'
});
```

---

## 关键设计决策

### 1. 本地优先架构
- 所有数据存储在 IndexedDB（客户端）
- Bridge Server 作为可选的分析桥接
- 支持完全离线运行（本地 LLM + TTS）

### 2. 异步任务轮询
- Bridge Server 接收分析请求后立即返回 `taskId`
- 前端通过 `pollTaskStatus` 轮询（指数退避，上限 15 秒）
- 最大重试次数 = `timeoutMs / intervalMs`

### 3. 缓存查询优先级
```
1. IndexedDB analysisCache (L1, 最快)
2. IndexedDB claudeCodeCache (L2)
3. Bridge Server 文件缓存 (L3, 需网络请求)
```

---

## 测试方法

### 前端构建测试
```bash
npm run build
```

### Bridge Server 测试
```bash
# 启动服务器
cd bridge && npm start

# 健康检查
curl http://localhost:3737/api/health

# 内容分析 API
curl -X POST http://localhost:3737/api/content/analyze \
  -H "Content-Type: application/json" \
  -d '{"content": "test content", "cacheOnly": true}'

# 缓存查询
curl http://localhost:3737/api/cache/<sha256-hash>
```

### 代码语法检查
```bash
# 前端服务
node --check src/services/claudeCodeImporter.js
node --check src/services/cacheBridgeService.js

# Bridge Server
node --check bridge/server.js

# Claude Code Skill
bash -n ~/.claude/skills/deep-internalizer-analyzer/generate-json.sh
```

---

## 相关文件

- **README.md** - 完整用户文档、认知科学原理、安装指南
- **tasks/todo.md** - 任务清单和进度追踪
- **tasks/REPAIR_REPORT.md** - P0/P1 修复报告
- **docs/** - 技术文档和用户案例
