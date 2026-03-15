from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    cors_origins: List[str] = ["http://localhost:5173"]
    default_whisper_model: str = "base"
    allowed_whisper_models: List[str] = ["tiny", "base", "small", "medium", "large"]
    max_upload_size_mb: int = 100
    upload_dir: str = "uploads"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
