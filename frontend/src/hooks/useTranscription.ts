import { useState, useRef, useCallback } from 'react'
import { submitTranscription, getJob } from '../api/transcriptionApi'
import type { JobResult, TranscriptionPhase } from '../types'

const POLL_INTERVAL_MS = 2000

interface UseTranscriptionReturn {
  phase: TranscriptionPhase
  job: JobResult | null
  errorMsg: string | null
  transcribe: (file: File, model: string, diarize?: boolean, numSpeakers?: number) => Promise<void>
  reset: () => void
}

export function useTranscription(): UseTranscriptionReturn {
  const [phase, setPhase] = useState<TranscriptionPhase>('idle')
  const [job, setJob] = useState<JobResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const transcribe = useCallback(
    async (file: File, model: string, diarize: boolean = false, numSpeakers?: number) => {
      stopPolling()
      setPhase('uploading')
      setJob(null)
      setErrorMsg(null)

      let initialJob: JobResult
      try {
        initialJob = await submitTranscription(file, model, diarize, numSpeakers)
      } catch (err) {
        setPhase('error')
        setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
        return
      }

      setJob(initialJob)
      setPhase('polling')

      pollRef.current = setInterval(async () => {
        try {
          const updated = await getJob(initialJob.job_id)
          setJob(updated)

          if (updated.status === 'done') {
            stopPolling()
            setPhase('done')
          } else if (updated.status === 'error') {
            stopPolling()
            setPhase('error')
            setErrorMsg(updated.error ?? 'Transcription failed')
          } else if (updated.status === 'diarizing') {
            setPhase('diarizing')
          }
        } catch (err) {
          stopPolling()
          setPhase('error')
          setErrorMsg(err instanceof Error ? err.message : 'Polling failed')
        }
      }, POLL_INTERVAL_MS)
    },
    [stopPolling],
  )

  const reset = useCallback(() => {
    stopPolling()
    setPhase('idle')
    setJob(null)
    setErrorMsg(null)
  }, [stopPolling])

  return { phase, job, errorMsg, transcribe, reset }
}
