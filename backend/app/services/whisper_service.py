import asyncio
from typing import Dict, Any
from app.services.base_service import AudioProcessingService

_model_cache: Dict[str, Any] = {}


def _load_model(model_name: str):
    from faster_whisper import WhisperModel
    if model_name not in _model_cache:
        _model_cache[model_name] = WhisperModel(model_name, device="cpu", compute_type="int8")
    return _model_cache[model_name]


def _transcribe(file_path: str, model_name: str) -> dict:
    model = _load_model(model_name)
    segments, info = model.transcribe(file_path)
    transcript = " ".join(segment.text.strip() for segment in segments)
    return {
        "transcript": transcript,
        "duration_seconds": info.duration,
    }


class WhisperService(AudioProcessingService):
    async def process(self, file_path: str, **kwargs) -> dict:
        model_name = kwargs.get("model", "base")
        result = await asyncio.to_thread(_transcribe, file_path, model_name)
        return result


whisper_service = WhisperService()
