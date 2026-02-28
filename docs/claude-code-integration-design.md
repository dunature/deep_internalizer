# Deep Internalizer × Claude Code 集成功能设计文档

**版本**: v1.1
**日期**: 2026-02-23
**状态**: 设计稿

---

## 1. 功能概述

### 1.1 背景与目标

Deep Internalizer 是一款基于认知科学的深度阅读工具，通过 AI 驱动的语义切片、词汇提取和间隔重复系统，帮助用户实现深度阅读。Claude Code 作为 AI 编程助手，能够理解和处理各类文本内容。

**集成目标**：建立一个无缝的内容流转通道，让用户可以直接将 Claude Code 处理/生成的学习内容推送到 Deep Internalizer 进行深度学习，实现"AI 处理 → 深度内化"的闭环。

### 1.2 核心价值

| 价值维度 | 描述 |
|---------|------|
| **效率提升** | 消除手动复制粘贴步骤，一键将 Claude 分析的内容送入学习流程 |
| **知识沉淀** | 将一次性对话转化为可重复学习的结构化材料 |
| **智能预处理** | 利用 Claude 的 AI 能力进行内容清洗、结构化预处理 |
| **缓存复用** | 智能检测已处理内容，避免重复分析，节省 API 成本 |

---

## 2. 用户场景与用例

### 2.1 典型用户画像

**用户 A：学术研究者**
- 每天阅读大量论文和技术文档
- 使用 Claude 辅助理解和总结文献
- 需要将重要论文转化为长期记忆

**用户 B：语言学习者**
- 通过阅读外刊和文章学习英语
- 使用 Claude 解释难句和生词
- 希望建立个人词汇库进行复习

**用户 C：知识工作者**
- 阅读行业报告和专业文档
- 使用 Claude 提取核心观点
- 需要结构化学习材料用于会议准备

### 2.2 核心用例

#### 用例 1：从 Claude Code 发送内容到 Deep Internalizer

**前置条件**：
- 用户正在与 Claude Code 对话
- Deep Internalizer Bridge Server 正在运行
- 用户已安装 Deep Bridge CLI 工具

**主流程**：
1. 用户在 Claude Code 中处理完一段内容（如文章、论文、代码注释等）
2. 用户输入指令：`/learn` 或 `deep-bridge send`
3. Claude Code 将内容发送到 Bridge Server
4. Bridge Server 进行内容哈希计算，检查缓存
5. 如果缓存命中，返回缓存的任务 ID
6. 如果缓存未命中，创建新的分析任务，调用 AI 进行语义切片
7. Bridge Server 返回任务 ID 给 CLI
8. CLI 打开浏览器，Deep Internalizer 加载处理后的内容
9. 用户立即进入学习流程

**后置条件**：
- 内容已存入 Deep Internalizer 本地数据库
- 用户可以在 Global Blueprint 中看到语义切片
- 用户可以选择切片开始 4 步深度学习

#### 用例 2：缓存检测与自动加载

**前置条件**：
- 用户尝试导入一段内容到 Deep Internalizer
- Bridge Server 或本地存在该内容的缓存

**主流程**：
1. 用户在 Deep Internalizer 中点击 "Import New Document"
2. 用户粘贴或上传内容
3. Deep Internalizer 计算内容哈希（SHA-256）
4. 系统检查本地 `analysisCache` 表（IndexedDB）
5. 如果本地未找到，查询 Bridge Server 缓存
6. 如果任意位置找到缓存：
   - 显示缓存提示："此内容已分析过，是否直接加载？"
   - 用户点击"加载缓存"
   - 系统跳过 AI 分析步骤，直接加载缓存的语义切片
7. 如果未找到缓存：继续正常的 AI 分析流程

**后置条件**：
- 用户节省了 API 调用费用
- 用户快速进入学习状态，无需等待分析

#### 用例 3：批量预处理（准备模式）

**主流程**：
1. 用户使用 Claude Code 或脚本批量发送文档
2. 对每个文档调用 `POST /api/content/analyze`，指定 `cacheOnly: true`
3. Bridge Server 异步处理所有文档，仅缓存不打开浏览器
4. 用户稍后打开 Deep Internalizer，导入时自动命中缓存
5. 用户可立即开始学习，无需等待 AI 分析

---

## 3. 模块架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Deep Internalizer                         │
│                          (Frontend)                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  CacheBridge    │  │   ImportModal   │  │  Auto-Detect   │ │
│  │     Service     │  │   (Enhanced)    │  │    Service     │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
└───────────┼───────────────────┼───────────────────┼───────────┘
            │                   │                   │
            │   HTTP / WS       │                   │
            ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Bridge Server (Node.js/Express)             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Content    │  │   Task       │  │   Cache      │           │
