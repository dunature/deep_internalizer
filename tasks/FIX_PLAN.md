# Deep Internalizer - Claude Code 集成修复计划

**制定日期**: 2026-02-28
**基于报告**: `CODE_REVIEW_REPORT.md`

---

## 修复策略总览

采用**分阶段、按优先级**的修复策略：

```
P0 (关键修复) → P1 (重要改进) → P2 (优化建议)
     ↓                ↓               ↓
  立即执行        本周执行        下周执行
```

---

## P0: 关键修复 (立即执行)

### P0-1: 修复轮询错误处理

**文件**: `src/services/claudeCodeImporter.js:178-184`

**问题**: 非 "failed"/"error" 错误被静默忽略，可能导致无限等待

**当前代码**:
```javascript
catch (error) {
    if (error.message.includes('failed') || error.message.includes('error')) {
        throw error;
    }
    console.warn('[ClaudeCodeImporter] Polling error:', error.message);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
}
```

**修复方案**:
1. 添加最大重试次数
2. 添加指数退避策略
3. 记录所有错误而非静默忽略

**修改后代码**:
```javascript
const MAX_RETRIES = 20;  // 60 秒超时 (20 * 3000ms)
let retryCount = 0;

catch (error) {
    retryCount++;

    // 记录所有错误
    console.warn(`[ClaudeCodeImporter] Polling error (${retryCount}/${MAX_RETRIES}):`, error.message);

    // 达到最大重试次数，抛出错误
    if (retryCount >= MAX_RETRIES) {
        throw new Error(`Task ${taskId} polling failed after ${MAX_RETRIES} attempts: ${error.message}`);
    }

    // 指数退避 (3s → 6s → 9s, max 15s)
    const backoffDelay = Math.min(intervalMs * retryCount, 15000);
    await new Promise(resolve => setTimeout(resolve, backoffDelay));
}
```

**预计工时**: 15 分钟
**测试要求**: 模拟网络错误场景测试

---

### P0-2: 修复 JSON 导出脚本

**文件**: `~/.claude/skills/deep-internalizer-analyzer/generate-json.sh`

**问题**: 未对字符串进行 JSON 转义，可能导致格式错误

**修复方案**: 使用 `jq` 工具确保 JSON 格式正确

**前提**: 检查系统是否安装 `jq`

**修改后脚本**:
```bash
#!/bin/bash
# Deep Internalizer - JSON Export Generator (Fixed)

set -e

# 检查 jq 是否安装
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed." >&2
    echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)" >&2
    exit 1
fi

# Input parameters
TASK_ID="${1:-$(uuidgen 2>/dev/null || echo "task-$(date +%s)"}"
TITLE="$2"
URL="$3"
CONTENT_HASH="${4:-hash-$(date +%s)}"
MODEL="${5:-glm-4.7}"
THESIS="$6"
OUTLINE="$7"
CHUNKS_JSON="${8:-[]}"
VOCAB_JSON="${9:-[]}"
SENTENCES_JSON="${10:-[]}"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Use jq for proper JSON escaping
jq -n \
  --arg taskId "$TASK_ID" \
  --arg source "claude-code-skill" \
  --arg title "$TITLE" \
  --arg url "$URL" \
  --arg contentHash "$CONTENT_HASH" \
  --arg status "done" \
  --arg createdAt "$TIMESTAMP" \
  --arg completedAt "$TIMESTAMP" \
  --arg model "$MODEL" \
  --argjson thesis "$THESIS" \
  --argjson chunks "$CHUNKS_JSON" \
  --argjson vocabulary "$VOCAB_JSON" \
  --argjson sentences "$SENTENCES_JSON" \
  '{
    taskId: $taskId,
    source: $source,
    title: $title,
    url: $url,
    contentHash: $contentHash,
    status: $status,
    createdAt: $createdAt,
    completedAt: $completedAt,
    model: $model,
    result: {
      coreThesis: $thesis,
      chunks: $chunks,
      vocabulary: $vocabulary,
      sentences: $sentences
    },
    schemaVersion: "1.0.0"
  }'
```

**预计工时**: 30 分钟
**测试要求**: 使用含特殊字符的标题测试

---

## P1: 重要改进 (本周执行)

### P1-1: 添加速率限制中间件

**文件**: `bridge/server.js`

**目的**: 防止 API 滥用和意外的大量请求

**步骤**:
1. 安装依赖：`cd bridge && npm install express-rate-limit`
2. 添加中间件配置

**代码**:
```javascript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';  // 新增
import contentRoutes from './routes/content.js';
import taskRoutes from './routes/tasks.js';
import cacheRoutes from './routes/cache.js';

const app = express();
const PORT = parseInt(process.env.BRIDGE_PORT || '3737', 10);
const FRONTEND_URL = process.env.BRIDGE_FRONTEND_URL || 'http://localhost:5173';

// 新增：速率限制配置
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 分钟窗口
    max: 100,  // 每个 IP 最多 100 个请求
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// 分析接口更严格的限制 (AI 处理开销大)
const analyzeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 小时窗口
    max: 20,  // 每小时最多 20 次分析
    message: { error: 'Analysis limit exceeded, please try again later.' },
});

app.use(cors({ origin: [FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '5mb' }));
app.use(limiter);  // 应用全局限制

// Routes
app.use('/api/content', analyzeLimiter, contentRoutes);  // 分析接口单独限制
app.use('/api/tasks', taskRoutes);
app.use('/api/cache', cacheRoutes);
```

**预计工时**: 20 分钟
**测试要求**: 测试超限流响应

---

### P1-2: 添加请求日志中间件

**文件**: `bridge/server.js`

**目的**: 便于调试和监控

**步骤**:
1. 安装依赖：`npm install morgan`
2. 添加中间件

