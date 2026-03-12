from abc import ABC, abstractmethod


class AudioProcessingService(ABC):
    @abstractmethod
    async def process(self, file_path: str, **kwargs) -> dict:
        """Process an audio file and return results as a dict."""
        ...
