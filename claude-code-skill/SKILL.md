---
name: deep-internalizer-analyzer
description: "深度分析文章/文档内容（网页/PDF/Markdown），提取核心论点、大纲、词汇、难句，生成学习报告。支持 Deep Internalizer 项目集成和 Bridge Server 调用。触发词：/analyze-article。"
---

# Deep Internalizer Analyzer Skill

深度分析用户提供的文章或文档，提取：
1. **核心论点 (THESIS)** - 一句话总结核心主张
2. **大纲结构 (OUTLINE)** - 逻辑结构拆解
3. **语义分块 (CHUNKS)** - 用于深度学习的段落划分
4. **关键 词汇 (VOCABULARY)** - B2+ 高级词汇及释义
5. **难句分析 (SENTENCES)** - 复杂句式的意群拆分

## 项目上下文感知

本 Skill 与 Deep Internalizer 项目深度集成：

| 项目路径 | 用途 |
|---------|------|
| `/Users/a2030/02-Area/deep_internalizer/` | 项目根目录 |
| `bridge/` | Bridge Server（AI 分析后端） |
| `src/services/` | 前端服务层 |
| `claude-code-skill/` | Skill 脚本和 Prompt |

### Bridge Server 集成

**优先使用 Bridge Server** 进行文档分析（单一事实来源）：

```bash
# 启动 Bridge Server
cd /Users/a2030/02-Area/deep_internalizer/bridge
npm start

# 调用分析 API
curl -X POST http://localhost:3737/api/content/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BRIDGE_API_KEY" \
  -d '{"text": "文章内容"}'
```

**环境变量** (`.env.local`):
```bash
BRIDGE_PORT=3737
BRIDGE_API_KEY=your-api-key
LLM_PROVIDER=ollama
LLM_MODEL=qwen2.5:7b
```

## Execution Steps（执行步骤）

当用户触发 `/analyze-article` 或类似请求时，按以下步骤执行：

### Step 0: 项目上下文检查（可选）

如果用户需要了解项目或修改 Skill：

```bash
# 查看项目结构
ls -la /Users/a2030/02-Area/deep_internalizer/

# 检查 Bridge Server 状态
curl http://localhost:3737/api/health

# 查看 Prompt 定义
cat /Users/a2030/02-Area/deep_internalizer/bridge/services/aiProcessor.js
```

### Step 1: 确定输入类型

```
用户输入 → 判断类型
├── https?:// → 远程网页
├── *.pdf → 本地 PDF
├── *.md/*.markdown → 本地 Markdown
└── 其他文本 → 直接分析
```

### Step 2: 内容提取

**网页 URL**:
1. 优先使用 `web_fetch` 工具提取内容
2. 如果失败，使用 `webReader("https://r.jina.ai/http://<url>")` 作为备选
3. **Bridge Server 集成**：如果 Bridge Server 可用，优先使用其缓存检测

**本地 PDF**:
- 使用 `Read` 工具的 `pages` 参数读取

**本地 Markdown**:
- 使用 `Read` 工具直接读取

**Bridge Server 缓存检测**（推荐）:
```bash
# 检查内容是否已分析过
curl -X GET http://localhost:3737/api/cache/<content-hash> \
  -H "Authorization: Bearer $BRIDGE_API_KEY"
```

### Step 3: AI 分析

**首选：Bridge Server 分析**（单一事实来源）:
```bash
cd /Users/a2030/02-Area/deep_internalizer/bridge
npm start

# 调用分析 API
curl -X POST http://localhost:3737/api/content/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BRIDGE_API_KEY" \
  -d '{"text": "<提取的内容>"}'
```

**备选：本地 Prompt 分析**（Bridge Server 不可用时）:
使用 Prompt 模板（位于 `~/.claude/skills/deep-internalizer-analyzer/prompts/` 或项目目录 `claude-code-skill/prompts/`）：

1. **THESIS** (`thesis.txt`): 核心论点，一句话总结
2. **OUTLINE** (`outline.txt`): 4-6 个要点的大纲
3. **CHUNKS** (`chunking.txt`): 语义分块（可选，用于详细分析）
4. **VOCABULARY** (`vocabulary.txt`): 5-8 个关键词汇
5. **SENTENCES** (`sentence.txt`): 难句意群拆分（可选，选 1-3 个典型句子）

> **注意**: Prompt 已收敛至 `bridge/services/aiProcessor.js`，前端 `src/services/chunkingService.js` 已标记为降级备用。

### Step 4: 生成报告

按以下格式输出 Markdown 报告：

```markdown
# [文章标题或描述]

## 核心论点 (THESIS)
[一句话总结]

## 大纲结构 (OUTLINE)
1. [要点 1]
2. [要点 2]
3. [要点 3]
4. [要点 4]

## 关键 词汇 (VOCABULARY)
| 单词 | 音标 | 词性 | 释义 (EN) | 释义 (ZH) | 例句 |
|------|------|------|-----------|-----------|------|
| ... | ... | ... | ... | ... | ... |

## 难句分析 (SENTENCES) [可选]

### 句子 1
> [原句]

**意群拆分**: [group 1] | [group 2] | [group 3]
**中文**: [翻译]
```

