import asyncio
from typing import Dict, Optional
from app.models.job import JobResult


class JobStore:
    def __init__(self):
        self._store: Dict[str, JobResult] = {}
        self._lock = asyncio.Lock()

    async def create(self, job: JobResult) -> JobResult:
        async with self._lock:
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
