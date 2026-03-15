import asyncio
import threading
from unittest.mock import patch, MagicMock

import pytest

from app.services.whisper_service import (
    _load_model,
    _model_cache,
    transcribe_to_queue,
    PARAGRAPH_PAUSE_SECONDS,
)


@pytest.fixture(autouse=True)
def clear_model_cache():
    _model_cache.clear()
    yield
    _model_cache.clear()


class TestLoadModel:
    def test_caches_model(self):
        fake_model = MagicMock()
        with patch("faster_whisper.WhisperModel", return_value=fake_model) as cls:
            result1 = _load_model("base")
            result2 = _load_model("base")
            assert result1 is result2
            cls.assert_called_once_with("base", device="cpu", compute_type="int8")

    def test_different_models_cached_separately(self):
        models = {}

        def make_model(name, **kwargs):
            m = MagicMock()
            m.name = name
            models[name] = m
            return m

        with patch("faster_whisper.WhisperModel", side_effect=make_model):
            _load_model("tiny")
            _load_model("base")
            assert len(_model_cache) == 2
            assert "tiny" in _model_cache
            assert "base" in _model_cache

    def test_thread_safety(self):
        """Multiple threads loading the same model should only create it once."""
        call_count = 0

        def slow_init(name, **kwargs):
            nonlocal call_count
            call_count += 1
            import time
            time.sleep(0.05)
            return MagicMock()

        with patch("faster_whisper.WhisperModel", side_effect=slow_init):
            threads = [threading.Thread(target=_load_model, args=("base",)) for _ in range(5)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

            assert call_count == 1


async def _drain_loop():
    """Give the event loop a chance to process call_soon_threadsafe callbacks."""
    for _ in range(10):
        await asyncio.sleep(0)


class TestTranscribeToQueue:
    @pytest.mark.asyncio
    async def test_produces_segments_and_done(self, mock_whisper_model):
        queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        with patch("app.services.whisper_service._load_model", return_value=mock_whisper_model):
            thread = threading.Thread(
                target=transcribe_to_queue,
                args=("test.wav", "base", queue, loop),
                daemon=True,
            )
            thread.start()
            thread.join(timeout=5)

        await _drain_loop()

        items = []
        while not queue.empty():
            items.append(queue.get_nowait())

        segment_items = [i for i in items if i[0] == "segment"]
        done_items = [i for i in items if i[0] == "done"]

        assert len(segment_items) == 2
        assert segment_items[0][1] == "Hello world"
        assert segment_items[0][3] == 0.0  # start
        assert segment_items[0][4] == 1.5  # end
        assert segment_items[1][1] == "This is a test"
        assert segment_items[1][3] == 1.6  # start
        assert segment_items[1][4] == 3.0  # end
        assert len(done_items) == 1
        assert done_items[0][1] == 3.0

    @pytest.mark.asyncio
    async def test_gap_tracking(self, mock_whisper_model):
        queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        with patch("app.services.whisper_service._load_model", return_value=mock_whisper_model):
            thread = threading.Thread(
                target=transcribe_to_queue,
                args=("test.wav", "base", queue, loop),
                daemon=True,
            )
            thread.start()
            thread.join(timeout=5)

        await _drain_loop()

        items = []
        while not queue.empty():
            items.append(queue.get_nowait())

        seg1 = items[0]
        seg2 = items[1]
        # First segment has no gap (None)
        assert seg1[2] is None
        # Second segment gap = 1.6 - 1.5 = 0.1
        assert seg2[2] == pytest.approx(0.1, abs=0.01)

    @pytest.mark.asyncio
    async def test_error_pushed_on_exception(self):
        bad_model = MagicMock()
        bad_model.transcribe.side_effect = RuntimeError("model crashed")

        queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        with patch("app.services.whisper_service._load_model", return_value=bad_model):
            thread = threading.Thread(
                target=transcribe_to_queue,
                args=("test.wav", "base", queue, loop),
                daemon=True,
            )
            thread.start()
            thread.join(timeout=5)

        await _drain_loop()

        item = queue.get_nowait()
        assert item[0] == "error"
        assert "model crashed" in item[1]

    @pytest.mark.asyncio
    async def test_paragraph_detection_with_large_gap(self):
        model = MagicMock()
        seg1 = MagicMock(text=" Part one", start=0.0, end=2.0)
        seg2 = MagicMock(text=" Part two", start=5.0, end=7.0)  # gap of 3.0s
        info = MagicMock(duration=7.0)
        model.transcribe.return_value = ([seg1, seg2], info)

        queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        with patch("app.services.whisper_service._load_model", return_value=model):
            thread = threading.Thread(
                target=transcribe_to_queue,
                args=("test.wav", "base", queue, loop),
                daemon=True,
            )
            thread.start()
            thread.join(timeout=5)

        await _drain_loop()

        items = []
        while not queue.empty():
            items.append(queue.get_nowait())

        seg2_item = items[1]
        # gap of 3.0 should be >= PARAGRAPH_PAUSE_SECONDS (1.5)
        assert seg2_item[2] >= PARAGRAPH_PAUSE_SECONDS
