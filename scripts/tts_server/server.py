"""
Local Kokoro-TTS Server
OpenAI-compatible API endpoint for text-to-speech synthesis
Uses the high-quality, lightweight Kokoro model for natural speech
"""

import os
import io
import uvicorn
import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Local Kokoro-TTS API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model holder
tts_model = None
SAMPLE_RATE = 24000

# Voice presets (Qwen3-TTS uses voice descriptions)
# Voice presets for Kokoro
# List available voices: af_heart, am_fenix, am_michael, etc.
VOICE_PRESETS = {
    "default": "af_heart",    # American Female (Heart)
    "female": "af_bella",     # American Female (Bella)
    "male": "am_michael",     # American Male (Michael)
    "narrator": "af_sky",     # American Female (Sky)
    "energetic": "af_nicole",  # American Female (Nicole)
}


def load_model():
    """Load Kokoro-TTS model using KPipeline"""
    global tts_model
    
    try:
        from kokoro import KPipeline
        import torch
        
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        print(f"Loading Kokoro-TTS on {device}...")
        
        # Initialize pipeline (lang='a' for American English)
        tts_model = KPipeline(lang_code='a', device=device)
        
        print("✓ Kokoro-TTS pipeline initialized successfully")
        
    except Exception as e:
        print(f"⚠ Failed to load Kokoro-TTS: {e}")
        import traceback
        traceback.print_exc()


# Removed transformers fallback for Kokoro


@app.on_event("startup")
async def startup_event():
    load_model()


class SpeechRequest(BaseModel):
    model: str = "kokoro"
    input: str
    voice: Optional[str] = "default"
    response_format: Optional[str] = "wav"
    speed: Optional[float] = 1.0


@app.post("/v1/audio/speech")
async def generate_speech(request: SpeechRequest):
    """OpenAI-compatible speech generation endpoint"""
    
    if not request.input or not request.input.strip():
        raise HTTPException(status_code=400, detail="Input text is required")
    
    text = request.input.strip()
    print(f"Generating audio for: {text[:80]}{'...' if len(text) > 80 else ''}")
    
    # Get voice description
    voice_desc = VOICE_PRESETS.get(request.voice, VOICE_PRESETS["default"])
    
    if tts_model is None:
        # Fallback: generate silence if model not loaded
        print("⚠ Model not loaded, returning silence")
        audio_data = np.zeros(int(SAMPLE_RATE * 0.5), dtype=np.float32)
    else:
        try:
            # Kokoro generation
            # Returns a generator of (gs, ps, audio)
            generator = tts_model(
                text, 
                voice=voice_desc, 
                speed=request.speed or 1.0, 
                split_pattern=r'\n+'
            )
            
            # For simplicity, we take the first/merged audio if it's short
            # In a real app we might stream parts, but for single words/sentences we just collect
            audios = []
            for gs, ps, audio in generator:
                audios.append(audio)
            
            if not audios:
                raise ValueError("No audio generated")
                
            audio_data = np.concatenate(audios)
                
        except Exception as e:
            print(f"TTS generation error: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))
    
    # Convert to WAV in memory
    buffer = io.BytesIO()
    
    # Ensure audio is numpy array
    if hasattr(audio_data, 'numpy'):
        audio_data = audio_data.numpy()
    
    audio_data = np.array(audio_data, dtype=np.float32)
    
    sf.write(buffer, audio_data, SAMPLE_RATE, format='WAV', subtype='PCM_16')
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="audio/wav",
        headers={"Content-Disposition": "inline; filename=speech.wav"}
    )


# Removed transformers helper


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "model": "Kokoro-82M",
        "model_loaded": tts_model is not None,
        "available_voices": list(VOICE_PRESETS.keys())
    }


@app.get("/v1/voices")
async def list_voices():
    """List available voice presets"""
    return {
        "voices": [
            {"id": k, "description": v} 
            for k, v in VOICE_PRESETS.items()
        ]
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