### Step 5: Deep Internalizer 集成（可选）

**启动 Bridge Server**:
```bash
cd /Users/a2030/02-Area/deep_internalizer/bridge
npm install
npm start
# 运行在 http://localhost:3737
```

**启动前端应用**:
```bash
cd /Users/a2030/02-Area/deep_internalizer
npm install
npm run dev
# 运行在 http://localhost:5173
```

**导出 JSON 并导入**:
1. 分析完成后，生成 JSON（见下方格式）
2. 打开 Deep Internalizer 应用（http://localhost:5173）
3. 点击 **Import** 按钮
4. 粘贴 JSON 内容

**缓存检测流程**:
```
用户输入内容
    ↓
计算 SHA-256 哈希
    ↓
查询 Bridge Server 缓存
    ↓
命中 → 返回缓存结果
未命中 → 执行分析 → 保存到缓存 → 返回结果
```

### Step 6: 询问导出（可选）

分析完成后，询问用户：
- "是否需要导出为 Deep Internalizer 格式的 JSON？"
- "是否需要启动 Bridge Server 进行缓存？"
- "是否需要进一步分析某个部分（如更多词汇或句子）？"

## Usage Examples

### 示例 1: 分析网页（带 Bridge Server 集成）

用户：`/analyze-article https://example.com/article`

执行:
1. 检查 Bridge Server 是否运行：`curl http://localhost:3737/api/health`
2. 如果 Bridge Server 可用：
   - 使用 `web_fetch("https://example.com/article")` 提取内容
   - 调用 Bridge Server API 进行分析和缓存
3. 如果 Bridge Server 不可用：
   - 使用 `web_fetch` 或 Jina AI 提取内容
   - 使用本地 Prompt 执行分析
4. 生成报告并询问是否导出 JSON

### 示例 2: 启动项目并分析

用户：` 帮我分析这篇文章，先启动项目 `

执行:
1. 启动 Bridge Server:
   ```bash
   cd /Users/a2030/02-Area/deep_internalizer/bridge
   npm start
   ```
2. 等待 Bridge Server 启动完成
3. 提取网页内容
4. 调用分析 API
5. 生成报告

### 示例 3: 分析 PDF

用户：`/analyze-article ./document.pdf`

执行:
1. `Read("./document.pdf", pages: 1-10)` 读取内容
2. 执行分析（Bridge Server 优先）
3. 生成报告

### 示例 4: 分析 Markdown

用户：`/analyze-article ./article.md`

执行:
1. `Read("./article.md")` 读取内容
2. 执行分析
3. 生成报告

## Prompt 模板位置

**主要位置**（单一事实来源）: `bridge/services/aiProcessor.js`

**备选位置**（降级备用）: `~/.claude/skills/deep-internalizer-analyzer/prompts/` 或 `claude-code-skill/prompts/`

| 文件 | 用途 |
|------|------|
| `thesis.txt` | 核心论点提取 |
| `outline.txt` | 大纲结构生成 |
| `chunking.txt` | 语义分块 |
| `vocabulary.txt` | 词汇提取 |
| `sentence.txt` | 句子分析 |

## 项目快速启动

### 启动 Bridge Server

```bash
cd /Users/a2030/02-Area/deep_internalizer/bridge
npm install
npm start
# 运行在 http://localhost:3737
# API 文档：http://localhost:3737/api/health
```

### 启动前端应用

```bash
cd /Users/a2030/02-Area/deep_internalizer
npm install
npm run dev
# 运行在 http://localhost:5173
```

### 环境变量配置

创建 `.env.local`:
```bash
# Bridge Server
BRIDGE_PORT=3737
BRIDGE_API_KEY=your-api-key
BRIDGE_FRONTEND_URL=http://localhost:5173

# LLM 配置
LLM_PROVIDER=ollama
LLM_BASE_URL=http://localhost:11434
LLM_MODEL=qwen2.5:7b
```

## JSON 导出格式

如果用户要求导出 JSON，使用以下格式：

```json
{
  "source": "claude-code-skill",
  "title": "文章标题",
  "url": "原始链接或本地路径",
  "contentHash": "<可选，SHA-256>",
  "result": {
    "coreThesis": "一句话总结",
    "summary": "THESIS + OUTLINE 整合",
    "model": "glm-4.7",
    "chunks": [
      {
        "title": "分块标题",
        "summary": "英文摘要",
        "summary_zh": "中文摘要",
        "originalText": "原文"
      }
    ],
    "vocabulary": [
      {
        "word": "单词",
        "phonetic": "/音标/",
        "pos": "词性",
        "definition": "英文释义",
        "definition_zh": "中文释义",
        "sentence": "原句",
        "newContext": "新例句"
      }
    ]
  }
}
```

## Troubleshooting

