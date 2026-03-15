import asyncio
import logging
import threading
from typing import Dict, Any
from app.services.base_service import AudioProcessingService

logger = logging.getLogger(__name__)

_model_cache: Dict[str, Any] = {}
_model_lock = threading.Lock()
PARAGRAPH_PAUSE_SECONDS = 1.5


def _load_model(model_name: str):
    from faster_whisper import WhisperModel
    with _model_lock:
        if model_name not in _model_cache:
            logger.info("Loading Whisper model '%s'...", model_name)
            _model_cache[model_name] = WhisperModel(model_name, device="cpu", compute_type="int8")
            logger.info("Whisper model '%s' loaded.", model_name)
        return _model_cache[model_name]


def transcribe_to_queue(
    file_path: str,
    model_name: str,
    queue: asyncio.Queue,
    loop: asyncio.AbstractEventLoop,
) -> None:
    """Run transcription synchronously in a thread, pushing events into an asyncio queue."""
    try:
        model = _load_model(model_name)
        logger.info("Transcription started: file=%s model=%s", file_path, model_name)
        segments, info = model.transcribe(file_path)
        prev_end: float | None = None
        for seg in segments:
            text = seg.text.strip()
            if text:
                gap = seg.start - prev_end if prev_end is not None else None
                loop.call_soon_threadsafe(queue.put_nowait, ("segment", text, gap, seg.start, seg.end))
                prev_end = seg.end
        loop.call_soon_threadsafe(queue.put_nowait, ("done", info.duration))
        logger.info("Transcription completed: file=%s", file_path)
    except Exception as exc:
        logger.error("Transcription failed: file=%s error=%s", file_path, exc)
        loop.call_soon_threadsafe(queue.put_nowait, ("error", str(exc)))


class WhisperService(AudioProcessingService):
    async def process(self, file_path: str, **kwargs) -> dict:
        model_name = kwargs.get("model", "base")
        queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_running_loop()
        threading.Thread(
            target=transcribe_to_queue,
            args=(file_path, model_name, queue, loop),
            daemon=True,
        ).start()
        parts: list[str] = []
        while True:
            item = await queue.get()
            if item[0] == "segment":
                _, text, gap, _start, _end = item
                if parts:
                    parts.append("\n\n" if gap is not None and gap >= PARAGRAPH_PAUSE_SECONDS else " ")
                parts.append(text)
            elif item[0] == "done":
                return {"transcript": "".join(parts), "duration_seconds": item[1]}
            else:
                raise Exception(item[1])


whisper_service = WhisperService()
