"""
Gesture-Flow DJ Backend
FastAPI server for music generation using Google Lyria RealTime API
Supports multiplayer with YOLO person tracking + MediaPipe hand detection
"""

import os
import asyncio
import base64
import cv2
import numpy as np
from typing import Optional
from contextlib import asynccontextmanager
from io import BytesIO

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from PIL import Image

# Import person tracker
try:
    from person_tracker import get_tracker, PersonTracker
    TRACKER_AVAILABLE = True
    print("[OK] Person tracker module loaded")
except ImportError as e:
    TRACKER_AVAILABLE = False
    print(f"[WARN] Person tracker not available: {e}")

# Load environment variables
try:
    load_dotenv()
except Exception as e:
    print(f"[WARN] Could not load .env file: {e}")

# Google GenAI imports
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
    print("[OK] google-genai package installed")
except ImportError:
    GENAI_AVAILABLE = False
    print("[WARN] google-genai not installed. Running in mock mode.")


# ============================================
# Configuration
# ============================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Debug: Show API key status
if GEMINI_API_KEY:
    masked_key = GEMINI_API_KEY[:8] + "..." + GEMINI_API_KEY[-4:] if len(GEMINI_API_KEY) > 12 else "***"
    print(f"[OK] GEMINI_API_KEY found: {masked_key}")
else:
    print("[ERROR] GEMINI_API_KEY not set! Create a .env file with:")
    print("   GEMINI_API_KEY=your_key_here")
    print("   Or set environment variable before running.")
DEFAULT_BPM = 120
DEFAULT_TEMPERATURE = 1.0


# ============================================
# Pydantic Models
# ============================================

class EvolveTrackRequest(BaseModel):
    base_prompt: str
    modifier_x: float = 0.5  # 0-1, affects complexity
    modifier_y: float = 0.5  # 0-1, affects intensity
    seed: Optional[int] = None
    bpm: int = DEFAULT_BPM


class EvolveTrackResponse(BaseModel):
    success: bool
    prompt_used: str
    audio_url: Optional[str] = None
    message: str


class LyriaConfig(BaseModel):
    bpm: int = DEFAULT_BPM
    temperature: float = DEFAULT_TEMPERATURE
    density: float = 0.5
    brightness: float = 0.5
    guidance: float = 4.0
    scale: str = "SCALE_UNSPECIFIED"


