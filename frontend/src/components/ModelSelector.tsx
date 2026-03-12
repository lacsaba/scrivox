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
    <div style={{ marginBottom: '16px' }}>
      <label
        htmlFor="model-select"
        style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#374151' }}
      >
        Whisper Model
      </label>
      <select
        id="model-select"
        value={value}
        onChange={(e) => onChange(e.target.value as WhisperModel)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid #d1d5db',
          fontSize: '0.9rem',
          backgroundColor: disabled ? '#f9fafb' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {MODELS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  )
}
