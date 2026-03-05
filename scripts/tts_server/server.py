"""
Local Kokoro-TTS Server
OpenAI-compatible API endpoint for text-to-speech synthesis
Uses the high-quality, lightweight Kokoro model for natural speech
"""

import os
import io
import asyncio
import uvicorn
import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Local Kokoro-TTS API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://10.33.141.236:5173",
        "http://198.18.0.1:5173",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.options("/v1/audio/speech")
async def speech_preflight(request: Request):
    """Handle non-standard preflight variants that CORSMiddleware may not classify."""
    origin = request.headers.get("origin", "*")
    acr_headers = request.headers.get("access-control-request-headers", "content-type")
    return Response(
        status_code=204,
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": acr_headers,
            "Access-Control-Max-Age": "600",
            "Vary": "Origin",
        },
    )

# Global model holder
tts_model = None
tss_model_error = None
tts_model_loading = False
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
    global tts_model, tss_model_error
    
    try:
        from kokoro import KPipeline
        import torch
        
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        print(f"Loading Kokoro-TTS on {device}...")
        
        # Initialize pipeline (lang='a' for American English)
        tts_model = KPipeline(lang_code='a', device=device)
        
        print("✓ Kokoro-TTS pipeline initialized successfully")
        tss_model_error = None
        
    except Exception as e:
        print(f"⚠ Failed to load Kokoro-TTS: {e}")
        tss_model_error = str(e)
        import traceback
        traceback.print_exc()


# Removed transformers fallback for Kokoro


@app.on_event("startup")
async def startup_event():
    global tts_model_loading
    tts_model_loading = True

    async def _load_in_background():
        global tts_model_loading
        try:
            await asyncio.to_thread(load_model)
        finally:
            tts_model_loading = False

    # Keep API responsive while model initializes.
    asyncio.create_task(_load_in_background())


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
        if tts_model_loading:
            raise HTTPException(status_code=503, detail="TTS model is still loading")
        if tss_model_error:
            raise HTTPException(status_code=500, detail=f"TTS model load failed: {tss_model_error}")
        raise HTTPException(status_code=503, detail="TTS model is not ready")
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
        "model_loading": tts_model_loading,
        "model_error": tss_model_error,
        "available_voices": list(VOICE_PRESETS.keys())
    }


@app.get("/v1/models")
async def list_models():
    """OpenAI-compatible models endpoint for client-side health checks."""
    return {
        "object": "list",
        "data": [
            {
                "id": "kokoro",
                "object": "model",
                "owned_by": "local",
                "ready": tts_model is not None,
                "loading": tts_model_loading,
            }
        ]
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
