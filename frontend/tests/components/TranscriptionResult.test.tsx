import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TranscriptionResult } from '../../src/components/TranscriptionResult'
import type { JobResult } from '../../src/types'

function makeJob(overrides: Partial<JobResult> = {}): JobResult {
  return {
    job_id: 'j1',
    status: 'done',
    transcript: 'Hello world this is a test',
    error: null,
    model_used: 'base',
    created_at: '2025-01-01T00:00:00Z',
    completed_at: '2025-01-01T00:01:00Z',
    duration_seconds: 5.0,
    segments: null,
    diarize_requested: false,
    diarize_error: null,
    ...overrides,
  }
}

describe('TranscriptionResult', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders transcript text when not streaming', () => {
    const job = makeJob()
    render(<TranscriptionResult job={job} />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveValue('Hello world this is a test')
  })

  it('shows model name and duration', () => {
    const job = makeJob()
    render(<TranscriptionResult job={job} />)

    expect(screen.getByText('base')).toBeInTheDocument()
    expect(screen.getByText('5.0s')).toBeInTheDocument()
  })

  it('displays words incrementally when streaming', () => {
    const job = makeJob({ transcript: 'Hello world' })
    render(<TranscriptionResult job={job} streaming />)

    const textarea = screen.getByRole('textbox')
    // Initially empty (typewriter hasn't ticked yet)
    expect(textarea).toHaveValue('')

    // Advance timer to reveal tokens one by one (50ms each)
    act(() => { vi.advanceTimersByTime(50) })
    // First token: "Hello"
    expect(textarea).toHaveValue('Hello')

    act(() => { vi.advanceTimersByTime(50) })
    // Second token: " " (whitespace)
    expect(textarea).toHaveValue('Hello ')

    act(() => { vi.advanceTimersByTime(50) })
    // Third token: "world"
    expect(textarea).toHaveValue('Hello world')
  })

  it('flushes all text immediately when streaming stops', () => {
    const job = makeJob({ transcript: 'Hello world test' })
    const { rerender } = render(<TranscriptionResult job={job} streaming />)

    // Don't advance timers — text is still being typed
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveValue('')

    // Switch to non-streaming — should flush everything
    rerender(<TranscriptionResult job={job} streaming={false} />)
    expect(textarea).toHaveValue('Hello world test')
  })

  it('copy button copies full transcript', async () => {
    vi.useRealTimers() // userEvent needs real timers

    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText },
    })

    const job = makeJob({ transcript: 'Full transcript here' })
    render(<TranscriptionResult job={job} />)

    const copyButton = screen.getByRole('button', { name: /copy/i })
    await userEvent.click(copyButton)

    expect(writeText).toHaveBeenCalledWith('Full transcript here')
    expect(screen.getByText('Copied!')).toBeInTheDocument()
  })

  it('does not show model or duration when absent', () => {
    const job = makeJob({ model_used: null, duration_seconds: null })
    render(<TranscriptionResult job={job} />)

    expect(screen.queryByText(/model/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/audio duration/i)).not.toBeInTheDocument()
  })

  it('renders speaker view when segments are present', () => {
    const job = makeJob({
      transcript: 'Speaker 1: Hello\n\nSpeaker 2: Hi there',
      segments: [
        { speaker: 1, text: 'Hello', start: 0.0, end: 1.5 },
        { speaker: 2, text: 'Hi there', start: 1.5, end: 3.0 },
      ],
    })
    render(<TranscriptionResult job={job} />)

    expect(screen.getByText('Speaker 1:')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Speaker 2:')).toBeInTheDocument()
    expect(screen.getByText('Hi there')).toBeInTheDocument()
    // Should not show a textarea when segments are present
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows diarize_error as warning alert', () => {
    const job = makeJob({
      diarize_requested: true,
      diarize_error: 'Encoder failed',
    })
    render(<TranscriptionResult job={job} />)

    expect(screen.getByText(/Speaker identification failed/)).toBeInTheDocument()
    expect(screen.getByText(/Encoder failed/)).toBeInTheDocument()
  })

  it('groups consecutive same-speaker segments in speaker view', () => {
    const job = makeJob({
      transcript: 'Speaker 1: Hello Good morning',
      segments: [
        { speaker: 1, text: 'Hello', start: 0.0, end: 1.0 },
        { speaker: 1, text: 'Good morning', start: 1.0, end: 2.5 },
      ],
    })
    render(<TranscriptionResult job={job} />)

    // Should only have one "Speaker 1:" label
    const labels = screen.getAllByText('Speaker 1:')
    expect(labels).toHaveLength(1)
    // Combined text
    expect(screen.getByText('Hello Good morning')).toBeInTheDocument()
  })
})
