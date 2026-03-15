import type { JobResult } from '../types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

const UPLOAD_TIMEOUT_MS = 120_000
const POLL_TIMEOUT_MS = 10_000

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function submitTranscription(
  file: File,
  model: string,
  diarize: boolean = false,
  numSpeakers?: number,
): Promise<JobResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('model', model)
  if (diarize) {
    formData.append('diarize', 'true')
  }
  if (numSpeakers !== undefined) {
    formData.append('num_speakers', String(numSpeakers))
  }

  const response = await fetchWithTimeout(
    `${BASE_URL}/transcribe`,
    { method: 'POST', body: formData },
    UPLOAD_TIMEOUT_MS,
  )

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail ?? `Upload failed with status ${response.status}`)
  }

  return response.json()
}

export async function getJob(jobId: string): Promise<JobResult> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/jobs/${jobId}`,
    undefined,
    POLL_TIMEOUT_MS,
  )

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail ?? `Failed to fetch job ${jobId}`)
  }

  return response.json()
}
