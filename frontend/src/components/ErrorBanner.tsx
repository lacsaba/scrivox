interface Props {
  message: string
  onDismiss: () => void
}

export function ErrorBanner({ message, onDismiss }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: '#fee2e2',
        border: '1px solid #fca5a5',
        color: '#991b1b',
        marginTop: '16px',
      }}
    >
      <span style={{ flex: 1, fontSize: '0.9rem' }}>{message}</span>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#991b1b',
          fontSize: '1.1rem',
          lineHeight: 1,
          padding: 0,
        }}
        aria-label="Dismiss error"
      >
        ×
      </button>
    </div>
  )
}
