import asyncio
from unittest.mock import patch, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.models.job import JobResult, JobStatus
from datetime import datetime, timezone


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def mock_whisper_model():
    """A fake WhisperModel that yields deterministic segments."""
    model = MagicMock()

    seg1 = MagicMock()
    seg1.text = " Hello world"
    seg1.start = 0.0
    seg1.end = 1.5

    seg2 = MagicMock()
    seg2.text = " This is a test"
    seg2.start = 1.6
    seg2.end = 3.0

    info = MagicMock()
    info.duration = 3.0

    model.transcribe.return_value = ([seg1, seg2], info)
    return model


@pytest.fixture
def _patch_whisper(mock_whisper_model):
    """Patch _load_model globally so no real model is loaded."""
    with patch("app.services.whisper_service._load_model", return_value=mock_whisper_model):
        yield mock_whisper_model


@pytest.fixture
async def client(_patch_whisper):
    """AsyncClient wired to the FastAPI app with Whisper mocked out."""
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def sample_job() -> JobResult:
    return JobResult(
        job_id="test-job-1",
        status=JobStatus.PENDING,
        created_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def sample_audio_bytes() -> bytes:
    """Minimal valid bytes to simulate an audio upload (content doesn't matter for mocked whisper)."""
    return b"\x00" * 1024
