#!/bin/bash
set -e

# Navigate to script directory
cd "$(dirname "$0")/tts_server"

echo "Setting up Qwen3-TTS backend..."

# Prefer an existing Python 3.11 env (kokoro/onnxruntime compatibility)
if [ -d "venv311" ]; then
    VENV_DIR="venv311"
else
    VENV_DIR="venv"
fi

# Create venv if missing (prefer python3.11 when available)
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment: $VENV_DIR"
    if command -v python3.11 >/dev/null 2>&1; then
        python3.11 -m venv "$VENV_DIR"
    else
        python3 -m venv "$VENV_DIR"
    fi
fi

# Activate venv
source "$VENV_DIR/bin/activate"

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Start server
echo "Starting TTS server on port 8000..."
python server.py
