import pytest
from datetime import datetime, timedelta, timezone

from app.models.job import JobResult, JobStatus
from app.storage.job_store import JobStore


@pytest.fixture
def store():
    return JobStore()


def _make_job(job_id: str, status: JobStatus = JobStatus.PENDING, **kwargs) -> JobResult:
    return JobResult(
        job_id=job_id,
        status=status,
        created_at=kwargs.get("created_at", datetime.now(timezone.utc)),
        completed_at=kwargs.get("completed_at"),
        transcript=kwargs.get("transcript"),
        error=kwargs.get("error"),
    )


class TestJobStoreCRUD:
    @pytest.mark.asyncio
    async def test_create_and_get(self, store):
        job = _make_job("j1")
        await store.create(job)
        fetched = await store.get("j1")
        assert fetched is not None
        assert fetched.job_id == "j1"

    @pytest.mark.asyncio
    async def test_get_nonexistent_returns_none(self, store):
        result = await store.get("nope")
        assert result is None

    @pytest.mark.asyncio
    async def test_update(self, store):
        job = _make_job("j2")
        await store.create(job)
        job.status = JobStatus.PROCESSING
        await store.update(job)
        fetched = await store.get("j2")
        assert fetched.status == JobStatus.PROCESSING

    @pytest.mark.asyncio
    async def test_delete(self, store):
        job = _make_job("j3")
        await store.create(job)
        deleted = await store.delete("j3")
        assert deleted is True
        assert await store.get("j3") is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, store):
        deleted = await store.delete("nope")
        assert deleted is False

    @pytest.mark.asyncio
    async def test_multiple_jobs(self, store):
        for i in range(5):
            await store.create(_make_job(f"j{i}"))
        for i in range(5):
            assert await store.get(f"j{i}") is not None


class TestJobStoreTTLCleanup:
    @pytest.mark.asyncio
    async def test_expired_done_jobs_are_cleaned(self, store):
        old_time = datetime.now(timezone.utc) - timedelta(minutes=120)
        old_job = _make_job("old", status=JobStatus.DONE, completed_at=old_time)
        await store.create(old_job)

        # Creating a new job triggers cleanup
        new_job = _make_job("new")
        await store.create(new_job)

        assert await store.get("old") is None
        assert await store.get("new") is not None

    @pytest.mark.asyncio
    async def test_expired_error_jobs_are_cleaned(self, store):
        old_time = datetime.now(timezone.utc) - timedelta(minutes=120)
        old_job = _make_job("err", status=JobStatus.ERROR, completed_at=old_time)
        await store.create(old_job)

        await store.create(_make_job("trigger"))
        assert await store.get("err") is None

    @pytest.mark.asyncio
    async def test_recent_done_jobs_are_kept(self, store):
        recent_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        job = _make_job("recent", status=JobStatus.DONE, completed_at=recent_time)
        await store.create(job)

        await store.create(_make_job("trigger"))
        assert await store.get("recent") is not None

    @pytest.mark.asyncio
    async def test_pending_jobs_are_never_cleaned(self, store):
        old_time = datetime.now(timezone.utc) - timedelta(minutes=120)
        job = _make_job("pending", status=JobStatus.PENDING, created_at=old_time)
        await store.create(job)

        await store.create(_make_job("trigger"))
        assert await store.get("pending") is not None

    @pytest.mark.asyncio
    async def test_processing_jobs_are_never_cleaned(self, store):
        old_time = datetime.now(timezone.utc) - timedelta(minutes=120)
        job = _make_job("proc", status=JobStatus.PROCESSING, created_at=old_time)
        await store.create(job)

        await store.create(_make_job("trigger"))
        assert await store.get("proc") is not None
