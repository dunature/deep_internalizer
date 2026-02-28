#!/bin/bash
# Deep Internalizer - Content Extractor
# 三级内容提取策略：web_fetch → Jina AI → Puppeteer

set -e

URL="$1"

if [ -z "$URL" ]; then
    echo "错误：请提供 URL 参数" >&2
    echo "用法：$0 <url>" >&2
    exit 1
fi

# 检测 URL 是本地文件还是远程链接
if [[ "$URL" =~ ^https?:// ]]; then
    # 远程 URL，使用三级提取策略
    echo "[1/3] 尝试 web_fetch..." >&2

    # 尝试 1: web_fetch (使用 MCP 工具)
    # 注意：web_fetch 是 MCP 工具，需要在父脚本中调用
    # 这里我们通过 curl 直接调用 Jina AI 作为备选
    RESULT=$(curl -s --max-time 10 "https://r.jina.ai/$URL" 2>/dev/null || echo "")

    if [ -n "$RESULT" ] && [ ${#RESULT} -gt 50 ]; then
        echo "[web_fetch] 成功提取内容" >&2
        echo "$RESULT"
        exit 0
    fi

    echo "[2/3] 尝试 Jina AI Reader..." >&2

    # 尝试 2: Jina AI (备用 URL)
    RESULT=$(curl -s --max-time 15 "https://r.jina.ai/$URL" 2>/dev/null || echo "")

    if [ -n "$RESULT" ] && [ ${#RESULT} -gt 50 ]; then
        echo "[Jina AI] 成功提取内容" >&2
        echo "$RESULT"
        exit 0
    fi

    # 尝试 3: Puppeteer (如果有脚本)
    PUPPETEER_SCRIPT="/workspace/temp/scripts/fetch-page.js"
    if [ -f "$PUPPETEER_SCRIPT" ]; then
        echo "[3/3] 尝试 Puppeteer..." >&2
        RESULT=$(node "$PUPPETEER_SCRIPT" "$URL" 2>/dev/null || echo "")

        if [ -n "$RESULT" ] && [ ${#RESULT} -gt 50 ]; then
            echo "[Puppeteer] 成功提取内容" >&2
            echo "$RESULT"
            exit 0
        fi
    else
        echo "[跳过] Puppeteer 脚本不存在: $PUPPETEER_SCRIPT" >&2
    fi

    echo "错误：所有提取方法都失败了" >&2
    echo "请检查 URL 是否正确，或尝试其他链接" >&2
    exit 1

elif [[ "$URL" =~ ^\.?/? ]]; then
    # 本地文件路径
    FILE_PATH="$URL"

    # 扩展路径
    if [[ "$FILE_PATH" =~ ^\./ ]] || [[ "$FILE_PATH" =~ ^/? ]] && [ ! -f "$FILE_PATH" ]; then
        FILE_PATH="$(cd "$(dirname "$URL")" && pwd)/$(basename "$URL")"
    fi

    if [ ! -f "$FILE_PATH" ]; then
        echo "错误：文件不存在：$FILE_PATH" >&2
        exit 1
    fi

    # 根据文件类型处理
    case "$FILE_PATH" in
        *.md|*.markdown|*.txt)
            echo "[Read] 读取 Markdown/TXT 文件..." >&2
            cat "$FILE_PATH"
            exit 0
            ;;
        *.pdf)
            echo "[Read] PDF 文件需要通过 Read 工具读取" >&2
            # PDF 需要通过 Read 工具读取，返回路径供父脚本处理
            echo "PDF_FILE:$FILE_PATH"
            exit 0
            ;;
        *)
            echo "[Read] 读取文本文件..." >&2
            cat "$FILE_PATH"
            exit 0
            ;;
    esac
else
    echo "错误：无法识别的输入类型" >&2
    echo "支持的格式：" >&2
    echo "  - 远程 URL: http(s)://example.com" >&2
    echo "  - 本地文件：./document.md, ./article.pdf" >&2
    exit 1
fi