| 问题 | 解决方案 |
|------|---------|
| 网页提取失败 | 尝试 Jina AI Reader 备选方案 |
| PDF 是扫描版 | 告知用户需要 OCR 支持，建议转换为文本 |
| 文本过长 (>10000 词) | 建议拆分分析，或只分析前 5000 词 |
| JSON 解析失败 | 手动提取关键信息，不依赖 JSON 格式 |

## JSON 导出功能

### 导出命令

分析完成后，用户可以说：
- `导出为 JSON`
- `Export to JSON`
- `保存到文件`

### 完整 JSON 格式

```json
{
  "taskId": "<UUID>",
  "source": "claude-code-skill",
  "title": "<文章标题>",
  "url": "<原始链接或本地路径>",
  "contentHash": "<SHA-256 哈希>",
  "status": "done",
  "createdAt": "<ISO 8601 时间戳>",
  "completedAt": "<ISO 8601 时间戳>",
  "model": "<使用的模型>",
  "result": {
    "coreThesis": "<核心论点>",
    "summary": "<THESIS + OUTLINE 整合>",
    "chunks": [...],
    "vocabulary": [...],
    "sentences": [...]
  },
  "schemaVersion": "1.0.0"
}
```

### 导入 Deep Internalizer

1. 打开 Deep Internalizer 应用
2. 点击 **Import** 按钮
3. 选择 **JSON Import**
4. 粘贴 JSON 内容或上传文件

---

## 高级功能 (P2/P3/P4)

### P2: 批量处理

**用途**: 一次分析多个链接/文件

**命令**:
```bash
# 创建输入文件 (每行一个 URL 或路径)
cat > links.txt << EOF
https://example.com/article1
https://example.com/article2
./local/file.md
EOF

# 执行批量分析
./batch-analyze.sh -o ./exports -m standard links.txt
```

**选项**:
| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-o, --output` | 输出目录 | ./deep-internalizer-exports |
| `-m, --mode` | 分析模式 (basic/standard/deep) | standard |
| `-f, --format` | 输出格式 (json/markdown/both) | both |
| `-d, --dry-run` | 试运行，不实际执行 | false |

---

### P3: 缓存检测

**用途**: 检查内容是否已分析过，避免重复处理

**命令**:
```bash
# 查看缓存列表
node cache-manager.js list

# 查看缓存统计
node cache-manager.js stats

# 清理过期缓存 (超过 30 天)
node cache-manager.js clean 30

# 生成内容哈希
node cache-manager.js hash "要检查的内容"
```

**缓存检查流程**:
```
用户输入内容
    ↓
计算 SHA-256 哈希
    ↓
查询缓存
    ↓
命中 → 返回缓存结果
未命中 → 执行分析 → 保存到缓存
```

---

### P4: 高级功能

#### 4.1 PDF OCR 支持 (扫描版 PDF)

**用途**: 从扫描版 PDF 中提取文本

**依赖**:
```bash
# macOS
brew install tesseract
pip3 install pytesseract pdf2image

# Linux
sudo apt install tesseract-ocr
pip3 install pytesseract pdf2image
```

**命令**:
```bash
./pdf-ocr.sh ./scanned-document.pdf ./output
```

---

#### 4.2 长文本分块分析

**用途**: 分析超过 10000 词的长文本

**命令**:
```bash
# 自动分块分析 (默认每块 8000 字符，重叠 500 字符)
./chunked-analyzer.sh ./long-article.md

# 自定义分块参数
./chunked-analyzer.sh ./long-article.md 10000 800
```

**参数**:
| 参数 | 说明 | 默认值 |
|------|------|--------|
| 最大块大小 | 每块最大字符数 | 8000 |
| 重叠大小 | 块间重叠字符数 | 500 |

---

#### 4.3 自定义分析深度

**用途**: 根据需求选择分析深度

**三种模式**:
| 模式 | 内容 | 预计时间 |
|------|------|----------|
| `basic` | THESIS + OUTLINE | 1-2 分钟 |
| `standard` | THESIS + OUTLINE + VOCABULARY | 3-5 分钟 |
| `deep` | 全部分析 + 详细词汇 + 多句子 | 8-12 分钟 |

**命令**:
```bash
# 基础分析 (快速)
./depth-analyzer.sh https://example.com/article basic

# 标准分析 (推荐)
./depth-analyzer.sh https://example.com/article standard

# 深度分析 (完整)
./depth-analyzer.sh https://example.com/article deep
```

---

## 相关文件

| 文件 | 用途 |
|------|------|
| `SKILL.md` | 本文件，Skill 定义 |
| `analyzer.sh` | Bash 主脚本 |
| `extract-content.sh` | 内容提取脚本 |
| `generate-json.sh` | JSON 导出脚本 |
| `batch-analyze.sh` | 批量处理脚本 |
| `chunked-analyzer.sh` | 长文本分块脚本 |
| `depth-analyzer.sh` | 自定义深度脚本 |
| `pdf-ocr.sh` | PDF OCR 脚本 |
| `cache-manager.js` | 缓存管理脚本 |
| `claudeCodeSchema.js` | Schema 定义 |
| `JSON_EXPORT_GUIDE.md` | 导出详细指南 |
| `prompts/` | Prompt 模板目录 |
