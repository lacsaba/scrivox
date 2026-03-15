import threading
from unittest.mock import patch, MagicMock

import numpy as np
import pytest

from app.services.diarization_service import (
    _encoder_cache,
    _load_encoder,
    diarize_segments,
)


@pytest.fixture(autouse=True)
def clear_encoder_cache():
    _encoder_cache.clear()
    yield
    _encoder_cache.clear()


def _make_embedding(speaker_id: int) -> np.ndarray:
    """Create a deterministic 256-dim embedding for a given speaker."""
    rng = np.random.RandomState(speaker_id)
    return rng.randn(256).astype(np.float32)


class TestLoadEncoder:
    def test_caches_encoder(self):
        fake_encoder = MagicMock()
        with patch("app.services.diarization_service.VoiceEncoder", return_value=fake_encoder) as cls:
            result1 = _load_encoder()
            result2 = _load_encoder()
            assert result1 is result2
            cls.assert_called_once()

    def test_thread_safety(self):
        call_count = 0

        def slow_init():
            nonlocal call_count
            call_count += 1
            import time
            time.sleep(0.05)
            return MagicMock()

        with patch("app.services.diarization_service.VoiceEncoder", side_effect=slow_init):
            threads = [threading.Thread(target=_load_encoder) for _ in range(5)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

            assert call_count == 1


class TestDiarizeSegments:
    @pytest.fixture
    def mock_encoder(self):
        encoder = MagicMock()
        return encoder

    @pytest.fixture
    def mock_wav(self):
        """A fake 10-second 16kHz mono wav."""
        return np.zeros(160000, dtype=np.float32)

    def test_empty_segments(self, mock_encoder, mock_wav):
        with patch("app.services.diarization_service._load_encoder", return_value=mock_encoder), \
             patch("app.services.diarization_service.preprocess_wav", return_value=mock_wav):
            result = diarize_segments("test.wav", [])
            assert result == []

    def test_single_segment(self, mock_encoder, mock_wav):
        mock_encoder.embed_utterance.return_value = _make_embedding(1)

        with patch("app.services.diarization_service._load_encoder", return_value=mock_encoder), \
             patch("app.services.diarization_service.preprocess_wav", return_value=mock_wav):
            segments = [{"text": "Hello world", "start": 0.0, "end": 2.0}]
            result = diarize_segments("test.wav", segments)

            assert len(result) == 1
            assert result[0]["speaker"] == 1
            assert result[0]["text"] == "Hello world"

    def test_two_speakers(self, mock_encoder, mock_wav):
        emb_a = _make_embedding(1)
        emb_b = _make_embedding(2)
        # Segments alternate between two speakers
        mock_encoder.embed_utterance.side_effect = [emb_a, emb_b, emb_a, emb_b]

        with patch("app.services.diarization_service._load_encoder", return_value=mock_encoder), \
             patch("app.services.diarization_service.preprocess_wav", return_value=mock_wav):
            segments = [
                {"text": "Hi there", "start": 0.0, "end": 1.5},
                {"text": "Hello", "start": 1.5, "end": 3.0},
                {"text": "How are you", "start": 3.0, "end": 5.0},
                {"text": "Good thanks", "start": 5.0, "end": 7.0},
            ]
            result = diarize_segments("test.wav", segments, num_speakers=2)

            assert len(result) == 4
            speakers = [r["speaker"] for r in result]
            # First speaker should be 1 (ordered by first appearance)
            assert speakers[0] == 1
            assert speakers[1] == 2
            assert speakers[2] == 1
            assert speakers[3] == 2

    def test_auto_detect_speakers(self, mock_encoder, mock_wav):
        emb_a = _make_embedding(10)
        emb_b = _make_embedding(20)
        mock_encoder.embed_utterance.side_effect = [emb_a, emb_b]

        with patch("app.services.diarization_service._load_encoder", return_value=mock_encoder), \
             patch("app.services.diarization_service.preprocess_wav", return_value=mock_wav):
            segments = [
                {"text": "Segment one", "start": 0.0, "end": 2.0},
                {"text": "Segment two", "start": 2.0, "end": 4.0},
            ]
            result = diarize_segments("test.wav", segments)

            assert len(result) == 2
            # Both should have speaker assignments
            assert all("speaker" in r for r in result)

    def test_short_segment_inherits_previous_speaker(self, mock_encoder, mock_wav):
        emb_a = _make_embedding(1)
        # Only two embeddable segments (first and third), second is too short
        mock_encoder.embed_utterance.side_effect = [emb_a, emb_a]

        with patch("app.services.diarization_service._load_encoder", return_value=mock_encoder), \
             patch("app.services.diarization_service.preprocess_wav", return_value=mock_wav), \
             patch("app.services.diarization_service.settings") as mock_settings:
            mock_settings.min_segment_duration_for_embedding = 0.5
            mock_settings.diarization_distance_threshold = 0.75

            segments = [
                {"text": "Long segment", "start": 0.0, "end": 2.0},
                {"text": "Uh", "start": 2.0, "end": 2.3},  # Too short (0.3s < 0.5s)
                {"text": "Another long one", "start": 2.5, "end": 4.0},
            ]
            result = diarize_segments("test.wav", segments)

            assert len(result) == 3
            # Short segment should inherit speaker from previous
            assert result[1]["speaker"] == result[0]["speaker"]

    def test_speaker_labels_ordered_by_first_appearance(self, mock_encoder, mock_wav):
        # Speaker B appears first in the audio
        emb_b = _make_embedding(99)
        emb_a = _make_embedding(1)
        mock_encoder.embed_utterance.side_effect = [emb_b, emb_a, emb_b]

        with patch("app.services.diarization_service._load_encoder", return_value=mock_encoder), \
             patch("app.services.diarization_service.preprocess_wav", return_value=mock_wav):
            segments = [
                {"text": "First", "start": 0.0, "end": 2.0},
                {"text": "Second", "start": 2.0, "end": 4.0},
                {"text": "Third", "start": 4.0, "end": 6.0},
            ]
            result = diarize_segments("test.wav", segments, num_speakers=2)

            # First speaker to appear should be labeled 1
            assert result[0]["speaker"] == 1
            assert result[1]["speaker"] == 2
            assert result[2]["speaker"] == 1
