import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AudioUploader } from '../../src/components/AudioUploader'

describe('AudioUploader', () => {
  it('renders placeholder text when no file selected', () => {
    render(<AudioUploader onFile={vi.fn()} />)
    expect(screen.getByText(/drop an audio file/i)).toBeInTheDocument()
    expect(screen.getByText(/supported/i)).toBeInTheDocument()
  })

  it('shows selected file name from prop', () => {
    render(<AudioUploader onFile={vi.fn()} selectedName="recording.wav" />)
    expect(screen.getByText('recording.wav')).toBeInTheDocument()
    expect(screen.queryByText(/drop an audio file/i)).not.toBeInTheDocument()
  })

  it('shows placeholder when selectedName is null', () => {
    render(<AudioUploader onFile={vi.fn()} selectedName={null} />)
    expect(screen.getByText(/drop an audio file/i)).toBeInTheDocument()
  })

  it('calls onFile when a file is selected via input', async () => {
    const onFile = vi.fn()
    render(<AudioUploader onFile={onFile} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' })

    await userEvent.upload(input, file)
    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('handles file drop', () => {
    const onFile = vi.fn()
    render(<AudioUploader onFile={onFile} />)

    const dropZone = screen.getByText(/drop an audio file/i).closest('div')!
    const file = new File(['audio'], 'test.wav', { type: 'audio/wav' })

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    })

    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('does not call onFile on drop when disabled', () => {
    const onFile = vi.fn()
    render(<AudioUploader onFile={onFile} disabled />)

    const dropZone = screen.getByText(/drop an audio file/i).closest('div')!
    const file = new File(['audio'], 'test.wav', { type: 'audio/wav' })

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    })

    expect(onFile).not.toHaveBeenCalled()
  })

  it('sets dragging state on dragEnter and clears on dragLeave', () => {
    render(<AudioUploader onFile={vi.fn()} />)

    const dropZone = screen.getByText(/drop an audio file/i).closest('div')!

    fireEvent.dragEnter(dropZone)
    // The styled component should reflect isDragging via background color
    expect(dropZone).toHaveStyle({ backgroundColor: '#e3f2fd' })

    fireEvent.dragLeave(dropZone)
    expect(dropZone).toHaveStyle({ backgroundColor: '#fafafa' })
  })

  it('does not flicker when dragging over child elements (counter pattern)', () => {
    render(<AudioUploader onFile={vi.fn()} />)

    const dropZone = screen.getByText(/drop an audio file/i).closest('div')!

    // Enter the outer zone
    fireEvent.dragEnter(dropZone)
    expect(dropZone).toHaveStyle({ backgroundColor: '#e3f2fd' })

    // Enter a child (counter goes to 2)
    fireEvent.dragEnter(dropZone)
    expect(dropZone).toHaveStyle({ backgroundColor: '#e3f2fd' })

    // Leave the child (counter goes to 1) — should still be dragging
    fireEvent.dragLeave(dropZone)
    expect(dropZone).toHaveStyle({ backgroundColor: '#e3f2fd' })

    // Leave the outer zone (counter goes to 0)
    fireEvent.dragLeave(dropZone)
    expect(dropZone).toHaveStyle({ backgroundColor: '#fafafa' })
  })
})
