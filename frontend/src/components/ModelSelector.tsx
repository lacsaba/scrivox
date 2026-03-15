import { FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import type { WhisperModel } from '../types'

const MODELS: { value: WhisperModel; label: string }[] = [
  { value: 'tiny', label: 'Tiny (~39M params, fastest)' },
  { value: 'base', label: 'Base (~74M params, default)' },
  { value: 'small', label: 'Small (~244M params)' },
  { value: 'medium', label: 'Medium (~769M params)' },
  { value: 'large', label: 'Large (~1.5B params, slowest)' },
]

interface Props {
  value: WhisperModel
  onChange: (model: WhisperModel) => void
  disabled?: boolean
}

export function ModelSelector({ value, onChange, disabled }: Props) {
  return (
    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
      <InputLabel id="model-select-label">Whisper Model</InputLabel>
      <Select
        labelId="model-select-label"
        id="model-select"
        value={value}
        label="Whisper Model"
        onChange={(e) => onChange(e.target.value as WhisperModel)}
        disabled={disabled}
      >
        {MODELS.map((m) => (
          <MenuItem key={m.value} value={m.value}>
            {m.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
