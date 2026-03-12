import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import transcription, tts


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Preload default Whisper model on startup so first request isn't slow
    try:
        from app.services.whisper_service import _load_model
        print(f"Preloading Whisper model '{settings.default_whisper_model}'...")
        await asyncio.to_thread(_load_model, settings.default_whisper_model)
        print(f"Whisper model '{settings.default_whisper_model}' loaded.")
    except Exception as e:
        print(f"Warning: Could not preload Whisper model: {e}")
    yield


app = FastAPI(title="Speech-to-Text API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcription.router, prefix="/api/v1")
app.include_router(tts.router, prefix="/api/v1")
