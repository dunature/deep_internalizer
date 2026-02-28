#!/bin/bash
# Deep Internalizer - Batch Analyzer
# 支持一次分析多个链接/文件

set -e

# 配置
MAX_CONCURRENT=3
OUTPUT_DIR="${OUTPUT_DIR:-./deep-internalizer-exports}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 使用帮助
usage() {
    cat << EOF
用法：$0 [选项] <输入文件>

批量分析多个链接或文件

选项:
    -h, --help              显示帮助信息
    -o, --output <目录>     输出目录 (默认：./deep-internalizer-exports)
    -m, --mode <模式>       分析模式：basic|standard|deep (默认：standard)
    -f, --format <格式>     输出格式：json|markdown|both (默认：both)
    -d, --dry-run           试运行，不实际执行分析

输入文件格式 (每行一个 URL 或文件路径):
    https://example.com/article1
    https://example.com/article2
    ./local/file1.md
    ./local/file2.pdf

示例:
    $0 -o ./exports -m standard links.txt
    $0 --format json urls.txt

EOF
    exit 1
}

# 解析参数
MODE="standard"
FORMAT="both"
DRY_RUN=false
INPUT_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -m|--mode)
            MODE="$2"
            shift 2
            ;;
        -f|--format)
            FORMAT="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            INPUT_FILE="$1"
            shift
            ;;
    esac
done

# 验证输入文件
if [ -z "$INPUT_FILE" ]; then
    echo -e "${RED}错误：请提供输入文件${NC}"
    usage
fi

if [ ! -f "$INPUT_FILE" ]; then
    echo -e "${RED}错误：文件不存在：$INPUT_FILE${NC}"
    exit 1
fi

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 统计
TOTAL=0
SUCCESS=0
FAILED=0
SKIPPED=0

# 读取输入文件
echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}Deep Internalizer - 批量分析器${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""
echo -e "输入文件：${YELLOW}$INPUT_FILE${NC}"
echo -e "输出目录：${YELLOW}$OUTPUT_DIR${NC}"
echo -e "分析模式：${YELLOW}$MODE${NC}"
echo -e "输出格式：${YELLOW}$FORMAT${NC}"
echo ""

# 逐行处理
while IFS= read -r line || [ -n "$line" ]; do
    # 跳过空行和注释
    [[ -z "$line" || "$line" =~ ^# ]] && continue

    ((TOTAL++))

    ITEM_URL="$line"
    ITEM_NAME=$(basename "$line" | sed 's/\.[^.]*$//')
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    OUTPUT_BASE="$OUTPUT_DIR/${ITEM_NAME}_${TIMESTAMP}"

    echo -e "${BLUE}[$TOTAL] 分析：$ITEM_URL${NC}"

    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[跳过] 试运行模式${NC}"
        ((SKIPPED++))
        continue
    fi

    # 调用分析脚本
    if command -v ./analyzer.sh &> /dev/null; then
        ANALYZER="./analyzer.sh"
    elif [ -f "~/.claude/skills/deep-internalizer-analyzer/analyzer.sh" ]; then
        ANALYZER="~/.claude/skills/deep-internalizer-analyzer/analyzer.sh"
    else
        echo -e "${RED}[错误] 找不到 analyzer.sh${NC}"
        ((FAILED++))
        continue
    fi

    # 执行分析
    if $ANALYZER "$ITEM_URL" > "$OUTPUT_BASE.log" 2>&1; then
        echo -e "${GREEN}[成功]${NC} -> $OUTPUT_BASE.log"
        ((SUCCESS++))
    else
        echo -e "${RED}[失败]${NC} 查看日志：$OUTPUT_BASE.log"
        ((FAILED++))
    fi

    echo ""
done < "$INPUT_FILE"

# 汇总报告
echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}批量分析完成${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""
echo -e "总计：${TOTAL}"
echo -e "成功：${GREEN}${SUCCESS}${NC}"
echo -e "失败：${RED}${FAILED}${NC}"
echo -e "跳过：${YELLOW}${SKIPPED}${NC}"
echo ""
echo -e "输出目录：$OUTPUT_DIR"
