import type { TranscriptionPhase } from '../types'

interface Props {
  phase: TranscriptionPhase
}

const LABELS: Record<TranscriptionPhase, string> = {
  idle: 'Idle',
  uploading: 'Uploading...',
  polling: 'Processing...',
  done: 'Done',
  error: 'Error',
}

const COLORS: Record<TranscriptionPhase, string> = {
  idle: '#6b7280',
  uploading: '#3b82f6',
  polling: '#f59e0b',
  done: '#10b981',
  error: '#ef4444',
}

export function StatusBadge({ phase }: Props) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: '#fff',
        backgroundColor: COLORS[phase],
        letterSpacing: '0.03em',
      }}
    >
      {LABELS[phase]}
    </span>
  )
}
