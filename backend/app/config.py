from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    cors_origins: List[str] = ["http://localhost:5173"]
    default_whisper_model: str = "base"
    allowed_whisper_models: List[str] = ["tiny", "base", "small", "medium", "large"]
    max_upload_size_mb: int = 100
    upload_dir: str = "uploads"
    queue_get_timeout_seconds: int = 600
    job_ttl_minutes: int = 60
    max_concurrent_transcriptions: int = 2
    diarization_distance_threshold: float = 0.75
    min_segment_duration_for_embedding: float = 0.5

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
    