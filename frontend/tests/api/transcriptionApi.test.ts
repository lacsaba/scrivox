import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { submitTranscription, getJob } from '../../src/api/transcriptionApi'

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('submitTranscription', () => {
  it('sends multipart form data and returns job result', async () => {
    const mockJob = { job_id: 'j1', status: 'pending' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJob),
    })

    const file = new File(['audio'], 'test.wav', { type: 'audio/wav' })
    const result = await submitTranscription(file, 'base')

    expect(result).toEqual(mockJob)
    expect(mockFetch).toHaveBeenCalledOnce()

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/transcribe')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('appends diarize and num_speakers to form data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ job_id: 'j1', status: 'pending' }),
    })

    const file = new File(['audio'], 'test.wav')
    await submitTranscription(file, 'base', true, 3)

    const [, init] = mockFetch.mock.calls[0]
    const formData = init.body as FormData
    expect(formData.get('diarize')).toBe('true')
    expect(formData.get('num_speakers')).toBe('3')
  })

  it('does not append diarize when false', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ job_id: 'j1', status: 'pending' }),
    })

    const file = new File(['audio'], 'test.wav')
    await submitTranscription(file, 'base', false)

    const [, init] = mockFetch.mock.calls[0]
    const formData = init.body as FormData
    expect(formData.get('diarize')).toBeNull()
  })

  it('throws on non-ok response with detail', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: 'Invalid model' }),
    })

    const file = new File(['audio'], 'test.wav')
    await expect(submitTranscription(file, 'bad')).rejects.toThrow('Invalid model')
  })

  it('throws generic message when response has no detail', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('parse error')),
    })

    const file = new File(['audio'], 'test.wav')
    await expect(submitTranscription(file, 'base')).rejects.toThrow('Upload failed with status 500')
  })

  it('throws "Request timed out" on abort', async () => {
    mockFetch.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => {
          const err = new DOMException('The operation was aborted.', 'AbortError')
          reject(err)
        })
      })
    })

    const file = new File(['audio'], 'test.wav')
    // We can't easily wait 120s, but we can verify the AbortSignal is attached
    // Instead, manually abort to test the error mapping
    const originalSetTimeout = globalThis.setTimeout
    vi.stubGlobal('setTimeout', (cb: () => void, _ms: number) => {
      // Fire timeout immediately
      return originalSetTimeout(cb, 0)
    })

    await expect(submitTranscription(file, 'base')).rejects.toThrow('Request timed out')

    vi.stubGlobal('setTimeout', originalSetTimeout)
  })
})

describe('getJob', () => {
  it('fetches job by id', async () => {
    const mockJob = { job_id: 'j1', status: 'done', transcript: 'hello' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJob),
    })

    const result = await getJob('j1')
    expect(result).toEqual(mockJob)

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/jobs/j1')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ detail: "Job 'x' not found." }),
    })

    await expect(getJob('x')).rejects.toThrow("Job 'x' not found.")
  })
})
