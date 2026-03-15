import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import transcription, tts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Preload default Whisper model on startup so first request isn't slow
    try:
        from app.services.whisper_service import _load_model
        logger.info("Preloading Whisper model '%s'...", settings.default_whisper_model)
        await asyncio.to_thread(_load_model, settings.default_whisper_model)
        logger.info("Whisper model '%s' loaded.", settings.default_whisper_model)
    except Exception as e:
        logger.warning("Could not preload Whisper model: %s", e)
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
