import { useState, useRef, useEffect } from 'react'
import type { JobResult } from '../types'

interface Props {
  job: JobResult
  streaming?: boolean
}

export function TranscriptionResult({ job, streaming }: Props) {
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (streaming && textareaRef.current) {
      textareaRef.current.scrollTo({ top: textareaRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [job.transcript, streaming])

  const handleCopy = async () => {
    if (!job.transcript) return
    await navigator.clipboard.writeText(job.transcript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Transcript</h2>
        <button
          onClick={handleCopy}
          style={{
            padding: '4px 12px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: '#fff',
            cursor: 'pointer',
            fontSize: '0.8rem',
            color: '#374151',
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <textarea
        ref={textareaRef}
        readOnly
        value={job.transcript ?? ''}
        style={{
          width: '100%',
          minHeight: '160px',
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid #d1d5db',
          fontSize: '0.9rem',
          lineHeight: 1.6,
          resize: 'vertical',
          boxSizing: 'border-box',
          backgroundColor: '#f9fafb',
          color: '#111827',
          fontFamily: 'inherit',
        }}
      />
      <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#6b7280', display: 'flex', gap: '16px' }}>
        {job.model_used && <span>Model: <strong>{job.model_used}</strong></span>}
        {job.duration_seconds != null && (
          <span>Audio duration: <strong>{job.duration_seconds.toFixed(1)}s</strong></span>
        )}
      </div>
    </div>
  )
}
