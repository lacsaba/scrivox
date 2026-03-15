from app.config import Settings


class TestSettings:
    def test_defaults(self):
        s = Settings()
        assert s.default_whisper_model == "base"
        assert s.max_upload_size_mb == 100
        assert s.upload_dir == "uploads"
        assert "base" in s.allowed_whisper_models
        assert s.queue_get_timeout_seconds == 600
        assert s.job_ttl_minutes == 60
        assert s.max_concurrent_transcriptions == 2

    def test_cors_origins_default(self):
        s = Settings()
        assert "http://localhost:5173" in s.cors_origins

    def test_all_whisper_models_present(self):
        s = Settings()
        assert s.allowed_whisper_models == ["tiny", "base", "small", "medium", "large"]
