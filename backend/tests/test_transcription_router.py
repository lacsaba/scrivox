import asyncio
import io
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient


class TestTranscribeEndpoint:
    @pytest.mark.asyncio
    async def test_upload_returns_202(self, client, sample_audio_bytes):
        response = await client.post(
            "/api/v1/transcribe",
            files={"file": ("test.wav", io.BytesIO(sample_audio_bytes), "audio/wav")},
            data={"model": "base"},
        )
        assert response.status_code == 202
        body = response.json()
        assert "job_id" in body
        assert body["status"] == "pending"

    @pytest.mark.asyncio
    async def test_invalid_model_rejected(self, client, sample_audio_bytes):
        response = await client.post(
            "/api/v1/transcribe",
            files={"file": ("test.wav", io.BytesIO(sample_audio_bytes), "audio/wav")},
            data={"model": "nonexistent"},
        )
        assert response.status_code == 400
        assert "nonexistent" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_unsupported_file_type_rejected(self, client, sample_audio_bytes):
        response = await client.post(
            "/api/v1/transcribe",
            files={"file": ("test.txt", io.BytesIO(sample_audio_bytes), "text/plain")},
            data={"model": "base"},
        )
        assert response.status_code == 400
        assert "Unsupported file type" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_file_too_large_rejected(self, client):
        from app.config import settings
        too_big = b"\x00" * (settings.max_upload_size_mb * 1024 * 1024 + 1)
        response = await client.post(
            "/api/v1/transcribe",
            files={"file": ("test.wav", io.BytesIO(too_big), "audio/wav")},
            data={"model": "base"},
        )
        assert response.status_code == 413

    @pytest.mark.asyncio
    async def test_default_model_is_base(self, client, sample_audio_bytes):
        response = await client.post(
            "/api/v1/transcribe",
            files={"file": ("test.mp3", io.BytesIO(sample_audio_bytes), "audio/mpeg")},
        )
        assert response.status_code == 202

    @pytest.mark.asyncio
    async def test_all_audio_extensions_accepted(self, client, sample_audio_bytes):
        extensions = [".m4a", ".wav", ".mp3", ".ogg", ".flac", ".webm", ".mp4", ".aac"]
        for ext in extensions:
            response = await client.post(
                "/api/v1/transcribe",
                files={"file": (f"test{ext}", io.BytesIO(sample_audio_bytes), "audio/octet-stream")},
                data={"model": "base"},
            )
            assert response.status_code == 202, f"Extension {ext} should be accepted"

    @pytest.mark.asyncio
    async def test_upload_with_diarize_flag(self, client, sample_audio_bytes):
        response = await client.post(
            "/api/v1/transcribe",
            files={"file": ("test.wav", io.BytesIO(sample_audio_bytes), "audio/wav")},
            data={"model": "base", "diarize": "true"},
        )
        assert response.status_code == 202
        body = response.json()
        assert body["diarize_requested"] is True

    @pytest.mark.asyncio
    async def test_num_speakers_validation(self, client, sample_audio_bytes):
        response = await client.post(
            "/api/v1/transcribe",
            files={"file": ("test.wav", io.BytesIO(sample_audio_bytes), "audio/wav")},
            data={"model": "base", "diarize": "true", "num_speakers": "1"},
        )
        assert response.status_code == 400
        assert "num_speakers must be at least 2" in response.json()["detail"]


class TestGetJobEndpoint:
    @pytest.mark.asyncio
    async def test_get_existing_job(self, client, sample_audio_bytes):
        # Create a job first
        create_resp = await client.post(
            "/api/v1/transcribe",
            files={"file": ("test.wav", io.BytesIO(sample_audio_bytes), "audio/wav")},
            data={"model": "base"},
        )
        job_id = create_resp.json()["job_id"]

        response = await client.get(f"/api/v1/jobs/{job_id}")
        assert response.status_code == 200
        assert response.json()["job_id"] == job_id

    @pytest.mark.asyncio
    async def test_get_nonexistent_job_returns_404(self, client):
        response = await client.get("/api/v1/jobs/nonexistent-id")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_job_completes_after_processing(self, client, sample_audio_bytes):
        create_resp = await client.post(
            "/api/v1/transcribe",
            files={"file": ("test.wav", io.BytesIO(sample_audio_bytes), "audio/wav")},
            data={"model": "base"},
        )
        job_id = create_resp.json()["job_id"]

        # Poll until the background task finishes (mocked whisper is instant)
        for _ in range(20):
            await asyncio.sleep(0.1)
            resp = await client.get(f"/api/v1/jobs/{job_id}")
            data = resp.json()
            if data["status"] in ("done", "error"):
                break

        assert data["status"] == "done"
        assert "Hello world" in data["transcript"]
        assert "This is a test" in data["transcript"]
        assert data["duration_seconds"] == 3.0
        assert data["model_used"] == "base"

    @pytest.mark.asyncio
    async def test_diarization_end_to_end(self, client, _patch_resemblyzer, sample_audio_bytes):
        create_resp = await client.post(
            "/api/v1/transcribe",
            files={"file": ("test.wav", io.BytesIO(sample_audio_bytes), "audio/wav")},
            data={"model": "base", "diarize": "true", "num_speakers": "2"},
        )
        assert create_resp.status_code == 202
        job_id = create_resp.json()["job_id"]

        for _ in range(30):
            await asyncio.sleep(0.1)
            resp = await client.get(f"/api/v1/jobs/{job_id}")
            data = resp.json()
            if data["status"] in ("done", "error"):
                break

        assert data["status"] == "done"
        assert data["diarize_requested"] is True
        assert data["segments"] is not None
        assert len(data["segments"]) == 2
        assert "Speaker" in data["transcript"]

    @pytest.mark.asyncio
    async def test_diarization_failure_preserves_transcript(self, client, sample_audio_bytes):
        """When diarization fails, transcript should still be available."""
        with patch(
            "app.routers.transcription.diarize_segments",
            side_effect=RuntimeError("encoder crashed"),
        ):
            create_resp = await client.post(
                "/api/v1/transcribe",
                files={"file": ("test.wav", io.BytesIO(sample_audio_bytes), "audio/wav")},
                data={"model": "base", "diarize": "true"},
            )
            job_id = create_resp.json()["job_id"]

            for _ in range(30):
                await asyncio.sleep(0.1)
                resp = await client.get(f"/api/v1/jobs/{job_id}")
                data = resp.json()
                if data["status"] in ("done", "error"):
                    break

            assert data["status"] == "done"
            assert "Hello world" in data["transcript"]
            assert data["diarize_error"] is not None
            assert "encoder crashed" in data["diarize_error"]
            assert data["segments"] is None


class TestTTSEndpoint:
    @pytest.mark.asyncio
    async def test_tts_returns_501(self, client):
        response = await client.post("/api/v1/tts")
        assert response.status_code == 501
        assert "not yet implemented" in response.json()["detail"].lower()
