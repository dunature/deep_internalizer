#!/bin/bash
# Deep Internalizer - Main Analyzer Script
# 整合内容提取和分析流程

set -e

INPUT="$1"

if [ -z "$INPUT" ]; then
    echo "错误：请提供输入参数"
    echo "用法：$0 <url|file-path>"
    echo "示例："
    echo "  $0 https://example.com/article"
    echo "  $0 ./document.pdf"
    echo "  $0 ./article.md"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTRACT_SCRIPT="$SCRIPT_DIR/extract-content.sh"
PROMPTS_DIR="$SCRIPT_DIR/prompts"

# 临时文件目录
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "=================================================="
echo "Deep Internalizer - 文章分析器"
echo "=================================================="
echo "输入：$INPUT"
echo "=================================================="
echo ""

# 步骤 1: 内容提取
echo "步骤 1: 内容提取..."
CONTENT_FILE="$TEMP_DIR/content.txt"

# 检测输入类型
if [[ "$INPUT" =~ ^https?:// ]]; then
    # 远程 URL - 使用 web_fetch (通过 curl 调用 Jina AI)
    echo "检测为远程 URL，使用 Jina AI Reader..."
    curl -s --max-time 15 "https://r.jina.ai/$INPUT" > "$CONTENT_FILE" || {
        echo "错误：无法提取网页内容"
        exit 1
    }
elif [[ "$INPUT" =~ \.pdf$ ]]; then
    # PDF 文件 - 需要特殊处理
    echo "检测为 PDF 文件"
    echo "PDF_FILE:$INPUT"
    exit 0
else
    # 本地文件
    if [ ! -f "$INPUT" ]; then
        echo "错误：文件不存在：$INPUT"
        exit 1
    fi
    cat "$INPUT" > "$CONTENT_FILE"
fi

WORD_COUNT=$(wc -w < "$CONTENT_FILE")
echo "提取成功，词数：$WORD_COUNT"
echo ""

# 步骤 2: AI 分析
echo "步骤 2: AI 分析..."
echo ""

# 读取 Prompt 模板
THESIS_PROMPT=$(cat "$PROMPTS_DIR/thesis.txt")
OUTLINE_PROMPT=$(cat "$PROMPTS_DIR/outline.txt")

# 准备分析上下文
CONTENT_SAMPLE=$(head -c 4000 "$CONTENT_FILE")

# 输出分析指令（供 Claude Code 使用）
cat << EOF
========================================
AI 分析指令 (请使用 LLM 执行以下分析)
========================================

【内容预览】
${CONTENT_SAMPLE:0:500}...

【分析任务】

1. 核心论点 (THESIS)
Prompt:
$THESIS_PROMPT

2. 大纲结构 (OUTLINE)
Prompt:
$OUTLINE_PROMPT

3. 语义分块 (CHUNKS) - 如需详细分析
Prompt 文件：$PROMPTS_DIR/chunking.txt

4. 词汇提取 (VOCABULARY) - 如需详细分析
Prompt 文件：$PROMPTS_DIR/vocabulary.txt

5. 句子分析 (SENTENCES) - 如需详细分析
Prompt 文件：$PROMPTS_DIR/sentence.txt

========================================
请按照上述 Prompt 执行分析，并生成 Markdown 报告
========================================
EOF

echo ""
echo "脚本准备完成，等待 AI 分析..."