│  │   Receiver   │  │   Queue      │  │   Manager    │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    AI Processor                          │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │  │
│  │  │   Text     │  │  Semantic  │  │  Keyword   │         │  │
│  │  │  Cleaner   │─▶│  Chunker   │─▶│  Extractor │         │  │
│  │  └────────────┘  └────────────┘  └────────────┘         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Storage Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────────────────┐  │
│  │   File System    │  │   Deep Internalizer IndexedDB        │  │
│  │   (JSON Cache)   │  │   (documents / chunks / words /      │  │
│  │   Bridge-local   │  │    analysisCache / thoughtGroups)    │  │
│  └──────────────────┘  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 Bridge Server 模块

**功能职责**：接收 CLI 推送、管理任务队列、调用 AI 处理、缓存结果、向前端暴露查询接口。

**REST API**：

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/content/analyze` | POST | 接收内容并开始分析 |
| `/api/tasks/:taskId` | GET | 查询任务状态和结果 |
| `/api/cache/:contentHash` | GET | 查询缓存内容 |
| `/api/cache` | POST | 手动写入缓存 |
| `/api/health` | GET | 健康检查 |

### 3.2 CLI 工具模块

**命令设计**：

| 命令 | 描述 | 示例 |
|------|------|------|
| `send <file>` | 发送文件到 Bridge | `deep-bridge send article.md` |
| `push` | 从 stdin 读取发送 | `cat article.md \| deep-bridge push` |
| `cache <file>` | 仅缓存不打开 | `deep-bridge cache report.pdf` |
| `status [id]` | 查询任务状态 | `deep-bridge status task_123` |
| `config` | 查看/设置配置 | `deep-bridge config url http://...` |

### 3.3 前端集成模块

增强现有 `ImportModal` 组件，新增缓存检测层：

```
ImportModal (增强版)
├── InputMethodTabs (输入方式切换)
├── CacheDetectionPanel (缓存检测结果)
│   ├── CacheFoundBanner (发现缓存提示)
│   ├── CacheSourceBadge (来源: Local / Bridge)
│   └── CacheActions (加载缓存 / 重新分析)
├── ContentInput (内容输入区)
└── ImportActions (导入操作按钮)
```

---

## 4. 数据流设计

### 4.1 首次导入流程

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  User   │────▶│  CLI Tool   │────▶│   Bridge    │────▶│ AI Processor │
│ (Input) │     │  (Hash)     │     │   (Queue)   │     │ (Analysis)   │
└─────────┘     └─────────────┘     └─────────────┘     └──────┬───────┘
                                                                │
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────▼───────┐
│  User   │◀────│   Browser   │◀────│   Bridge    │◀────│    Cache     │
│ (View)  │     │  (Frontend) │     │  (Notify)   │     │   (Store)    │
└─────────┘     └─────────────┘     └─────────────┘     └──────────────┘
```

### 4.2 缓存命中流程

```
User ──▶ ImportModal ──▶ hashText(content) [SHA-256]
                              │
                    ┌─────────▼──────────┐
                    │  Local IndexedDB   │  ◀── analysisCache table
                    │  (analysisCache)   │
                    └─────────┬──────────┘
                     miss     │ hit
                              │
                    ┌─────────▼──────────┐
                    │  Bridge Server     │  ◀── GET /api/cache/:hash
                    │  /api/cache/:hash  │
                    └─────────┬──────────┘
                     miss     │ hit
                              │
                    CacheFoundBanner ──▶ User chooses [Load] or [Re-analyze]
                              │
                    Load cached analysisCache entry ──▶ createDocument + createChunksBulk
