#!/bin/bash
set -e

# Navigate to script directory
cd "$(dirname "$0")/tts_server"

echo "Setting up Qwen3-TTS backend..."

# Create venv if not exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Start server
echo "Starting TTS server on port 8000..."
python server.py
