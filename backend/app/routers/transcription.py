import asyncio
import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse

from app.config import settings
from app.models.job import JobResult, JobStatus
from app.storage.job_store import job_store
from app.services.whisper_service import transcribe_to_queue, PARAGRAPH_PAUSE_SECONDS

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {".m4a", ".wav", ".mp3", ".ogg", ".flac", ".webm", ".mp4", ".aac"}

_transcription_semaphore = asyncio.Semaphore(settings.max_concurrent_transcriptions)


async def _run_transcription(job_id: str, file_path: str, model: str):
    async with _transcription_semaphore:
        job = await job_store.get(job_id)
        if not job:
            return

        job.status = JobStatus.PROCESSING
        await job_store.update(job)
        logger.info("Transcription processing: job=%s file=%s model=%s", job_id, file_path, model)

        try:
            queue: asyncio.Queue = asyncio.Queue()
            loop = asyncio.get_running_loop()
            threading.Thread(
                target=transcribe_to_queue,
                args=(file_path, model, queue, loop),
                daemon=True,
            ).start()

            parts: list[str] = []
            while True:
                try:
                    item = await asyncio.wait_for(
                        queue.get(), timeout=settings.queue_get_timeout_seconds
                    )
                except asyncio.TimeoutError:
                    raise Exception(
                        f"Transcription timed out: no segment received for "
                        f"{settings.queue_get_timeout_seconds} seconds"
                    )

                if item[0] == "segment":
                    _, text, gap, _ = item
                    if parts:
                        parts.append("\n\n" if gap is not None and gap >= PARAGRAPH_PAUSE_SECONDS else " ")
                    parts.append(text)
                    job.transcript = "".join(parts)
                    await job_store.update(job)
                elif item[0] == "done":
                    job.status = JobStatus.DONE
                    job.duration_seconds = item[1]
                    job.model_used = model
                    job.completed_at = datetime.now(timezone.utc)
                    job.transcript = "".join(parts)
                    await job_store.update(job)
                    logger.info("Transcription done: job=%s", job_id)
                    break
                else:
                    raise Exception(item[1])

        except Exception as e:
            job.status = JobStatus.ERROR
            job.error = str(e)
            job.completed_at = datetime.now(timezone.utc)
            await job_store.update(job)
            logger.error("Transcription error: job=%s error=%s", job_id, e)
        finally:
            try:
                os.remove(file_path)
            except OSError as e:
                logger.warning("Failed to clean up file %s: %s", file_path, e)


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

    logger.info("Upload received: job=%s file=%s model=%s", job_id, file.filename, model)
    background_tasks.add_task(_run_transcription, job_id, file_path, model)

    return JSONResponse(status_code=202, content=job.model_dump(mode="json"))


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = await job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job.model_dump(mode="json")
