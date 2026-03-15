import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../../src/components/StatusBadge'
import type { TranscriptionPhase } from '../../src/types'

describe('StatusBadge', () => {
  const cases: { phase: TranscriptionPhase; label: string }[] = [
    { phase: 'idle', label: 'Idle' },
    { phase: 'uploading', label: 'Uploading...' },
    { phase: 'polling', label: 'Processing...' },
    { phase: 'done', label: 'Done' },
    { phase: 'error', label: 'Error' },
  ]

  cases.forEach(({ phase, label }) => {
    it(`renders "${label}" for phase "${phase}"`, () => {
      render(<StatusBadge phase={phase} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })
})