# ============================================
# App Initialization
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup, cleanup on shutdown"""
    print("[START] Starting Gesture-Flow DJ Backend...")
    
    if GENAI_AVAILABLE and GEMINI_API_KEY:
        print("[OK] Google GenAI configured")
    else:
        print("[WARN] Running without Google GenAI (mock mode)")
    
    yield
    
    print("[STOP] Shutting down...")


app = FastAPI(
    title="Gesture-Flow DJ API",
    description="Backend for real-time music generation controlled by hand gestures",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# Helper Functions
# ============================================

def build_enhanced_prompt(base_prompt: str, modifier_x: float, modifier_y: float) -> str:
    """
    Build an enhanced prompt based on hand position modifiers
    
    X axis (0-1): Controls complexity
    - Low (< 0.3): simple, minimal, steady
    - High (> 0.7): complex, syncopated, varied
    
    Y axis (0-1): Controls intensity
    - Low (< 0.3): soft, gentle, ambient
    - High (> 0.7): intense, powerful, energetic
    """
    modifiers = [base_prompt]
    
    # Y axis modifiers (intensity)
    if modifier_y > 0.7:
        modifiers.extend(["intense", "powerful", "energetic", "loud"])
    elif modifier_y > 0.5:
        modifiers.extend(["medium energy", "driving"])
    elif modifier_y < 0.3:
        modifiers.extend(["soft", "gentle", "ambient", "quiet"])
    else:
        modifiers.extend(["moderate", "balanced"])
    
    # X axis modifiers (complexity)
    if modifier_x > 0.7:
        modifiers.extend(["complex", "syncopated", "varied", "intricate"])
    elif modifier_x > 0.5:
        modifiers.extend(["moderately complex"])
    elif modifier_x < 0.3:
        modifiers.extend(["simple", "minimal", "steady", "repetitive"])
    else:
        modifiers.extend(["balanced rhythm"])
    
    return ", ".join(modifiers)


# ============================================
# REST Endpoints
# ============================================

@app.get("/")
async def root():
    return {
        "name": "Gesture-Flow DJ API",
        "version": "1.0.0",
        "status": "running",
        "genai_available": GENAI_AVAILABLE and bool(GEMINI_API_KEY)
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/api/evolve-track", response_model=EvolveTrackResponse)
async def evolve_track(request: EvolveTrackRequest):
    """
    Generate or evolve a music track based on hand position modifiers.
    
    This endpoint builds an enhanced prompt and would trigger Lyria generation.
    For now, returns the prompt that would be used.
    """
    try:
        # Build enhanced prompt
        enhanced_prompt = build_enhanced_prompt(
            request.base_prompt,
            request.modifier_x,
            request.modifier_y
        )
        
        # Log the request
        print(f"[MUSIC] Evolve track request:")
        print(f"   Base: {request.base_prompt}")
        print(f"   Modifiers: X={request.modifier_x:.2f}, Y={request.modifier_y:.2f}")
        print(f"   Enhanced: {enhanced_prompt}")
        print(f"   BPM: {request.bpm}")
        
        # TODO: Actual Lyria generation would happen here
        # For now, return mock response
        
        return EvolveTrackResponse(
            success=True,
            prompt_used=enhanced_prompt,
            audio_url=None,  # Would be actual audio URL
            message="Prompt generated successfully. Audio generation pending."
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# WebSocket for Lyria RealTime
# ============================================

@app.websocket("/ws/lyria")
async def websocket_lyria(websocket: WebSocket):
    """
    WebSocket endpoint for Lyria RealTime streaming.
    
    Protocol:
    - Client sends: { type: "set_prompts", prompts: [...] }
    - Client sends: { type: "set_config", config: {...} }
    - Client sends: { type: "play" | "pause" | "stop" }
    - Server sends: { type: "audio", data: "base64..." }
    - Server sends: { type: "error", error: "..." }
    """
    await websocket.accept()
    client_id = str(id(websocket))
    print(f"[WS] WebSocket connected: {client_id}")
    
    # Check if Lyria is available
    if not GENAI_AVAILABLE or not GEMINI_API_KEY:
        await websocket.send_json({
            "type": "info",
            "message": "Running in mock mode - no real audio generation"
        })
        # Run mock mode loop
        try:
            while True:
                data = await websocket.receive_json()
                msg_type = data.get("type")
                if msg_type == "set_prompts":
                    print(f"[MOCK] Prompts: {data.get('prompts', [])}")
                elif msg_type == "set_config":
                    print(f"[MOCK] Config: {data.get('config', {})}")
                elif msg_type == "play":
                    print("[MOCK] Play")
                elif msg_type == "pause":
                    print("[MOCK] Pause")
                elif msg_type == "stop":
                    print("[MOCK] Stop")
        except WebSocketDisconnect:
            print(f"[WS] WebSocket disconnected: {client_id}")
        return
    
    # Create Lyria client
    client = genai.Client(
        api_key=GEMINI_API_KEY,
        http_options={'api_version': 'v1alpha'}
    )
    
    audio_task = None
    
    try:
        # Use context manager for Lyria session
        async with client.aio.live.music.connect(model='models/lyria-realtime-exp') as session:
            print("[OK] Lyria session created successfully")
            await websocket.send_json({
                "type": "info",
                "message": "Lyria RealTime session created successfully"
            })
            
            async def receive_and_forward_audio():
                """Background task to forward audio from Lyria to WebSocket"""
                try:
                    async for message in session.receive():
                        if hasattr(message, 'server_content') and message.server_content:
                            if hasattr(message.server_content, 'audio_chunks'):
                                for chunk in message.server_content.audio_chunks:
                                    audio_b64 = base64.b64encode(chunk.data).decode('utf-8')
                                    await websocket.send_json({
                                        "type": "audio",
                                        "data": audio_b64
                                    })
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    print(f"Audio receive error: {e}")
            
            # Message handling loop
            while True:
                data = await websocket.receive_json()
                msg_type = data.get("type")
                
                if msg_type == "set_prompts":
                    prompts = data.get("prompts", [])
                    weighted_prompts = [
                        types.WeightedPrompt(text=p["text"], weight=p.get("weight", 1.0))
                        for p in prompts
                    ]
                    await session.set_weighted_prompts(prompts=weighted_prompts)
                    print(f"[PROMPT] Prompts set: {len(prompts)} prompts")
                    
                elif msg_type == "set_config":
                    config = data.get("config", {})
                    lyria_config = types.LiveMusicGenerationConfig(
                        bpm=config.get("bpm", DEFAULT_BPM),
                        temperature=config.get("temperature", DEFAULT_TEMPERATURE),
                        density=config.get("density", 0.5),
                        brightness=config.get("brightness", 0.5),
                        guidance=config.get("guidance", 4.0)
                    )
                    await session.set_music_generation_config(config=lyria_config)
                    print(f"[CONFIG] Config set: bpm={config.get('bpm')}")
                    
                elif msg_type == "play":
                    await session.play()
                    # Start audio forwarding task
                    if not audio_task or audio_task.done():
                        audio_task = asyncio.create_task(receive_and_forward_audio())
                    print("[PLAY] Play started")
                    
                elif msg_type == "pause":
                    await session.pause()
                    print("[PAUSE] Paused")
                    
                elif msg_type == "stop":
                    await session.stop()
                    if audio_task:
                        audio_task.cancel()
                        audio_task = None
                    print("[STOP] Stopped")
                    
    except WebSocketDisconnect:
        print(f"[WS] WebSocket disconnected: {client_id}")
    except Exception as e:
        print(f"[ERROR] WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "error": str(e)})
        except:
            pass
    finally:
        if audio_task:
            audio_task.cancel()


# ============================================
# WebSocket for Multiplayer Tracking
# ============================================

@app.websocket("/ws/tracking")
async def websocket_tracking(websocket: WebSocket):
    """
    WebSocket endpoint for multiplayer hand tracking.
    
    Protocol:
    - Client sends: { type: "frame", data: "base64_jpeg..." }
    - Server sends: { type: "players", players: [...] }
    - Server sends: { type: "error", error: "..." }
    """
    await websocket.accept()
    client_id = str(id(websocket))
    print(f"[TRACKING] Client connected: {client_id}")
    
    if not TRACKER_AVAILABLE:
        await websocket.send_json({
            "type": "error",
            "error": "Person tracking not available. Install ultralytics and mediapipe."
        })
        await websocket.close()
        return
    
    # Get tracker instance
    tracker = get_tracker(max_players=4)
    
    await websocket.send_json({
        "type": "info",
        "message": "Multiplayer tracking ready. Send frames to begin."
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "frame":
                try:
                    # Decode base64 JPEG image
                    img_data = base64.b64decode(data.get("data", ""))
                    
                    # Convert to numpy array
                    nparr = np.frombuffer(img_data, np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                    
                    if frame is None:
                        continue
                    
                    # Process frame
                    players = tracker.process_frame(frame)
                    
                    # Send results
                    await websocket.send_json({
                        "type": "players",
                        "players": players
                    })
                    
                except Exception as e:
                    print(f"[TRACKING] Frame processing error: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "error": str(e)
                    })
            
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        print(f"[TRACKING] Client disconnected: {client_id}")
    except Exception as e:
        print(f"[TRACKING] Error: {e}")
    finally:
        tracker.cleanup()


# ============================================
# Sample Audio Endpoints (for testing)
# ============================================

@app.get("/api/samples")
async def list_samples():
    """List available sample audio files for testing"""
    # In production, this would list actual generated samples
    return {
        "samples": [
            {"id": "drums", "name": "Drums Loop", "url": "/static/samples/drums.mp3"},
            {"id": "bass", "name": "Bass Loop", "url": "/static/samples/bass.mp3"},
            {"id": "synth", "name": "Synth Pad", "url": "/static/samples/synth.mp3"},
            {"id": "fx", "name": "FX Riser", "url": "/static/samples/fx.mp3"},
            {"id": "melody", "name": "Melody", "url": "/static/samples/melody.mp3"},
        ]
    }


@app.get("/api/tracking/status")
async def tracking_status():
    """Check if multiplayer tracking is available"""
    return {
        "available": TRACKER_AVAILABLE,
        "message": "Multiplayer tracking ready" if TRACKER_AVAILABLE else "Install ultralytics and mediapipe"
    }


# ============================================
# Run with: uvicorn main:app --reload --port 8000
# ============================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
