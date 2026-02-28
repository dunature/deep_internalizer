#!/bin/bash
# Deep Internalizer - JSON Export Generator
# Generates JSON output compatible with Deep Internalizer import
# Fixed: Uses jq for proper JSON escaping

set -e

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed." >&2
    echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)" >&2
    exit 1
fi

# Input parameters
TASK_ID="${1:-$(uuidgen 2>/dev/null || echo "task-$(date +%s)")}"
TITLE="$2"
URL="$3"
CONTENT_HASH="${4:-hash-$(date +%s)}"
MODEL="${5:-glm-4.7}"
THESIS="$6"
OUTLINE="$7"
CHUNKS_JSON="${8:-[]}"
VOCAB_JSON="${9:-[]}"
SENTENCES_JSON="${10:-[]}"

# Generate timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Default values
MODEL=${MODEL:-"glm-4.7"}

# Create summary from thesis and outline
SUMMARY="${THESIS}

Key Points:
${OUTLINE}"

# Use jq for proper JSON generation and escaping
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
  --arg thesis "$THESIS" \
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
      summary: ($thesis + "\n\nKey Points:\n" + $outline),
      chunks: $chunks,
      vocabulary: $vocabulary,
      sentences: $sentences
    },
    schemaVersion: "1.0.0"
  }'
