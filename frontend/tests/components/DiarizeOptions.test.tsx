import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiarizeOptions } from '../../src/components/DiarizeOptions'

describe('DiarizeOptions', () => {
  const defaultProps = {
    diarize: false,
    numSpeakers: undefined,
    onDiarizeChange: vi.fn(),
    onNumSpeakersChange: vi.fn(),
    disabled: false,
  }

  it('renders the switch', () => {
    render(<DiarizeOptions {...defaultProps} />)
    expect(screen.getByLabelText('Identify speakers')).toBeInTheDocument()
  })

  it('does not show number input when diarize is off', () => {
    render(<DiarizeOptions {...defaultProps} />)
    expect(screen.queryByLabelText(/number of speakers/i)).not.toBeInTheDocument()
  })

  it('shows number input when diarize is on', () => {
    render(<DiarizeOptions {...defaultProps} diarize={true} />)
    expect(screen.getByLabelText(/number of speakers/i)).toBeInTheDocument()
  })

  it('calls onDiarizeChange when switch is toggled', async () => {
    const onDiarizeChange = vi.fn()
    render(<DiarizeOptions {...defaultProps} onDiarizeChange={onDiarizeChange} />)

    await userEvent.click(screen.getByRole('switch'))
    expect(onDiarizeChange).toHaveBeenCalledWith(true)
  })

  it('disables controls when disabled', () => {
    render(<DiarizeOptions {...defaultProps} diarize={true} disabled={true} />)
    expect(screen.getByRole('switch')).toBeDisabled()
    expect(screen.getByLabelText(/number of speakers/i)).toBeDisabled()
  })
})
