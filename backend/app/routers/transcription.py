import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse

from app.config import settings
from app.models.job import JobResult, JobStatus
from app.storage.job_store import job_store
from app.services.whisper_service import whisper_service

router = APIRouter()

ALLOWED_EXTENSIONS = {".m4a", ".wav", ".mp3", ".ogg", ".flac", ".webm", ".mp4", ".aac"}


async def _run_transcription(job_id: str, file_path: str, model: str):
    job = await job_store.get(job_id)
    if not job:
        return

    job.status = JobStatus.PROCESSING
    await job_store.update(job)

    try:
        result = await whisper_service.process(file_path, model=model)
        job.status = JobStatus.DONE
        job.transcript = result["transcript"]
        job.duration_seconds = result.get("duration_seconds")
        job.model_used = model
        job.completed_at = datetime.now(timezone.utc)
    except Exception as e:
        job.status = JobStatus.ERROR
        job.error = str(e)
        job.completed_at = datetime.now(timezone.utc)
    finally:
        await job_store.update(job)
        try:
            os.remove(file_path)
        except OSError:
            pass


@router.post("/transcribe", status_code=202)
async def transcribe(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model: str = Form(default="base"),
):
    if model not in settings.allowed_whisper_models:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model '{model}'. Allowed: {settings.allowed_whisper_models}",
        )

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.max_upload_size_mb}MB.",
        )

    upload_path = Path(settings.upload_dir)
    upload_path.mkdir(parents=True, exist_ok=True)
    file_path = str(upload_path / f"{uuid.uuid4()}{suffix}")

    with open(file_path, "wb") as f:
        f.write(content)

    job_id = str(uuid.uuid4())
    job = JobResult(
        job_id=job_id,
        status=JobStatus.PENDING,
        created_at=datetime.now(timezone.utc),
    )
    await job_store.create(job)

    background_tasks.add_task(_run_transcription, job_id, file_path, model)

    return JSONResponse(status_code=202, content=job.model_dump(mode="json"))


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = await job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job.model_dump(mode="json")
