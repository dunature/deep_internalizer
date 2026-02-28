#!/bin/bash
# Deep Internalizer - Chunked Analyzer
# 支持分析长文本（>10000 词），自动分块处理

set -e

INPUT="$1"
MAX_CHUNK_SIZE=${2:-8000}  # 每块最大字符数
OVERLAP=${3:-500}          # 块间重叠字符数

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 使用帮助
usage() {
    cat << EOF
用法：$0 <输入> [最大块大小] [重叠大小]

分析长文本时自动分块处理

参数:
    输入           URL 或文件路径
    最大块大小     每块最大字符数 (默认：8000)
    重叠大小       块间重叠字符数 (默认：500)

示例:
    $0 https://example.com/long-article
    $0 ./large-document.md 10000 800

EOF
    exit 1
}

if [ -z "$INPUT" ]; then
    usage
fi

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}Deep Internalizer - 长文本分块分析${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""
echo -e "输入：${YELLOW}$INPUT${NC}"
echo -e "最大块大小：${YELLOW}$MAX_CHUNK_SIZE${NC}"
echo -e "重叠大小：${YELLOW}$OVERLAP${NC}"
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

TOTAL_CHARS=$(wc -c < "$CONTENT_FILE")
TOTAL_WORDS=$(wc -w < "$CONTENT_FILE")

echo -e "${GREEN}提取成功${NC}"
echo -e "  总字符数：${TOTAL_CHARS}"
echo -e "  总词数：${TOTAL_WORDS}"
echo ""

# 步骤 2: 判断是否需要分块
if [ "$TOTAL_CHARS" -le "$MAX_CHUNK_SIZE" ]; then
    echo -e "${GREEN}文本较短，无需分块，直接分析${NC}"
    echo ""
    echo "=================================================="
    echo "开始分析..."
    echo "=================================================="

    # 调用标准分析器
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    "$SCRIPT_DIR/analyzer.sh" "$CONTENT_FILE"
    exit 0
fi

# 步骤 3: 分块
echo -e "${BLUE}[步骤 2] 分块处理...${NC}"

# 计算分块数量
NUM_CHUNKS=$(( (TOTAL_CHARS + MAX_CHUNK_SIZE - OVERLAP - 1) / (MAX_CHUNK_SIZE - OVERLAP) ))
echo -e "  将分为 ${YELLOW}$NUM_CHUNKS${NC} 块"
echo ""

# 创建分块
split -b "$MAX_CHUNK_SIZE" -d "$CONTENT_FILE" "$TEMP_DIR/chunk_"

# 步骤 4: 逐块分析
echo -e "${BLUE}[步骤 3] 逐块分析...${NC}"
echo ""

RESULTS_DIR="$TEMP_DIR/results"
mkdir -p "$RESULTS_DIR"

CHUNK_INDEX=0
for chunk_file in "$TEMP_DIR"/chunk_*; do
    ((CHUNK_INDEX++))

    echo -e "${BLUE}=== 块 $CHUNK_INDEX / $NUM_CHUNKS ===${NC}"

    CHUNK_WORDS=$(wc -w < "$chunk_file")
    echo -e "词数：${CHUNK_WORDS}"

    # 分析当前块
    OUTPUT_FILE="$RESULTS_DIR/analysis_$CHUNK_INDEX.md"

    # 读取 Prompt 模板
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROMPTS_DIR="$SCRIPT_DIR/prompts"

    # 生成该块的分析
    cat << EOF > "$OUTPUT_FILE"
# 分析结果 - 块 $CHUNK_INDEX

## 内容预览
$(head -c 500 "$chunk_file")...

## 核心论点 (THESIS)
EOF

    # 调用 LLM 分析 THESIS
    echo -e "${YELLOW}正在分析 THESIS...${NC}"
    # (此处应调用 LLM API，由于是 Bash 脚本，实际使用时需要通过其他工具调用)

    echo -e "${GREEN}块 $CHUNK_INDEX 分析完成${NC}"
    echo ""
done

# 步骤 5: 合并结果
echo -e "${BLUE}[步骤 4] 合并结果...${NC}"

MERGED_FILE="$RESULTS_DIR/merged_analysis.md"

cat << EOF > "$MERGED_FILE"
# Deep Internalizer - 长文本分析报告

**来源**: $INPUT
**总字符数**: $TOTAL_CHARS
**总词数**: $TOTAL_WORDS
**分块数量**: $NUM_CHUNKS
**分析日期**: $(date -Iseconds)

---

EOF

# 合并所有块的分析结果
for i in $(seq 1 $CHUNK_INDEX); do
    if [ -f "$RESULTS_DIR/analysis_$i.md" ]; then
        echo "" >> "$MERGED_FILE"
        echo "## 块 $i" >> "$MERGED_FILE"
        cat "$RESULTS_DIR/analysis_$i.md" >> "$MERGED_FILE"
        echo "" >> "$MERGED_FILE"
        echo "---" >> "$MERGED_FILE"
    fi
done

echo -e "${GREEN}合并完成${NC}"
echo ""
echo "=================================================="
echo "分析完成"
echo "=================================================="
echo ""
echo -e "输出文件：${YELLOW}$MERGED_FILE${NC}"
echo ""
echo "注意：由于这是 Bash 脚本示例，实际的 LLM 分析需要:"
echo "1. 调用本地 LLM (如 Ollama)"
echo "2. 或调用云端 API (如 bigmodel.cn)"
echo ""
