import { Box, FormControlLabel, Switch, TextField } from '@mui/material'

interface Props {
  diarize: boolean
  numSpeakers: number | undefined
  onDiarizeChange: (value: boolean) => void
  onNumSpeakersChange: (value: number | undefined) => void
  disabled: boolean
}

export function DiarizeOptions({ diarize, numSpeakers, onDiarizeChange, onNumSpeakersChange, disabled }: Props) {
  return (
    <Box sx={{ mb: 2 }}>
      <FormControlLabel
        control={
          <Switch
            checked={diarize}
            onChange={(e) => onDiarizeChange(e.target.checked)}
            disabled={disabled}
          />
        }
        label="Identify speakers"
      />
      {diarize && (
        <TextField
          label="Number of speakers (auto if blank)"
          type="number"
          size="small"
          value={numSpeakers ?? ''}
          onChange={(e) => {
            const val = e.target.value
            onNumSpeakersChange(val === '' ? undefined : parseInt(val, 10))
          }}
          disabled={disabled}
          slotProps={{ htmlInput: { min: 2 } }}
          sx={{ ml: 1, width: 260 }}
        />
      )}
    </Box>
  )
}
