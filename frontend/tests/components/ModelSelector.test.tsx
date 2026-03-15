import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelSelector } from '../../src/components/ModelSelector'

describe('ModelSelector', () => {
  it('renders with selected value', () => {
    render(<ModelSelector value="base" onChange={vi.fn()} />)
    // MUI Select renders the selected value's label text
    expect(screen.getByText(/base/i)).toBeInTheDocument()
  })

  it('renders the label', () => {
    render(<ModelSelector value="base" onChange={vi.fn()} />)
    expect(screen.getByLabelText(/whisper model/i)).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    render(<ModelSelector value="base" onChange={vi.fn()} disabled />)
    // MUI adds aria-disabled to the select input
    const select = screen.getByRole('combobox')
    expect(select).toHaveAttribute('aria-disabled', 'true')
  })

  it('is enabled by default', () => {
    render(<ModelSelector value="tiny" onChange={vi.fn()} />)
    const select = screen.getByRole('combobox')
    expect(select).not.toHaveAttribute('aria-disabled')
  })
})
