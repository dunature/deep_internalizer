# Deep Internalizer 重构计划

**创建日期**: 2026-03-01
**状态**: Phase 1 ✅ 完成 | Phase 2 🚧 进行中 | Phase 3 📋 计划中

---

## 概述

本项目正在进行系统性重构，目标是：
1. 消除资源泄漏风险
2. 增强错误可见性与安全性
3. 消除双端逻辑重复（Prompt 漂移）
4. 拆分 God Component（1064 行 App.jsx）

---

## Phase 1: 稳固后端底座 ✅

### 任务 1.1: 激活 cacheManager cleanup

**文件**: `bridge/server.js`

**实现**:
```javascript
function scheduleCacheCleanup() {
    const CLEANUP_TIME = 2 * 60 * 60 * 1000; // 2:00 AM
    const INTERVAL = 24 * 60 * 60 * 1000;    // 24 hours
    const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

    // 每日凌晨 2 点清理 30 天前的缓存
    setTimeout(function runCleanup() {
        cacheManager.cleanup(MAX_AGE)
            .then(count => console.log(`[Cache] Cleaned ${count} entries`))
            .catch(e => console.error('[Cache] Cleanup failed:', e));
        setTimeout(runCleanup, INTERVAL).unref();
    }, delayToNextRun).unref();
}
```

**验收标准**:
- [x] 定时任务启动
- [x] 使用 `unref()` 允许进程退出
- [x] 错误不阻断主流程

---

### 任务 1.2: 细化全局错误分发

**文件**: `bridge/server.js`

**实现**:
```javascript
app.use((err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const isOperational = err.isOperational || false;

    res.status(status).json({
        error: isOperational ? err.message : 'Internal server error',
        code: err.code || 'UNKNOWN_ERROR'
    });
});
```

**验收标准**:
- [x] 区分 Operational Error 和 Programmatic Error
- [x] 返回统一错误码
- [x] 服务端记录完整堆栈

---

### 任务 1.3: 引入 Helmet 安全头

**依赖**: `npm install helmet`

**实现**:
```javascript
import helmet from 'helmet';
app.use(helmet());
```

**验收标准**:
- [x] 添加 `X-Content-Type-Options: nosniff`
- [x] 添加 `X-Frame-Options: DENY`
- [x] 添加 `X-XSS-Protection`

---

## Phase 2: 收敛双端逻辑 🚧

### 任务 2.1: 移除双端重复 Prompt

**问题**:
- `src/services/chunkingService.js` 有 `CHUNKING_SYSTEM_PROMPT`
- `bridge/services/aiProcessor.js` 有相同 Prompt

**方案**: 前端标注为降级备用
```javascript
/**
 * DEPRECATION NOTICE:
 * This module is a fallback for when Bridge Server is unavailable.
 * Primary analysis should go through Bridge Server's /api/content/analyze.
 */
```

**验收标准**:
- [ ] 添加废弃通知注释
- [ ] 文档明确主次关系

---

### 任务 2.2: 增量化 Dexie version 定义

**当前** (冗余):
```javascript
db.version(4).stores({ /* 全部重复 v3 */ });
db.version(6).stores({ /* 全部重复 v4 */ });
```

**目标** (增量):
```javascript
db.version(4).stores({ analysisCache: 'hash, createdAt' });
db.version(6).stores({ claudeCodeCache: 'hash, taskId, source, createdAt' });
```

**验收标准**:
- [ ] 仅声明新增表
- [ ] 升级测试通过

---

## Phase 3: 拆解神级组件 📋

### 任务 3.1: 提取 useDocumentImport Hook

**目标文件**: `src/hooks/useDocumentImport.js`

**提取内容**:
- `handleImport` (行 566-709)
- `handleSummaryConfirm` (行 439-511)
- `handleSummaryRegenerate` (行 513-563)
- `persistImportResult` (行 323-430)

**验收标准**:
- [ ] App.jsx < 700 行
- [ ] Hook 可独立单元测试

---

### 任务 3.2: 剥离视图状态路由

**目标**: App.jsx 仅负责视图路由

**重构后**:
```javascript
function App() {
  const { currentView } = useAppStore();
  const { importDocument } = useDocumentImport();

  switch (currentView) {
    case VIEW.INTERCEPTION: return <LaunchInterception />;
    case VIEW.REVIEW: return <VocabularyReview />;
    case VIEW.LAYER0: return <GlobalBlueprint />;
    // ...
  }
}
```

**验收标准**:
- [ ] App.jsx < 400 行
- [ ] 无业务逻辑

---

## 时间线

| 阶段 | 开始日期 | 结束日期 | 状态 |
|------|----------|----------|------|
| Phase 1 | 2026-03-01 | 2026-03-01 | ✅ 完成 |
| Phase 2 | 2026-03-02 | 2026-03-08 | 🚧 进行中 |
| Phase 3 | 2026-03-09 | 2026-03-22 | 📋 计划中 |

---

## 衡量指标

| 指标 | 重构前 | 目标 | 当前 |
|------|--------|------|------|
| App.jsx 行数 | 1064 | < 400 | 1064 |
| 重复 Prompt 数 | 2 | 1 | 2 |
| Dexie 冗余定义 | 80 行 | < 20 行 | 80 行 |
| 安全 Headers | 无 | Helmet | ✅ |
| 缓存清理 | 无 | 每日 | ✅ |

---

## 参考文档

- [代码审查报告](../CODE_REVIEW_REPORT.md)
- [Claude Code 集成设计](../docs/claude-code-integration-complete.md)
- [Bridge Server API 文档](../docs/api.md)
