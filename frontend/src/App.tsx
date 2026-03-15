import { useState } from 'react'
import { Box, Paper, Button, Typography, Stack } from '@mui/material'
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
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'grey.100',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        py: 6,
        px: 2,
      }}
    >
      <Paper elevation={2} sx={{ width: '100%', maxWidth: 640, p: 4, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" fontWeight={800}>
            Speech to Text
          </Typography>
          <StatusBadge phase={phase} />
        </Stack>

        <AudioUploader onFile={setFile} disabled={isActive} />
        <ModelSelector value={model} onChange={setModel} disabled={isActive} />

        <Stack direction="row" spacing={1.25}>
          <Button
            variant="contained"
            onClick={handleTranscribe}
            disabled={!file || isActive}
            fullWidth
            sx={{ fontWeight: 700 }}
          >
            {phase === 'uploading' ? 'Uploading...' : phase === 'polling' ? 'Transcribing...' : 'Transcribe'}
          </Button>

          {(phase === 'done' || phase === 'error') && (
            <Button variant="outlined" onClick={handleReset} sx={{ fontWeight: 600 }}>
              Start Over
            </Button>
          )}
        </Stack>

        {errorMsg && phase === 'error' && (
          <ErrorBanner message={errorMsg} onDismiss={handleReset} />
        )}

        {(phase === 'done' || phase === 'polling') && job && job.transcript && (
          <TranscriptionResult job={job} streaming={phase === 'polling'} />
        )}

        {phase === 'polling' && job && !job.transcript && (
          <Typography color="text.secondary" textAlign="center" mt={2.5} fontSize="0.9rem">
            Transcribing audio... this may take a moment.
          </Typography>
        )}
      </Paper>
    </Box>
  )
}
