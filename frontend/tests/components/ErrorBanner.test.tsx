import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBanner } from '../../src/components/ErrorBanner'

describe('ErrorBanner', () => {
  it('renders error message', () => {
    render(<ErrorBanner message="Something went wrong" onDismiss={vi.fn()} />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders as error severity alert', () => {
    render(<ErrorBanner message="fail" onDismiss={vi.fn()} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('calls onDismiss when close button is clicked', async () => {
    const onDismiss = vi.fn()
    render(<ErrorBanner message="fail" onDismiss={onDismiss} />)

    const closeButton = screen.getByRole('button', { name: /close/i })
    await userEvent.click(closeButton)
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
