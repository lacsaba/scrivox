# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Scrivox is a local speech-to-text web app. Audio files are uploaded to a FastAPI backend that runs transcription asynchronously via [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (a CTranslate2-based Whisper implementation). The frontend polls for job completion.

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
- **`config.py`** — `pydantic_settings`-based `Settings` class; reads from `.env`. Key settings: `cors_origins`, `default_whisper_model`, `allowed_whisper_models`, `max_upload_size_mb`, `upload_dir`.
- **`routers/transcription.py`** — `POST /transcribe` validates the file and model, writes the upload to `uploads/`, creates a `JobResult` in `job_store`, then schedules `_run_transcription` as a FastAPI `BackgroundTask`. `GET /jobs/{job_id}` returns current job state.
- **`routers/tts.py`** — Stub router returning 501; TTS is not implemented.
- **`services/whisper_service.py`** — Synchronous `_transcribe` runs in a thread via `asyncio.to_thread`. Models are cached in a module-level `_model_cache` dict; device is always CPU with int8 compute.
- **`services/base_service.py`** — Abstract `AudioProcessingService` base class with a single `process(file_path, **kwargs) -> dict` method.
- **`models/job.py`** — Pydantic `JobResult` model with `JobStatus` enum (`pending → processing → done/error`).
- **`storage/job_store.py`** — In-memory `JobStore` (dict + `asyncio.Lock`). Jobs are lost on server restart.

### Frontend (`frontend/src/`)

- **`App.tsx`** — Root component. Holds `file` and `model` state; delegates all transcription lifecycle to `useTranscription`.
- **`hooks/useTranscription.ts`** — Core hook managing `TranscriptionPhase` (`idle → uploading → polling → done/error`). Uploads the file, then polls `GET /jobs/{id}` every 2 seconds until done or error.
- **`api/transcriptionApi.ts`** — Two fetch helpers: `submitTranscription` (multipart POST) and `getJob`. Base URL comes from `VITE_API_URL` env var, defaulting to `http://localhost:8000/api/v1`.
- **`types/index.ts`** — Shared TypeScript types (`JobResult`, `JobStatus`, `TranscriptionPhase`, `WhisperModel`). These mirror the backend Pydantic model field names exactly (snake_case).
- **Components** — `AudioUploader`, `ModelSelector`, `TranscriptionResult`, `StatusBadge`, `ErrorBanner` — all presentational, no internal state.

### Key Design Points

- **No database** — jobs live in memory only; uploads are deleted from disk after transcription finishes.
- **Async bridging** — Whisper is CPU-bound and synchronous; `asyncio.to_thread` keeps the FastAPI event loop unblocked.
- **Model caching** — loaded Whisper models are reused across requests via `_model_cache`; the default model is eagerly loaded at startup.
- **TTS is a planned feature** — `routers/tts.py` and `services/tts_service.py` are stubs returning 501/NotImplementedError.
