from enum import Enum
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DIARIZING = "diarizing"
    DONE = "done"
    ERROR = "error"


class Segment(BaseModel):
    speaker: int
    text: str
    start: float
    end: float


class JobResult(BaseModel):
    job_id: str
    status: JobStatus
    transcript: Optional[str] = None
    error: Optional[str] = None
    model_used: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    segments: Optional[list[Segment]] = None
    diarize_requested: bool = False
    diarize_error: Optional[str] = None