**代码**:
```javascript
import morgan from 'morgan';  // 新增

// ... 在 CORS 之后添加
app.use(morgan('combined'));  // 标准 Apache 格式
```

**预计工时**: 10 分钟

---

### P1-3: 统一函数命名

**文件**: `src/services/cacheBridgeService.js:156`

**问题**: `syncTobridge` 应为 `syncToBridge`

**修复**:
```javascript
// 函数定义
export async function syncToBridge(content, analysisResult) {  // 修正拼写
    // ... 函数体不变
}

// 默认导出
export default {
    // ...
    syncToBridge,  // 修正
};
```

**影响范围检查**: 搜索所有引用点

**预计工时**: 10 分钟

---

### P1-4: 导出 getBridgeUrl 函数

**文件**: `src/services/cacheBridgeService.js:12-14`

**修复**:
```javascript
export function getBridgeUrl() {  // 添加 export
    return localStorage.getItem(BRIDGE_STORAGE_KEY) || DEFAULT_BRIDGE_URL;
}
```

**预计工时**: 5 分钟

---

## P2: 优化建议 (下周执行)

### P2-1: 简化 Dexie version 定义

**文件**: `src/db/schema.js`

**问题**: version 6 重复定义了之前版本的所有表

**当前代码**:
```javascript
db.version(6).stores({
  documents: 'id, title, importedAt, lastAccessedAt',
  // ... 重复所有表
});
```

**修复方案**:
```javascript
// Version 6 只定义新增的表
db.version(6).stores({
  thoughtGroups: 'hash, createdAt',
  claudeCodeCache: 'hash, taskId, source, createdAt'
});
```

**注意**: 需要验证 Dexie.js 是否支持增量定义

**预计工时**: 20 分钟
**测试要求**: 测试数据库升级流程

---

### P2-2: 添加缓存监控函数

**文件**: `src/db/schema.js`

**新增函数**:
```javascript
/**
 * Get cache statistics
 * @returns {Promise<{count: number, oldest: number, newest: number}>}
 */
export async function getAnalysisCacheStats() {
    const all = await db.analysisCache.toArray();
    if (all.length === 0) {
        return { count: 0, oldest: null, newest: null };
    }
    const timestamps = all.map(i => i.createdAt);
    return {
        count: all.length,
        oldest: Math.min(...timestamps),
        newest: Math.max(...timestamps)
    };
}
```

**预计工时**: 30 分钟

---

### P2-3: 添加任务超时清理

**文件**: `bridge/services/taskQueue.js`

**目的**: 定期清理过时任务，释放内存

**新增函数**:
```javascript
const TASK_TTL_MS = 24 * 60 * 60 * 1000;  // 24 小时

export function cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [id, task] of tasks.entries()) {
        if (now - task.updatedAt > TASK_TTL_MS) {
            tasks.delete(id);
            removed++;
        }
    }

    console.log(`[TaskQueue] Cleaned up ${removed} stale tasks`);
    return removed;
}

// 每 1 小时执行一次
setInterval(cleanup, 60 * 60 * 1000);
```

**预计工时**: 20 分钟

---

## 执行时间表

| 阶段 | 任务 | 预计工时 | 计划完成日期 |
|------|------|----------|--------------|
| **P0** | P0-1: 修复轮询错误处理 | 15 分钟 | 2026-02-28 |
| **P0** | P0-2: 修复 JSON 导出脚本 | 30 分钟 | 2026-02-28 |
| **P1** | P1-1: 添加速率限制 | 20 分钟 | 2026-03-01 |
| **P1** | P1-2: 添加请求日志 | 10 分钟 | 2026-03-01 |
| **P1** | P1-3: 统一函数命名 | 10 分钟 | 2026-03-01 |
| **P1** | P1-4: 导出 getBridgeUrl | 5 分钟 | 2026-03-01 |
| **P2** | P2-1: 简化 Dexie version | 20 分钟 | 2026-03-05 |
| **P2** | P2-2: 添加缓存监控 | 30 分钟 | 2026-03-05 |
| **P2** | P2-3: 添加任务超时清理 | 20 分钟 | 2026-03-05 |

**总计工时**: 约 2.5 小时

---

## 测试策略

### 单元测试

| 测试对象 | 测试场景 |
|---------|---------|
| `pollTaskStatus` | 网络错误、超时、重试 |
| `syncToBridge` | 正常同步、Bridge 不可用 |
| 速率限制 | 超限流响应 |

### 集成测试

| 流程 | 测试步骤 |
|------|---------|
| 缓存命中 | 导入已分析内容 → 验证直接加载 |
| 缓存未命中 | 导入新内容 → 验证完整流程 |
| 错误恢复 | 模拟 Bridge 不可用 → 验证降级 |

---

## 验收标准

### P0 验收
- [ ] 轮询在 20 次失败后正确抛出错误
- [ ] JSON 导出含特殊字符时格式正确

### P1 验收
- [ ] 15 分钟内超过 100 个请求被限流
- [ ] 请求日志记录在服务器日志中
- [ ] 所有函数命名一致
- [ ] `getBridgeUrl` 可从外部调用

### P2 验收
- [ ] Dexie version 6 只包含新增表
- [ ] 缓存统计函数返回正确数据
- [ ] 任务 24 小时后自动清理

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Dexie 不支持增量 version | 中 | 提前验证，保留原方案 |
| `jq` 未安装 | 低 | 提供安装说明，添加检测 |
| 速率限制影响用户体验 | 低 | 设置合理阈值，提供错误提示 |

---

## 负责人

- **开发**: Claude Code
- **审查**: 待安排
- **测试**: 待安排

---

**计划制定时间**: 2026-02-28
**计划开始日期**: 2026-02-28
**预计完成日期**: 2026-03-05
