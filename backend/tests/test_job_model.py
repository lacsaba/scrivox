from datetime import datetime, timezone

from app.models.job import JobResult, JobStatus, Segment


class TestJobStatus:
    def test_status_values(self):
        assert JobStatus.PENDING == "pending"
        assert JobStatus.PROCESSING == "processing"
        assert JobStatus.DIARIZING == "diarizing"
        assert JobStatus.DONE == "done"
        assert JobStatus.ERROR == "error"


class TestJobResult:
    def test_minimal_creation(self):
        job = JobResult(
            job_id="abc",
            status=JobStatus.PENDING,
            created_at=datetime.now(timezone.utc),
        )
        assert job.job_id == "abc"
        assert job.status == JobStatus.PENDING
        assert job.transcript is None
        assert job.error is None
        assert job.model_used is None
        assert job.completed_at is None
        assert job.duration_seconds is None
        assert job.segments is None
        assert job.diarize_requested is False
        assert job.diarize_error is None

    def test_full_creation(self):
        now = datetime.now(timezone.utc)
        job = JobResult(
            job_id="xyz",
            status=JobStatus.DONE,
            transcript="Hello world",
            error=None,
            model_used="base",
            created_at=now,
            completed_at=now,
            duration_seconds=3.5,
        )
        assert job.transcript == "Hello world"
        assert job.duration_seconds == 3.5

    def test_model_dump_json_mode(self):
        job = JobResult(
            job_id="d",
            status=JobStatus.PENDING,
            created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
        )
        d = job.model_dump(mode="json")
        assert d["job_id"] == "d"
        assert d["status"] == "pending"
        assert isinstance(d["created_at"], str)

    def test_status_mutation(self):
        job = JobResult(
            job_id="m",
            status=JobStatus.PENDING,
            created_at=datetime.now(timezone.utc),
        )
        job.status = JobStatus.PROCESSING
        assert job.status == JobStatus.PROCESSING
        job.status = JobStatus.DIARIZING
        assert job.status == JobStatus.DIARIZING
        job.status = JobStatus.DONE
        assert job.status == JobStatus.DONE

    def test_segments_field(self):
        seg = Segment(speaker=1, text="Hello", start=0.0, end=1.5)
        job = JobResult(
            job_id="s",
            status=JobStatus.DONE,
            created_at=datetime.now(timezone.utc),
            segments=[seg],
        )
        assert len(job.segments) == 1
        assert job.segments[0].speaker == 1
        assert job.segments[0].text == "Hello"

        d = job.model_dump(mode="json")
        assert d["segments"][0]["speaker"] == 1
        assert d["segments"][0]["start"] == 0.0

    def test_diarize_error_field(self):
        job = JobResult(
            job_id="e",
            status=JobStatus.DONE,
            created_at=datetime.now(timezone.utc),
            diarize_requested=True,
            diarize_error="Encoder failed",
        )
        assert job.diarize_error == "Encoder failed"
        d = job.model_dump(mode="json")
        assert d["diarize_error"] == "Encoder failed"
        assert d["diarize_requested"] is True
