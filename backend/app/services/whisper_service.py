import asyncio
from typing import Dict, Any
from app.services.base_service import AudioProcessingService

_model_cache: Dict[str, Any] = {}


def _load_model(model_name: str):
    from faster_whisper import WhisperModel
    if model_name not in _model_cache:
        _model_cache[model_name] = WhisperModel(model_name, device="cpu", compute_type="int8")
    return _model_cache[model_name]


PARAGRAPH_PAUSE_SECONDS = 1.5


def _transcribe(file_path: str, model_name: str) -> dict:
    model = _load_model(model_name)
    segments, info = model.transcribe(file_path)
    segments = list(segments)

    parts: list[str] = []
    for i, seg in enumerate(segments):
        text = seg.text.strip()
        if not text:
            continue
        if parts and i > 0:
            gap = seg.start - segments[i - 1].end
            separator = "\n\n" if gap >= PARAGRAPH_PAUSE_SECONDS else " "
            parts.append(separator)
        parts.append(text)

    return {
        "transcript": "".join(parts),
        "duration_seconds": info.duration,
    }


class WhisperService(AudioProcessingService):
    async def process(self, file_path: str, **kwargs) -> dict:
        model_name = kwargs.get("model", "base")
        result = await asyncio.to_thread(_transcribe, file_path, model_name)
        return result


whisper_service = WhisperService()
