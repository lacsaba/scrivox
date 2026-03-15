export type JobStatus = 'pending' | 'processing' | 'diarizing' | 'done' | 'error'

export interface Segment {
  speaker: number
  text: string
  start: number
  end: number
}

export interface JobResult {
  job_id: string
  status: JobStatus
  transcript: string | null
  error: string | null
  model_used: string | null
  created_at: string
  completed_at: string | null
  duration_seconds: number | null
  segments: Segment[] | null
  diarize_requested: boolean
  diarize_error: string | null
}

export type TranscriptionPhase = 'idle' | 'uploading' | 'polling' | 'diarizing' | 'done' | 'error'

export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large'
