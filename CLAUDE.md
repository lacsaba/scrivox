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

## Architecture

### Backend (`backend/app/`)

- **`main.py`** — FastAPI app with CORS middleware and a lifespan hook that preloads the default Whisper model on startup. Mounts two routers under `/api/v1`.
- **`config.py`** — `pydantic_settings`-based `Settings` class; reads from `.env` with `extra: "ignore"` so non-app env vars (like `HF_HUB_DISABLE_SYMLINKS_WARNING`) don't cause validation errors.
- **`routers/transcription.py`** — `POST /transcribe` validates the file and model, writes the upload to `uploads/`, creates a `JobResult` in `job_store`, then schedules `_run_transcription` as a FastAPI `BackgroundTask`. The background task streams segments via an `asyncio.Queue`, updating `job.transcript` incrementally so the frontend can show partial results. `GET /jobs/{job_id}` returns current job state.
- **`routers/tts.py`** — Stub router returning 501; TTS is not implemented.
- **`services/whisper_service.py`** — `transcribe_to_queue()` runs Whisper in a daemon thread, pushing `("segment", text, gap, end)` tuples into an `asyncio.Queue` via `loop.call_soon_threadsafe`. Paragraphs are detected by gaps ≥ `PARAGRAPH_PAUSE_SECONDS` (1.5s) between segments. Models are cached in `_model_cache`; device is always CPU with int8 compute.
- **`services/base_service.py`** — Abstract `AudioProcessingService` base class with a single `process(file_path, **kwargs) -> dict` method.
- **`models/job.py`** — Pydantic `JobResult` model with `JobStatus` enum (`pending → processing → done/error`).
- **`storage/job_store.py`** — In-memory `JobStore` (dict + `asyncio.Lock`). Jobs are lost on server restart.

### Frontend (`frontend/src/`)

Uses **Material UI** for components and **Emotion** (`@emotion/styled`) for custom styled components. `ThemeProvider` + `CssBaseline` are set up in `main.tsx`.

- **`App.tsx`** — Root component using MUI `Paper`, `Box`, `Stack`, `Button`, `Typography`. Holds `file` and `model` state; delegates transcription lifecycle to `useTranscription`.
- **`hooks/useTranscription.ts`** — Core hook managing `TranscriptionPhase` (`idle → uploading → polling → done/error`). Uploads the file, then polls `GET /jobs/{id}` every 2 seconds until done or error.
- **`api/transcriptionApi.ts`** — Two fetch helpers: `submitTranscription` (multipart POST) and `getJob`. Base URL comes from `VITE_API_URL` env var, defaulting to `http://localhost:8000/api/v1`.
- **`types/index.ts`** — Shared TypeScript types (`JobResult`, `JobStatus`, `TranscriptionPhase`, `WhisperModel`). These mirror the backend Pydantic model field names exactly (snake_case).
- **Components:**
  - `AudioUploader` — Emotion `styled` drop zone with MUI `AudioFile` icon
  - `ModelSelector` — MUI `FormControl` + `Select` + `MenuItem`
  - `TranscriptionResult` — MUI `TextField` (multiline, rows=8) with typewriter effect: incoming segments are split into word tokens, queued, and revealed one at a time at 50ms intervals (`WORD_INTERVAL_MS`). Auto-scrolls smoothly during streaming. Copy button copies full transcript (not just displayed portion).
  - `StatusBadge` — MUI `Chip` with semantic colors per phase
  - `ErrorBanner` — MUI `Alert` with `onClose`

### Key Design Points

- **No database** — jobs live in memory only; uploads are deleted from disk after transcription finishes.
- **Streaming transcription** — Whisper runs in a daemon thread, segments are pushed through an `asyncio.Queue` to the background task via `loop.call_soon_threadsafe`. The job store is updated after each segment, and the frontend picks up partial transcripts during polling.
- **Paragraph detection** — gaps ≥ 1.5s between Whisper segments insert `\n\n` paragraph breaks.
- **Model caching** — loaded Whisper models are reused across requests via `_model_cache`; the default model is eagerly loaded at startup.
- **TTS is a planned feature** — `routers/tts.py` and `services/tts_service.py` are stubs returning 501/NotImplementedError.
