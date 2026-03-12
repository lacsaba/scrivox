export type JobStatus = 'pending' | 'processing' | 'done' | 'error'

export interface JobResult {
  job_id: string
  status: JobStatus
  transcript: string | null
  error: string | null
  model_used: string | null
  created_at: string
  completed_at: string | null
  duration_seconds: number | null
}

export type TranscriptionPhase = 'idle' | 'uploading' | 'polling' | 'done' | 'error'

export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large'
