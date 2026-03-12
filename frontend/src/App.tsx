import { useState } from 'react'
import { useTranscription } from './hooks/useTranscription'
import { AudioUploader } from './components/AudioUploader'
import { ModelSelector } from './components/ModelSelector'
import { TranscriptionResult } from './components/TranscriptionResult'
import { StatusBadge } from './components/StatusBadge'
import { ErrorBanner } from './components/ErrorBanner'
import type { WhisperModel } from './types'

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [model, setModel] = useState<WhisperModel>('base')
  const { phase, job, errorMsg, transcribe, reset } = useTranscription()

  const isActive = phase === 'uploading' || phase === 'polling'

  const handleTranscribe = () => {
    if (!file) return
    transcribe(file, model)
  }

  const handleReset = () => {
    setFile(null)
    setModel('base')
    reset()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.05)',
          padding: '32px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>
            Speech to Text
          </h1>
          <StatusBadge phase={phase} />
        </div>

        <AudioUploader onFile={setFile} disabled={isActive} />
        <ModelSelector value={model} onChange={setModel} disabled={isActive} />

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleTranscribe}
            disabled={!file || isActive}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: !file || isActive ? '#e5e7eb' : '#3b82f6',
              color: !file || isActive ? '#9ca3af' : '#fff',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: !file || isActive ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            {phase === 'uploading' ? 'Uploading...' : phase === 'polling' ? 'Transcribing...' : 'Transcribe'}
          </button>

          {(phase === 'done' || phase === 'error') && (
            <button
              onClick={handleReset}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                backgroundColor: '#fff',
                color: '#374151',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              Start Over
            </button>
          )}
        </div>

        {errorMsg && phase === 'error' && (
          <ErrorBanner message={errorMsg} onDismiss={handleReset} />
        )}

        {phase === 'done' && job && (
          <TranscriptionResult job={job} />
        )}

        {(phase === 'polling') && (
          <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '20px', fontSize: '0.9rem' }}>
            Transcribing audio... this may take a moment.
          </p>
        )}
      </div>
    </div>
  )
}
