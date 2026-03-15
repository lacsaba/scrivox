# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Scrivox is a local speech-to-text web app. Audio files are uploaded to a FastAPI backend that runs transcription via [faster-whisper](https://github.com/SYSTRAN/faster-whisper). Transcription streams segment-by-segment to the frontend, which displays words with a typewriter effect.

## Prerequisites

- Python 3.10 or 3.11
- FFmpeg on PATH: `winget install Gyan.FFmpeg`
- Node.js 18+

## Commands

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
pip install -r requirements-dev.txt   # dev/test dependencies
uvicorn app.main:app --reload
```

Log to file while keeping terminal output:
```bash
uvicorn app.main:app --reload 2>&1 | tee logs/server.log
```

Run tests:
```bash
cd backend
pytest
```

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env.local
npm run dev
npm run build   # tsc + vite build
```

Run tests:
```bash
cd frontend
npm test          # single run
npm run test:watch  # watch mode
```

## Architecture

### Backend (`backend/app/`)

- **`main.py`** — FastAPI app with CORS middleware and a lifespan hook that preloads the default Whisper model on startup. Mounts two routers under `/api/v1`.
- **`config.py`** — `pydantic_settings`-based `Settings` class; reads from `.env` with `extra: "ignore"` so non-app env vars (like `HF_HUB_DISABLE_SYMLINKS_WARNING`) don't cause validation errors. Includes `queue_get_timeout_seconds` (600), `job_ttl_minutes` (60), and `max_concurrent_transcriptions` (2).
- **`routers/transcription.py`** — `POST /transcribe` validates the file and model, writes the upload to `uploads/`, creates a `JobResult` in `job_store`, then schedules `_run_transcription` as a FastAPI `BackgroundTask`. Accepts optional `diarize: bool` and `num_speakers: int` form fields. The background task is gated by an `asyncio.Semaphore` (max 2 concurrent), streams segments via an `asyncio.Queue` with per-segment timeout, updating `job.transcript` incrementally. After transcription completes, if `diarize=true`, runs speaker diarization via `asyncio.to_thread()` and rebuilds the transcript with "Speaker X:" prefixes. Diarization failures are non-fatal (plain transcript preserved, `diarize_error` set). `GET /jobs/{job_id}` returns current job state.
- **`routers/tts.py`** — Stub router returning 501; TTS is not implemented.
- **`services/whisper_service.py`** — `transcribe_to_queue()` runs Whisper in a daemon thread, pushing `("segment", text, gap, start, end)` tuples into an `asyncio.Queue` via `loop.call_soon_threadsafe`. Paragraphs are detected by gaps ≥ `PARAGRAPH_PAUSE_SECONDS` (1.5s) between segments. Models are cached in `_model_cache` behind a `threading.Lock`; device is always CPU with int8 compute.
- **`services/diarization_service.py`** — Post-transcription speaker diarization using [Resemblyzer](https://github.com/resemble-ai/Resemblyzer) (no HF token required). Extracts 256-dim speaker embeddings per segment, clusters with `AgglomerativeClustering` (cosine/average linkage). Supports explicit `num_speakers` or auto-detection via `distance_threshold`. Encoder is cached behind `threading.Lock`. Short segments (< `min_segment_duration_for_embedding`) inherit the previous segment's speaker.
- **`services/base_service.py`** — Abstract `AudioProcessingService` base class with a single `process(file_path, **kwargs) -> dict` method.
- **`models/job.py`** — Pydantic `JobResult` model with `JobStatus` enum (`pending → processing → diarizing → done/error`), `Segment` model (`speaker`, `text`, `start`, `end`), and diarization fields (`segments`, `diarize_requested`, `diarize_error`).
- **`storage/job_store.py`** — In-memory `JobStore` (dict + `asyncio.Lock`). Jobs are lost on server restart. TTL-based cleanup removes completed/errored jobs older than `job_ttl_minutes` on each `create()` call.

### Frontend (`frontend/src/`)

Uses **Material UI** for components and **Emotion** (`@emotion/styled`) for custom styled components. `ThemeProvider` + `CssBaseline` are set up in `main.tsx`.

- **`App.tsx`** — Root component using MUI `Paper`, `Box`, `Stack`, `Button`, `Typography`. Holds `file` and `model` state; delegates transcription lifecycle to `useTranscription`.
- **`hooks/useTranscription.ts`** — Core hook managing `TranscriptionPhase` (`idle → uploading → polling → diarizing → done/error`). Uploads the file (with optional `diarize`/`numSpeakers`), then polls `GET /jobs/{id}` every 2 seconds until done or error.
- **`api/transcriptionApi.ts`** — Two fetch helpers: `submitTranscription` (multipart POST, 120s timeout) and `getJob` (10s timeout). Uses `AbortController`-based `fetchWithTimeout` wrapper. Base URL comes from `VITE_API_URL` env var, defaulting to `http://localhost:8000/api/v1`.
- **`types/index.ts`** — Shared TypeScript types (`JobResult`, `JobStatus`, `TranscriptionPhase`, `WhisperModel`). These mirror the backend Pydantic model field names exactly (snake_case).
- **Components:**
  - `AudioUploader` — Emotion `styled` drop zone with MUI `AudioFile` icon
  - `ModelSelector` — MUI `FormControl` + `Select` + `MenuItem`
  - `DiarizeOptions` — MUI `Switch` ("Identify speakers") + optional `TextField` for number of speakers
  - `TranscriptionResult` — When `job.segments` is present, renders a `SpeakerView` with color-coded speaker labels; otherwise, MUI `TextField` (multiline, rows=8) with typewriter effect: incoming segments are split into word tokens, queued, and revealed one at a time at 50ms intervals (`WORD_INTERVAL_MS`). Auto-scrolls smoothly during streaming. Copy button copies full transcript (not just displayed portion). Shows warning `Alert` if `diarize_error` is set.
  - `StatusBadge` — MUI `Chip` with semantic colors per phase
  - `ErrorBanner` — MUI `Alert` with `onClose`

### Key Design Points

- **No database** — jobs live in memory only; uploads are deleted from disk after transcription finishes.
- **Streaming transcription** — Whisper runs in a daemon thread, segments are pushed through an `asyncio.Queue` to the background task via `loop.call_soon_threadsafe`. The job store is updated after each segment, and the frontend picks up partial transcripts during polling.
- **Paragraph detection** — gaps ≥ 1.5s between Whisper segments insert `\n\n` paragraph breaks.
- **Speaker diarization** — optional post-transcription step using Resemblyzer embeddings + AgglomerativeClustering. Runs after Whisper completes, rebuilds transcript with "Speaker X:" labels. Failure is non-fatal (plain transcript preserved). Frontend shows `diarizing` status and renders color-coded speaker labels.
- **Model caching** — loaded Whisper models are reused across requests via `_model_cache`; the default model is eagerly loaded at startup.
- **TTS is a planned feature** — `routers/tts.py` and `services/tts_service.py` are stubs returning 501/NotImplementedError.
- **`setuptools<81` pinned** — Resemblyzer depends on `webrtcvad` which uses `pkg_resources`; removed in setuptools 82+.

### Testing

- **Backend** (`backend/tests/`): pytest + pytest-asyncio + httpx. Whisper is mocked via `conftest.py` fixtures; diarization is mocked via `_patch_resemblyzer` fixture. Tests cover config, job model (including Segment, diarize fields), job store (CRUD + TTL cleanup), diarization service (encoder caching, thread safety, two-speaker clustering, auto-detect, short segments, label ordering), transcription router (upload validation, job lifecycle, diarize flag, num_speakers validation, end-to-end diarization, diarization failure fallback, end-to-end with mocked Whisper), whisper service (caching, thread safety, segment streaming with start/end timestamps, error handling), and TTS stub.
- **Frontend** (`frontend/tests/`): vitest + @testing-library/react + jsdom. `@mui/icons-material` is globally mocked in `tests/setup.ts` to avoid EMFILE on Windows. Tests cover API layer (fetch timeout, error mapping, diarize/numSpeakers params), all components (AudioUploader drag counter, DiarizeOptions switch + number input, TranscriptionResult typewriter + copy + speaker view + diarize error, ModelSelector, StatusBadge including diarizing phase, ErrorBanner), and the useTranscription hook (upload, polling, diarizing phase, error, reset lifecycle).
