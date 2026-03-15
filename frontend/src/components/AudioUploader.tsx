import { useRef, useState, DragEvent, ChangeEvent } from 'react'
import { Typography } from '@mui/material'
import { AudioFile } from '@mui/icons-material'
import styled from '@emotion/styled'

const ACCEPT = '.m4a,.wav,.mp3,.ogg,.flac,.webm,.mp4,.aac'

interface DropZoneProps {
  isDragging: boolean
  isDisabled: boolean
}

const DropZone = styled.div<DropZoneProps>`
  border: 2px dashed ${({ isDragging }) => (isDragging ? '#1976d2' : '#bdbdbd')};
  border-radius: 12px;
  padding: 40px 24px;
  text-align: center;
  cursor: ${({ isDisabled }) => (isDisabled ? 'not-allowed' : 'pointer')};
  background-color: ${({ isDragging }) => (isDragging ? '#e3f2fd' : '#fafafa')};
  transition: border-color 0.15s, background-color 0.15s;
  margin-bottom: 16px;
`

interface Props {
  onFile: (file: File) => void
  disabled?: boolean
}

export function AudioUploader({ onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const dragCounterRef = useRef(0)

  const handleFile = (file: File) => {
    setSelected(file.name)
    onFile(file)
  }

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled) {
      dragCounterRef.current++
      setDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setDragging(false)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <DropZone
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      isDragging={dragging}
      isDisabled={!!disabled}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={disabled}
      />
      <AudioFile sx={{ fontSize: 48, color: 'action.active', mb: 1 }} />
      {selected ? (
        <Typography variant="body2" fontWeight={600}>
          {selected}
        </Typography>
      ) : (
        <>
          <Typography fontWeight={600} color="text.primary">
            Drop an audio file here or click to browse
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Supported: m4a, wav, mp3, ogg, flac, webm, mp4, aac
          </Typography>
        </>
      )}
    </DropZone>
  )
}