```

---

## 5. 数据结构契约

> 本节基于现有 `src/db/schema.js` 和 `src/services/chunkingService.js` 定义，确保 Bridge 与前端的数据格式完全兼容。

### 5.1 API：POST `/api/content/analyze`

**Request Body**

```json
{
  "content": "string (raw text)",
  "title": "string (optional, inferred if absent)",
  "model": "string (e.g. 'qwen2.5:7b', optional)",
  "cacheOnly": false,
  "source": "cli | claude-code | script"
}
```

**Response**

```json
{
  "taskId": "uuid-v4",
  "contentHash": "sha256hex",
  "status": "queued | processing | done | cached",
  "cacheHit": false
}
```

### 5.2 API：GET `/api/tasks/:taskId`

**Response (done)**

```json
{
  "taskId": "uuid-v4",
  "status": "done",
  "result": {
    "hash": "sha256hex",
    "coreThesis": "string",
    "summary": "string",
    "model": "string",
    "chunks": [
      {
        "title": "string",
        "summary": "string",
        "summary_zh": "string",
        "originalText": "string"
      }
    ]
  }
}
```

### 5.3 Bridge 服务端缓存结构（JSON 文件）

```json
{
  "hash": "sha256hex",
  "coreThesis": "string",
  "summary": "string",
  "model": "string",
  "chunks": [ /* 同上 */ ],
  "createdAt": 1708600000000
}
```

> 与前端 `analysisCache` 表的 `setAnalysisCache(hash, coreThesis, chunks, model, summary)` 完全对应，可直接映射写入 IndexedDB。

### 5.4 IndexedDB 核心表（已有，供参考）

#### `documents`
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid | 主键 |
| `title` | string | 文档标题 |
| `rawContent` | string | 原始文本 |
| `coreThesis` | string | 核心论点 |
| `importedAt` | ISO string | 导入时间 |
| `lastAccessedAt` | ISO string | 最近访问 |

#### `chunks`
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid | 主键 |
| `docId` | uuid | 所属文档 |
| `index` | number | 顺序索引 |
| `title` | string | 切片标题 |
| `summary` | string | 英文摘要 |
| `summary_zh` | string | 中文摘要 |
| `originalText` | string | 原始文本 |
| `currentStep` | 1–4 | 当前学习步骤 |
| `completed` | boolean | 是否完成 |

#### `analysisCache`
| 字段 | 类型 | 说明 |
|------|------|------|
| `hash` | sha256hex | 主键（内容哈希） |
| `coreThesis` | string | 核心论点 |
| `chunks` | array | 语义切片列表 |
| `summary` | string | 文档摘要 |
| `model` | string | 使用的模型 |
| `createdAt` | timestamp | 写入时间（用于 LRU 清理，上限 20 条） |

---

## 6. 安全与隐私

| 考虑点 | 措施 |
|-------|------|
| **内容传输安全** | 使用 HTTPS/TLS 加密所有远程 API 通信 |
| **敏感内容处理** | 支持本地 Ollama 模式，敏感内容不离开本地网络 |
| **API 认证** | Bridge Server 支持 API Key 认证，防止未授权访问 |
| **内容隔离** | 多用户环境下，用户只能访问自己的缓存内容 |
| **缓存失效** | `analysisCache` 采用 LRU 策略（上限 20 条）；Bridge 服务端缓存支持 `maxAge` 配置 |

---

## 7. 性能指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 缓存检测延迟 | < 100ms | 本地 IndexedDB 查询 |
| 内容上传时间 | < 2s/MB | 正常网络环境 |
| AI 分析时间 | < 30s | 1000 词文本 |
| 缓存加载时间 | < 500ms | 从 IndexedDB 加载并渲染 |
| 并发处理能力 | 10 req/s | Bridge Server 吞吐目标 |

---

## 8. 实施路线图

### 第一阶段：核心桥接（2–3 周）
- [ ] 搭建 Bridge Server 基础框架（Express + JSON 文件缓存）
- [ ] 实现内容接收与 SHA-256 哈希计算
- [ ] 开发 CLI 工具的 `send` 和 `status` 命令

### 第二阶段：AI 处理集成（2–3 周）
- [ ] 复用 `chunkingService` 中的 `chunkDocument` / `generateCoreThesis`
- [ ] 实现任务队列和异步处理
- [ ] 实现 CLI 工具的 `cache` 命令（`cacheOnly: true` 模式）

### 第三阶段：前端集成（2 周）
- [ ] 在 `ImportModal` 中增加 `CacheDetectionPanel`
- [ ] 实现 `hashText` → 本地 `analysisCache` → Bridge 的双层检测逻辑
- [ ] 缓存命中时直接调用 `createDocument` + `createChunksBulk` 写入

### 第四阶段：优化与文档（1–2 周）
- [ ] 性能优化与压力测试
- [ ] 编写完整使用文档
- [ ] 开发 Claude Code `/learn` Skill 包装器
- [ ] 发布与部署

---

## 附录：术语表

| 术语 | 说明 |
|------|------|
| Bridge Server | 连接 Claude Code 和 Deep Internalizer 的本地中间服务 |
| CLI Tool | 命令行工具，供 Claude Code 和用户调用 |
| Content Hash | 内容的 SHA-256 哈希值，用于缓存键 |
| Semantic Chunk | 语义切片，按意义分割的段落单元（对应 `chunks` 表一行） |
| Task Queue | 分析任务的异步处理队列 |
| analysisCache | IndexedDB 中存储 AI 分析结果的缓存表（LRU，上限 20 条） |

---

**文档结束**
