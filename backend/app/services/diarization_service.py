import logging
import threading
from typing import Optional

import numpy as np
from resemblyzer import VoiceEncoder, preprocess_wav
from sklearn.cluster import AgglomerativeClustering

from app.config import settings

logger = logging.getLogger(__name__)

_encoder_cache = {}
_encoder_lock = threading.Lock()


def _load_encoder():
    with _encoder_lock:
        if "default" not in _encoder_cache:
            logger.info("Loading Resemblyzer voice encoder...")
            _encoder_cache["default"] = VoiceEncoder()
            logger.info("Resemblyzer voice encoder loaded.")
        return _encoder_cache["default"]


def diarize_segments(
    file_path: str,
    segments: list[dict],
    num_speakers: Optional[int] = None,
) -> list[dict]:
    """
    Assign speaker labels to transcription segments using Resemblyzer embeddings
    and AgglomerativeClustering.

    Each segment dict must have: text, start, end.
    Returns enriched dicts with speaker (int, 1-based) added.
    """
    if len(segments) == 0:
        return []

    encoder = _load_encoder()
    wav = preprocess_wav(file_path)
    sample_rate = 16000  # resemblyzer always resamples to 16kHz

    min_dur = settings.min_segment_duration_for_embedding
    embeddings = []
    embeddable_indices = []
    skipped_indices = []

    for i, seg in enumerate(segments):
        duration = seg["end"] - seg["start"]
        if duration < min_dur:
            skipped_indices.append(i)
            continue

        start_sample = int(seg["start"] * sample_rate)
        end_sample = int(seg["end"] * sample_rate)
        audio_slice = wav[start_sample:end_sample]

        if len(audio_slice) == 0:
            skipped_indices.append(i)
            continue

        embedding = encoder.embed_utterance(audio_slice)
        embeddings.append(embedding)
        embeddable_indices.append(i)

    # If only one or zero embeddable segments, assign all to speaker 1
    if len(embeddings) <= 1:
        return [
            {"speaker": 1, "text": seg["text"], "start": seg["start"], "end": seg["end"]}
            for seg in segments
        ]

    embedding_matrix = np.array(embeddings)

    if num_speakers is not None:
        clustering = AgglomerativeClustering(
            n_clusters=num_speakers,
            metric="cosine",
            linkage="average",
        )
    else:
        clustering = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=settings.diarization_distance_threshold,
            metric="cosine",
            linkage="average",
        )

    labels = clustering.fit_predict(embedding_matrix)

    # Map cluster labels to sequential speaker numbers ordered by first appearance
    label_to_speaker = {}
    next_speaker = 1
    for label in labels:
        if label not in label_to_speaker:
            label_to_speaker[label] = next_speaker
            next_speaker += 1

    # Build speaker assignment for embeddable segments
    speaker_map = {}
    for idx, label in zip(embeddable_indices, labels):
        speaker_map[idx] = label_to_speaker[label]

    # Assign skipped segments to the same speaker as the previous segment
    result = []
    for i, seg in enumerate(segments):
        if i in speaker_map:
            speaker = speaker_map[i]
        elif i in skipped_indices:
            # Use previous segment's speaker, or speaker 1 if first
            speaker = result[-1]["speaker"] if result else 1
        else:
            speaker = 1

        result.append({
            "speaker": speaker,
            "text": seg["text"],
            "start": seg["start"],
            "end": seg["end"],
        })

    return result
