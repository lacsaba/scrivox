import { Chip } from '@mui/material'
import type { TranscriptionPhase } from '../types'

const CONFIG: Record<TranscriptionPhase, { label: string; color: 'default' | 'primary' | 'warning' | 'success' | 'error' }> = {
  idle: { label: 'Idle', color: 'default' },
  uploading: { label: 'Uploading...', color: 'primary' },
  polling: { label: 'Processing...', color: 'warning' },
  done: { label: 'Done', color: 'success' },
  error: { label: 'Error', color: 'error' },
}

interface Props {
  phase: TranscriptionPhase
}

export function StatusBadge({ phase }: Props) {
  const { label, color } = CONFIG[phase]
  return <Chip label={label} color={color} size="small" />
}
