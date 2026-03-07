# Deep Internalizer — 设计规范与重构指南

> **文档目标**：为页面视觉重构提供唯一真相来源 (Single Source of Truth)。
> 
> **基准参考**：已重构的 **Layer 1 Step 2（Vocabulary Build）** 为跨页一致性的对照标准。
> 
> **重构目标**：优化页面布局视觉风格 + 信息层级梳理 + 功能视觉优化。

---

## 一、设计系统 (Design System)

### 1.1 全局色板

> **主题色调**: Dark Mode 为主基础，Step 2 页面采用反色（浅底 Light Mode）沉浸方案。

| Token | 值 | 用途 |
|-------|-----|------|
| `--color-bg-primary` | `#0a0a0f` | 全局页面底色（Global Map, Step 1） |
| `--color-bg-secondary` | `#12121a` | 次要容器/卡片背景 |
| `--color-bg-elevated` | `#1a1a25` | 悬浮卡片/输入框背景 |
| `--color-bg-overlay` | `rgba(0,0,0,0.75)` | 弹窗遮罩层 |
| `--color-accent-primary` | `#818cf8` | 主题蓝紫色（主要按钮、active 状态） |
| `--color-accent-secondary` | `#c084fc` | 辅助紫色（hover态、渐变末端） |
| `--color-accent-gradient` | `linear-gradient(135deg, #818cf8→#c084fc)` | 主操作按钮、Progress Fill |
| `--color-text-primary` | `#f8fafc` | 主文字（同时作为 Step 2 页面背景底色） |
| `--color-text-secondary` | `#94a3b8` | 辅助文字（副标题、次要说明） |
| `--color-text-muted` | `#64748b` | 极弱文字（进度、标签等次元素） |
| `--color-success` | `#22c55e` | 完成/成功态 |
| `--color-error` | `#ef4444` | 错误/提示破坏性操作 |

### 1.2 Step 2 页面反色方案（Light Surface）

Step 2 是沉浸式单词卡学习，使用**反色浅底**设计。此方案同时是页面重构的视觉基准。

| 用途 | 值 | 说明 |
|------|-----|------|
| 页面背景 | `#f8fafc` | 主容器底色，同时覆盖全局 top-nav |
| 卡片背景 | `#ffffff` | 主单词卡 (白卡) |
| 卡片阴影 | `0 4px 24px rgba(0,0,0,0.08)` | 弥散柔阴影 |
| 边框 | `1px solid #e2e8f0` | 卡片/分割线边框 |
| 主文字 | `#0f172a` | 大字单词颜色 |
| 次文字 | `#475569` | 定义/翻译文字 |
| 静音文字 | `#94a3b8` | 进度 `Word X of Y` 等 |

### 1.3 字体系统

| Token | 字体 | 用途 |
|-------|------|------|
| `--font-sans` | Inter, system-ui | UI 元素、按钮、标签 |
| `--font-serif` | Playfair Display, Georgia | 标题（h1-h4）、摘要内容 |
| `--font-mono` | JetBrains Mono | 代码/技术内容 |

**基准字号（base = 17px）**

| Token | rem | px | 代表用途 |
|-------|-----|----|---------|
| `--text-xs` | 0.9375 | ~16px | 进度文字、note |
| `--text-sm` | 1.0625 | ~18px | 按钮文字、辅助说明 |
| `--text-base` | 1.1875 | ~20px | 正文段落 |
| `--text-lg` | 1.375 | ~23px | h4、卡片副标题 |
| `--text-xl` | 1.75 | ~30px | h3、章节标题 |
| `--text-2xl` | 2.5 | ~43px | h2 |
| `--text-3xl` | 3.5 | ~60px | h1（Hero 单词字号参考基准） |

> **Step 2 单词 Hero 字号**：实际使用 `3.5rem~4.5rem`（即 `--text-3xl` 到自定义大字号），是全站最大字号，表达"此页唯一焦点"。

### 1.4 间距系统

| Token | 值 | 常用位置 |
|-------|-----|---------|
| `--space-2` | 8px | 元素内小间距 |
| `--space-3` | 12px | 按钮内 padding |
| `--space-4` | 16px | 组件内 padding，行间距 |
| `--space-5` | 20px | Block 内 padding |
| `--space-6` | 24px | 卡片/页面 padding |
| `--space-8` | 32px | 页面两侧 padding |
| `--space-10` | 40px | 大区块间距 |
| `--space-12` | 48px | 特大区块间距 |

### 1.5 圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 6px | 小标签 Pill |
| `--radius-md` | 10px | 按钮默认圆角 |
| `--radius-lg` | 16px | 卡片默认圆角 |
| `--radius-xl` | 24px | 大卡片 / Modal |
| `--radius-full` | 9999px | 圆形按钮、进度条 |

### 1.6 过渡动效

| Token | 值 | 用途 |
|-------|-----|------|
| `--transition-fast` | 150ms ease | hover 反馈、颜色切换 |
| `--transition-base` | 250ms ease | 卡片切换、按钮形变 |
| `--transition-slow` | 400ms ease | 进度条、页面级别动画 |

---

## 二、信息层级规范 (Information Hierarchy)

### 原则

每个页面应遵守 **3 层信息密度**：

| 层级 | 权重 | 视觉手段 |
|------|------|---------|
| **Primary（主焦点）** | 唯一核心内容 | 最大字号、最强对比、居中或占据视觉重心 |
| **Secondary（辅助内容）** | 支持性说明 | 中等字号、secondary 文字色 |
| **Tertiary（情境内容）** | 进度、状态、返回导航 | 小字号、muted 色、边缘位置 |

---

## 三、各页面信息层级与视觉重构规格

