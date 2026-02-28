#!/bin/bash
# Deep Internalizer - PDF OCR Handler
# 使用 OCR 处理扫描版 PDF

set -e

PDF_FILE="$1"
OUTPUT_DIR="${2:-./ocr-output}"

# 检查依赖
check_dependencies() {
    local missing=()

    # 检查 Python
    if ! command -v python3 &> /dev/null; then
        missing+=("python3")
    fi

    # 检查 pytesseract/OCR 工具
    if ! python3 -c "import pytesseract" 2>/dev/null; then
        missing+=("pytesseract (pip install pytesseract)")
    fi

    # 检查 pdf2image
    if ! python3 -c "from pdf2image import convert_from_path" 2>/dev/null; then
        missing+=("pdf2image (pip install pdf2image)")
    fi

    # 检查系统级 tesseract
    if ! command -v tesseract &> /dev/null; then
        missing+=("tesseract-ocr")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        echo "错误：缺少以下依赖:"
        for dep in "${missing[@]}"; do
            echo "  - $dep"
        done
        echo ""
        echo "安装说明:"
        echo "  macOS:  brew install tesseract && pip3 install pytesseract pdf2image"
        echo "  Linux: sudo apt install tesseract-ocr && pip3 install pytesseract pdf2image"
        exit 1
    fi
}

# 使用帮助
usage() {
    cat << EOF
用法：$0 <PDF 文件> [输出目录]

使用 OCR 从扫描版 PDF 中提取文本

依赖:
  - Python 3
  - tesseract-ocr (系统级)
  - pytesseract (Python 包)
  - pdf2image (Python 包)

示例:
  $0 ./document.pdf
  $0 ./scan.pdf ./output

EOF
    exit 1
}

if [ -z "$PDF_FILE" ]; then
    usage
fi

if [ ! -f "$PDF_FILE" ]; then
    echo "错误：PDF 文件不存在：$PDF_FILE"
    exit 1
fi

# 检查依赖
check_dependencies

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

echo "=================================================="
echo "Deep Internalizer - PDF OCR 处理"
echo "=================================================="
echo ""
echo "输入文件：$PDF_FILE"
echo "输出目录：$OUTPUT_DIR"
echo ""

# 创建 Python OCR 脚本
OCR_SCRIPT=$(cat << 'PYTHON_SCRIPT'
import sys
import os
from pdf2image import convert_from_path
import pytesseract

def pdf_to_text(pdf_path, output_dir):
    """将 PDF 转换为文本（OCR）"""
    print(f"[OCR] 正在处理：{pdf_path}")

    # 检查文件
    if not os.path.exists(pdf_path):
        print(f"错误：文件不存在：{pdf_path}")
        sys.exit(1)

    # 获取文件信息
    file_size = os.path.getsize(pdf_path) / (1024 * 1024)
    print(f"[OCR] 文件大小：{file_size:.2f} MB")

    # 转换 PDF 为图片
    print("[OCR] 转换 PDF 为图片...")
    try:
        images = convert_from_path(pdf_path, dpi=300)
        print(f"[OCR] 共 {len(images)} 页")
    except Exception as e:
        print(f"[OCR] 转换失败：{e}")
        sys.exit(1)

    # OCR 每页
    full_text = []
    for i, image in enumerate(images):
        print(f"[OCR] 处理第 {i+1}/{len(images)} 页...")

        # 保存临时图片
        temp_image = os.path.join(output_dir, f"page_{i+1}.png")
        image.save(temp_image, 'PNG')

        # 执行 OCR
        text = pytesseract.image_to_string(image, lang='eng+chi_sim')
        full_text.append(f"--- Page {i+1} ---\n{text}")

        # 清理临时图片
        os.remove(temp_image)

    # 输出结果
    output_file = os.path.join(output_dir, f"{os.path.basename(pdf_path)}.txt")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n\n'.join(full_text))

    print("")
    print(f"[OCR] 完成！")
    print(f"[OCR] 输出文件：{output_file}")

    # 返回提取的文本
    return '\n\n'.join(full_text)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法：python ocr.py <pdf_file> [output_dir]")
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else '.'

    result = pdf_to_text(pdf_path, output_dir)
    print("")
    print("=" * 50)
    print("提取的文本预览:")
    print("=" * 50)
    print(result[:1000] + "..." if len(result) > 1000 else result)
PYTHON_SCRIPT
)

# 执行 OCR
echo "执行 OCR 处理..."
python3 -c "$OCR_SCRIPT" "$PDF_FILE" "$OUTPUT_DIR"

echo ""
echo "=================================================="
echo "PDF OCR 处理完成"
echo "=================================================="
echo ""
echo "下一步:"
echo "1. 检查输出文件：$OUTPUT_DIR"
echo "2. 使用 analyzer.sh 分析提取的文本"
echo ""
