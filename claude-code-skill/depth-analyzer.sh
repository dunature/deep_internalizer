#!/bin/bash
# Deep Internalizer - Depth-based Analyzer
# 支持三种分析模式：基础/标准/深度

set -e

INPUT="$1"
DEPTH="${2:-standard}"  # basic | standard | deep

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 使用帮助
usage() {
    cat << EOF
用法：$0 <输入> [深度模式]

自定义分析深度

深度模式:
    basic      基础分析 - 仅 THESIS + OUTLINE (快速)
    standard   标准分析 - THESIS + OUTLINE + VOCABULARY (推荐)
    deep       深度分析 - 全部分析 + 详细词汇 + 多句子 (完整)

示例:
    $0 https://example.com/article basic
    $0 ./document.md standard
    $0 ./long-article.txt deep

EOF
    exit 1
}

if [ -z "$INPUT" ]; then
    usage
fi

# 验证深度模式
case "$DEPTH" in
    basic|standard|deep)
        ;;
    *)
        echo -e "${RED}错误：无效的深度模式：$DEPTH${NC}"
        echo "有效值：basic, standard, deep"
        usage
        ;;
esac

# 根据深度模式配置分析参数
case "$DEPTH" in
    basic)
        MAX_VOCAB=0
        MAX_SENTENCES=0
        ANALYSIS_NAME="基础分析"
        EST_TIME="1-2 分钟"
        ;;
    standard)
        MAX_VOCAB=8
        MAX_SENTENCES=0
        ANALYSIS_NAME="标准分析"
        EST_TIME="3-5 分钟"
        ;;
    deep)
        MAX_VOCAB=15
        MAX_SENTENCES=5
        ANALYSIS_NAME="深度分析"
        EST_TIME="8-12 分钟"
        ;;
esac

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}Deep Internalizer - 自定义深度分析${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""
echo -e "输入：${YELLOW}$INPUT${NC}"
echo -e "模式：${PURPLE}$ANALYSIS_NAME${NC}"
echo -e "预计时间：${YELLOW}$EST_TIME${NC}"
echo ""
echo -e "分析内容:"
echo -e "  ${GREEN}✓${NC} THESIS (核心论点)"
echo -e "  ${GREEN}✓${NC} OUTLINE (大纲结构)"
if [ "$MAX_VOCAB" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} VOCABULARY (词汇，最多 $MAX_VOCAB 个)"
else
    echo -e "  ${YELLOW}○${NC} VOCABULARY (跳过)"
fi
if [ "$MAX_SENTENCES" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} SENTENCES (难句分析，最多 $MAX_SENTENCES 个)"
else
    echo -e "  ${YELLOW}○${NC} SENTENCES (跳过)"
fi
echo ""

# 步骤 1: 提取内容
echo -e "${BLUE}[步骤 1] 提取内容...${NC}"

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

CONTENT_FILE="$TEMP_DIR/content.txt"

if [[ "$INPUT" =~ ^https?:// ]]; then
    # 网页
    curl -s "https://r.jina.ai/$INPUT" > "$CONTENT_FILE" || {
        echo -e "${RED}错误：无法提取网页内容${NC}"
        exit 1
    }
elif [ -f "$INPUT" ]; then
    # 本地文件
    cat "$INPUT" > "$CONTENT_FILE"
else
    echo -e "${RED}错误：无效的输入${NC}"
    usage
fi

TOTAL_WORDS=$(wc -w < "$CONTENT_FILE")
echo -e "${GREEN}提取成功${NC} - ${TOTAL_WORDS} 词"
echo ""

# 步骤 2: 根据深度模式执行分析
echo -e "${BLUE}[步骤 2] 执行分析...${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_DIR="$SCRIPT_DIR/prompts"

# 读取内容样本
CONTENT_SAMPLE=$(head -c 4000 "$CONTENT_FILE")

# 1. 生成 THESIS
echo -e "${YELLOW}正在生成 THESIS...${NC}"
THESIS_SYSTEM=$(cat "$PROMPTS_DIR/thesis.txt")

# 由于这是 Bash 脚本，实际调用 LLM 需要通过其他工具
# 这里显示应该如何调用
cat << EOF
========================================
THESIS Prompt (准备发送 LLM)
========================================
System: $THESIS_SYSTEM

User: Text:
$CONTENT_SAMPLE

========================================
EOF
echo ""

# 2. 生成 OUTLINE
echo -e "${YELLOW}正在生成 OUTLINE...${NC}"
OUTLINE_SYSTEM=$(cat "$PROMPTS_DIR/outline.txt")

cat << EOF
========================================
OUTLINE Prompt (准备发送 LLM)
========================================
System: $OUTLINE_SYSTEM

User: Text:
$CONTENT_SAMPLE

========================================
EOF
echo ""

# 3. 根据深度模式决定是否分析词汇
if [ "$MAX_VOCAB" -gt 0 ]; then
    echo -e "${YELLOW}正在提取 VOCABULARY (最多 $MAX_VOCAB 个)...${NC}"
    VOCAB_SYSTEM=$(cat "$PROMPTS_DIR/vocabulary.txt")

    # 对于深度模式，修改 Prompt 限制
    if [ "$DEPTH" = "deep" ]; then
        echo "(深度模式：将提取更多词汇)"
    fi
    echo ""
fi

# 4. 根据深度模式决定是否分析句子
if [ "$MAX_SENTENCES" -gt 0 ]; then
    echo -e "${YELLOW}正在分析 SENTENCES (最多 $MAX_SENTENCES 个)...${NC}"
    SENTENCE_SYSTEM=$(cat "$PROMPTS_DIR/sentence.txt")
    echo ""
fi

# 步骤 3: 生成报告
echo -e "${BLUE}[步骤 3] 生成报告...${NC}"
echo ""

OUTPUT_FILE="$TEMP_DIR/analysis_report.md"

cat << EOF > "$OUTPUT_FILE"
# Deep Internalizer 分析报告

**模式**: $ANALYSIS_NAME ($DEPTH)
**输入**: $INPUT
**词数**: $TOTAL_WORDS
**日期**: $(date -Iseconds)

---

## 核心论点 (THESIS)
[待 LLM 生成]

## 大纲结构 (OUTLINE)
[待 LLM 生成]

EOF

if [ "$MAX_VOCAB" -gt 0 ]; then
    cat << EOF >> "$OUTPUT_FILE"
## 关键 词汇 (VOCABULARY)
[待 LLM 生成，最多 $MAX_VOCAB 个]

EOF
fi

if [ "$MAX_SENTENCES" -gt 0 ]; then
    cat << EOF >> "$OUTPUT_FILE"
## 难句分析 (SENTENCES)
[待 LLM 生成，最多 $MAX_SENTENCES 个]

EOF
fi

echo -e "${GREEN}报告框架已生成${NC}"
echo ""
echo "=================================================="
echo "分析框架完成"
echo "=================================================="
echo ""
echo -e "输出文件：${YELLOW}$OUTPUT_FILE${NC}"
echo ""
echo "注意：这是 Bash 脚本框架，实际 LLM 调用需要:"
echo "1. 集成 curl 调用 API (如 bigmodel.cn)"
echo "2. 或使用 Ollama 本地调用"
echo ""
echo "完整实现参考：SKILL.md"
echo ""
