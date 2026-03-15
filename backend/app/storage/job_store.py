import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
from app.config import settings
from app.models.job import JobResult, JobStatus

logger = logging.getLogger(__name__)

_TERMINAL_STATUSES = {JobStatus.DONE, JobStatus.ERROR}


class JobStore:
    def __init__(self):
        self._store: Dict[str, JobResult] = {}
        self._lock = asyncio.Lock()

    def _cleanup_expired(self) -> None:
        """Remove terminal jobs older than job_ttl_minutes. Must be called under lock."""
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.job_ttl_minutes)
        expired = [
            jid for jid, job in self._store.items()
            if job.status in _TERMINAL_STATUSES
            and job.completed_at is not None
            and job.completed_at < cutoff
        ]
        for jid in expired:
            del self._store[jid]
        if expired:
            logger.info("Cleaned up %d expired job(s).", len(expired))

    async def create(self, job: JobResult) -> JobResult:
        async with self._lock:
            self._cleanup_expired()
            self._store[job.job_id] = job
            return job

    async def get(self, job_id: str) -> Optional[JobResult]:
        async with self._lock:
            return self._store.get(job_id)

    async def update(self, job: JobResult) -> JobResult:
        async with self._lock:
            self._store[job.job_id] = job
            return job

    async def delete(self, job_id: str) -> bool:
        async with self._lock:
            if job_id in self._store:
                del self._store[job_id]
                return True
            return False


job_store = JobStore()
