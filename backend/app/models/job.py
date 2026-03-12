from enum import Enum
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"


class JobResult(BaseModel):
    job_id: str
    status: JobStatus
    transcript: Optional[str] = None
    error: Optional[str] = None
    model_used: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
