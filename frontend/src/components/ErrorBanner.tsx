import { Alert } from '@mui/material'

interface Props {
  message: string
  onDismiss: () => void
}

export function ErrorBanner({ message, onDismiss }: Props) {
  return (
    <Alert severity="error" onClose={onDismiss} sx={{ mt: 2 }}>
      {message}
    </Alert>
  )
}
