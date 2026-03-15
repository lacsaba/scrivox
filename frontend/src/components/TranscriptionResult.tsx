import { useState, useRef, useEffect } from 'react'
import { Box, Typography, Button, TextField, Stack } from '@mui/material'
import { ContentCopy, Check } from '@mui/icons-material'
import type { JobResult } from '../types'

const WORD_INTERVAL_MS = 50

interface Props {
  job: JobResult
  streaming?: boolean
}

export function TranscriptionResult({ job, streaming }: Props) {
  const [copied, setCopied] = useState(false)
  const [displayed, setDisplayed] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingRef = useRef<string[]>([])
  const prevTranscriptRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Queue new tokens when transcript grows, or flush immediately when done
  useEffect(() => {
    const full = job.transcript ?? ''
    const newContent = full.slice(prevTranscriptRef.current.length)
    prevTranscriptRef.current = full

    if (!streaming) {
      pendingRef.current = []
      if (timerRef.current) clearTimeout(timerRef.current)
      setDisplayed(full)
      return
    }

    if (newContent) {
      const tokens = newContent.split(/(\s+)/).filter(t => t.length > 0)
      pendingRef.current.push(...tokens)
    }
  }, [job.transcript, streaming])

  // Typewriter timer — pops one token at a time while streaming
  useEffect(() => {
    if (!streaming) return

    const tick = () => {
      if (pendingRef.current.length > 0) {
        const token = pendingRef.current.shift()!
        setDisplayed(prev => prev + token)
      }
      timerRef.current = setTimeout(tick, WORD_INTERVAL_MS)
    }

    timerRef.current = setTimeout(tick, WORD_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [streaming])

  // Auto-scroll to bottom as new tokens appear
  useEffect(() => {
    if (streaming && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight
    }
  }, [displayed, streaming])

  // Clean up copy timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const handleCopy = async () => {
    if (!job.transcript) return
    await navigator.clipboard.writeText(job.transcript)
    setCopied(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Box mt={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle1" fontWeight={700}>
          Transcript
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={copied ? <Check /> : <ContentCopy />}
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </Stack>
      <TextField
        inputRef={textareaRef}
        multiline
        rows={8}
        fullWidth
        value={displayed}
        slotProps={{ input: { readOnly: true } }}
        sx={{
          '& .MuiInputBase-inputMultiline': {
            resize: 'vertical',
            fontSize: '0.9rem',
            lineHeight: 1.6,
          },
          '& .MuiOutlinedInput-root': {
            bgcolor: 'grey.50',
          },
        }}
      />
      <Stack direction="row" spacing={2} mt={1}>
        {job.model_used && (
          <Typography variant="caption" color="text.secondary">
            Model: <strong>{job.model_used}</strong>
          </Typography>
        )}
        {job.duration_seconds != null && (
          <Typography variant="caption" color="text.secondary">
            Audio duration: <strong>{job.duration_seconds.toFixed(1)}s</strong>
          </Typography>
        )}
      </Stack>
    </Box>
  )
}