### 页面 1 — Global Map（全局知识地图）

| 层级 | 元素 | 视觉规格 |
|------|------|---------|
| **Primary** | 当前文档 + Chunk 节点列表 | 中心主展示区，Chunk 节点大圆形/卡片 |
| **Secondary** | 文档标题、Chunk 完成进度 | `text-lg` / `text-xl`，进度环/进度条 |
| **Tertiary** | 顶部导航、Import 按钮、Profile 入口 | `text-sm`，muted 底色 |

**重构方向**：
- Top Nav 使用淡色（不抢焦点），只保留关键面包屑
- Chunk 节点改为更清晰的卡片式 (card)，包含 title + step 进度 + 状态 icon
- 若无文档，展示空状态 CTA（Import Now）

---

### 页面 2 — Step 1（Macro Context）

| 层级 | 元素 | 视觉规格 |
|------|------|---------|
| **Primary** | Summary Card（英文摘要） | 深色大圆角卡片，`text-base`~`text-lg`，内容为主 |
| **Secondary** | 中文摘要、原文预览 | 分割线下，`text-sm`，略浅色 |
| **Tertiary** | 步骤标签、双语按钮、CTA | 边缘/底部，`text-sm` |

**重构方向**：
- Summary Card 须在视口内完整呈现，不要求滚动
- "I understand the context →" CTA 固定底部
- 步骤标签栏不应占据太大视觉重量（缩小 padding）

---

### 页面 3 — Step 2（Vocabulary Build）⭐ 基准参考页

| 层级 | 元素 | 视觉规格 |
|------|------|---------|
| **Primary** | 单词 Hero 文字 | 最大字号（3.5rem+），`#0f172a`，居中或视觉上移 |
| **Secondary** | 音标 + 释义 Block（含例句） | 分割线下，`text-sm`~`text-base` |
| **Tertiary** | Word X of Y 进度、Back 按钮 | `text-xs`，`#94a3b8`，极弱权重 |

**已实现规格（用作跨页基准）**：
- 页面背景：`#f8fafc`，全局 nav 同色无遮罩
- 卡片：白底 `#ffffff`，弥散阴影，`radius-lg`
- 双按钮：Ghost Secondary（`I know this`）+ Solid Primary（`Add to vocabulary`）
- 严格 `100vh` 无滚动锁定，内部元素用 flex space-between 分布

---

### 页面 4 — Step 3（Articulation）

| 层级 | 元素 | 视觉规格 |
|------|------|---------|
| **Primary** | 当前句子（大字，Thought Group 高亮） | 卡片内大字，高亮区块用 `rgba(accent, 0.15)` 底色 |
| **Secondary** | 中文翻译 | 分割线下，`text-sm`，`text-secondary` 色 |
| **Tertiary** | 翻页控制器、Play 按钮（进入 Primary 但要形式简洁）、进度 | 底部居中 |

**重构方向**：
- Play 按钮适当放大以增强"朗读引导感"
- 翻页控制采用三联排列（← / X of Y / →），清晰但轻量
- 句子卡片与 Step 2 卡片视觉语言一致（白卡 + 弥散阴影）

---

### 页面 5 — Step 4（Flow Practice）

| 层级 | 元素 | 视觉规格 |
|------|------|---------|
| **Primary** | 全文本阅读内容区 | 流式文字，行高 `1.8`，适合阅读的 `text-base`~`text-lg` |
| **Secondary** | 双语对照区（译文） | 字体略小，颜色 `text-secondary` |
| **Tertiary** | 播放进度条、完成 CTA | 吸底控制栏，轻量设计 |

**重构方向**：
- 内容区最大宽度约 `680px`，水平居中
- 吸底播放器高度控制在 `56px` 以内
- 完成按钮在文章底部并附提示语（防止用户误触）

---

## 四、跨页面一致性规则（Cross-Page Consistency）

以下规则在所有页面必须统一：

| 规则 | 规格 |
|------|------|
| **顶部导航** | 高度一致；不使用 `backdrop-filter` 遮罩；与内容区背景同底色或透明 |
| **卡片组件** | 统一使用 `radius-lg`（16px），卡片 shadow 参考 Step 2 弥散阴影 |
| **主操作按钮 (CTA)** | 底部居中，宽度不超过半屏，配 `accent-gradient`；Ghost 次按钮用边框灰色 |
| **字体层级** | 只使用 `--text-xs` ~ `--text-3xl`，不 hardcode 像素值 |
| **图标使用** | 只用语义明确的图标（Speaker、Arrow、Check），不用纯装饰图标 |
| **动效** | 卡片切换统一 `transition-base`（250ms），hover 反馈用 `transition-fast`（150ms） |
| **无滚动原则（学习步骤页）** | Step 1~4 页面强制 `height: 100vh; overflow: hidden`，核心内容不依赖滚动 |

---

## 五、当前已知视觉问题清单（重构 Checklist）

| 页面 | 问题 | 优先级 |
|------|------|-------|
| 全局 `top-nav` | Step 2 进入时有深色遮罩漏出 | ✅ 已修复 |
| Step 2 Header | 视觉居中未达到重心平衡 | ⚠️ 待优化 |
| Step 2 单词大小 | Hero 字号仍偏小或页面外 | ⚠️ 待验证 |
| Step 1 Summary Card | 卡片内容被截断或超出视口 | 🔲 待修复 |
| Step 3 句子卡片 | 与 Step 2 卡片语言不统一（深色 vs 浅色） | 🔲 待修复 |
| Global Map | Chunk 节点视觉层级与 Step 页面风格脱节 | 🔲 待规划 |
| 所有页面 | 按钮 padding 和字号未按 Token 统一 | 🔲 待统一 |
