import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock @mui/icons-material to avoid EMFILE on Windows — the barrel export
// opens thousands of files. Icons are decorative and don't affect test logic.
vi.mock('@mui/icons-material', () => ({
  AudioFile: (props: Record<string, unknown>) => vi.fn()({ ...props, 'data-testid': 'AudioFileIcon' }),
  ContentCopy: (props: Record<string, unknown>) => vi.fn()({ ...props, 'data-testid': 'ContentCopyIcon' }),
  Check: (props: Record<string, unknown>) => vi.fn()({ ...props, 'data-testid': 'CheckIcon' }),
}))
