/**
 * Service to handle Text-to-Speech via local Qwen3-TTS API
 */

// Default to local server if env not set
const API_URL = import.meta.env.VITE_TTS_API_URL || 'http://localhost:8000/v1/audio/speech';

class TTSService {
    async generateAudio(text, voice = 'default') {
        try {
            console.log('Generating audio for:', text);
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'qwen3-tts',
                    input: text,
                    voice: voice,
                    response_format: 'wav' // Request WAV for better compatibility
                })
            });

            if (!response.ok) {
                throw new Error(`TTS API Error: ${response.statusText}`);
            }

            const blob = await response.blob();
            return window.URL.createObjectURL(blob);
        } catch (error) {
            console.error('TTS Generation failed:', error);
            throw error;
        }
    }
}

export const ttsService = new TTSService();
