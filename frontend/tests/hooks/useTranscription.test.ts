import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTranscription } from '../../src/hooks/useTranscription'

vi.mock('../../src/api/transcriptionApi', () => ({
  submitTranscription: vi.fn(),
  getJob: vi.fn(),
}))

import { submitTranscription, getJob } from '../../src/api/transcriptionApi'

const mockSubmit = vi.mocked(submitTranscription)
const mockGetJob = vi.mocked(getJob)

describe('useTranscription', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in idle phase with no job', () => {
    const { result } = renderHook(() => useTranscription())
    expect(result.current.phase).toBe('idle')
    expect(result.current.job).toBeNull()
    expect(result.current.errorMsg).toBeNull()
  })

  it('transitions to uploading then polling on transcribe', async () => {
    const mockJob = {
      job_id: 'j1',
      status: 'pending' as const,
      transcript: null,
      error: null,
      model_used: null,
      created_at: '2025-01-01T00:00:00Z',
      completed_at: null,
      duration_seconds: null,
    }
    mockSubmit.mockResolvedValue(mockJob)

    const { result } = renderHook(() => useTranscription())

    const file = new File(['audio'], 'test.wav')

    await act(async () => {
      await result.current.transcribe(file, 'base')
    })

    expect(mockSubmit).toHaveBeenCalledWith(file, 'base')
    expect(result.current.phase).toBe('polling')
    expect(result.current.job).toEqual(mockJob)
  })

  it('sets error phase when upload fails', async () => {
    mockSubmit.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useTranscription())
    const file = new File(['audio'], 'test.wav')

    await act(async () => {
      await result.current.transcribe(file, 'base')
    })

    expect(result.current.phase).toBe('error')
    expect(result.current.errorMsg).toBe('Network error')
  })

  it('polls until job is done', async () => {
    const pendingJob = {
      job_id: 'j1',
      status: 'pending' as const,
      transcript: null,
      error: null,
      model_used: null,
      created_at: '2025-01-01T00:00:00Z',
      completed_at: null,
      duration_seconds: null,
    }
    const doneJob = {
      ...pendingJob,
      status: 'done' as const,
      transcript: 'Hello world',
      model_used: 'base',
      completed_at: '2025-01-01T00:01:00Z',
      duration_seconds: 3.0,
    }

    mockSubmit.mockResolvedValue(pendingJob)
    mockGetJob.mockResolvedValueOnce({ ...pendingJob, status: 'processing' })
    mockGetJob.mockResolvedValueOnce(doneJob)

    const { result } = renderHook(() => useTranscription())
    const file = new File(['audio'], 'test.wav')

    await act(async () => {
      await result.current.transcribe(file, 'base')
    })

    expect(result.current.phase).toBe('polling')

    // First poll — still processing
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.phase).toBe('polling')

    // Second poll — done
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.phase).toBe('done')
    expect(result.current.job?.transcript).toBe('Hello world')
  })

  it('sets error phase when job status is error', async () => {
    const pendingJob = {
      job_id: 'j1',
      status: 'pending' as const,
      transcript: null,
      error: null,
      model_used: null,
      created_at: '2025-01-01T00:00:00Z',
      completed_at: null,
      duration_seconds: null,
    }
    const errorJob = {
      ...pendingJob,
      status: 'error' as const,
      error: 'Transcription failed',
    }

    mockSubmit.mockResolvedValue(pendingJob)
    mockGetJob.mockResolvedValueOnce(errorJob)

    const { result } = renderHook(() => useTranscription())
    const file = new File(['audio'], 'test.wav')

    await act(async () => {
      await result.current.transcribe(file, 'base')
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.phase).toBe('error')
    expect(result.current.errorMsg).toBe('Transcription failed')
  })

  it('sets error phase when polling throws', async () => {
    const pendingJob = {
      job_id: 'j1',
      status: 'pending' as const,
      transcript: null,
      error: null,
      model_used: null,
      created_at: '2025-01-01T00:00:00Z',
      completed_at: null,
      duration_seconds: null,
    }

    mockSubmit.mockResolvedValue(pendingJob)
    mockGetJob.mockRejectedValueOnce(new Error('Request timed out'))

    const { result } = renderHook(() => useTranscription())
    const file = new File(['audio'], 'test.wav')

    await act(async () => {
      await result.current.transcribe(file, 'base')
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.phase).toBe('error')
    expect(result.current.errorMsg).toBe('Request timed out')
  })

  it('reset returns to idle', async () => {
    const mockJob = {
      job_id: 'j1',
      status: 'pending' as const,
      transcript: null,
      error: null,
      model_used: null,
      created_at: '2025-01-01T00:00:00Z',
      completed_at: null,
      duration_seconds: null,
    }
    mockSubmit.mockResolvedValue(mockJob)

    const { result } = renderHook(() => useTranscription())
    const file = new File(['audio'], 'test.wav')

    await act(async () => {
      await result.current.transcribe(file, 'base')
    })

    expect(result.current.phase).toBe('polling')

    act(() => {
      result.current.reset()
    })

    expect(result.current.phase).toBe('idle')
    expect(result.current.job).toBeNull()
    expect(result.current.errorMsg).toBeNull()
  })
})
