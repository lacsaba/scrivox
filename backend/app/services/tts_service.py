from app.services.base_service import AudioProcessingService


class TtsService(AudioProcessingService):
    async def process(self, file_path: str, **kwargs) -> dict:
        raise NotImplementedError("TTS service is not yet implemented.")


tts_service = TtsService()
