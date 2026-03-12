import { useRef, useState, DragEvent, ChangeEvent } from 'react'

const ACCEPT = '.m4a,.wav,.mp3,.ogg,.flac,.webm,.mp4,.aac'

interface Props {
  onFile: (file: File) => void
  disabled?: boolean
}

export function AudioUploader({ onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const handleFile = (file: File) => {
    setSelected(file.name)
    onFile(file)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
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
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragging ? '#3b82f6' : '#d1d5db'}`,
        borderRadius: '10px',
        padding: '40px 24px',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: dragging ? '#eff6ff' : '#f9fafb',
        transition: 'border-color 0.15s, background-color 0.15s',
        marginBottom: '16px',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={disabled}
      />
      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎵</div>
      {selected ? (
        <p style={{ fontSize: '0.9rem', color: '#374151', margin: 0 }}>
          <strong>{selected}</strong>
        </p>
      ) : (
        <>
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#374151' }}>
            Drop an audio file here or click to browse
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>
            Supported: m4a, wav, mp3, ogg, flac, webm, mp4, aac
          </p>
        </>
      )}
    </div>
  )
}
