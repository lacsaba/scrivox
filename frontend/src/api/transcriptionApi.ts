import type { JobResult } from '../types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

export async function submitTranscription(file: File, model: string): Promise<JobResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('model', model)

  const response = await fetch(`${BASE_URL}/transcribe`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail ?? `Upload failed with status ${response.status}`)
  }

  return response.json()
}

export async function getJob(jobId: string): Promise<JobResult> {
  const response = await fetch(`${BASE_URL}/jobs/${jobId}`)

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail ?? `Failed to fetch job ${jobId}`)
  }

  return response.json()
}
