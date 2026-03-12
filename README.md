# Speech-to-Text Web App

Converts audio files to text using local OpenAI Whisper (via faster-whisper).

## Prerequisites

1. Python 3.10 or 3.11
2. FFmpeg on PATH: `winget install Gyan.FFmpeg`
3. Node.js 18+

## Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env.local
npm run dev
```

## Usage

1. Open http://localhost:5173
2. Drop or select an audio file (m4a, wav, mp3, ogg, flac, webm, mp4, aac)
3. Choose a Whisper model (base is a good default)
4. Click Transcribe
5. Wait for the transcript to appear

## API

- `POST /api/v1/transcribe` — Upload audio, returns job (202 Accepted)
- `GET /api/v1/jobs/{job_id}` — Poll job status
