import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

const { createShare } = vi.hoisted(() => ({ createShare: vi.fn() }))
vi.mock('@/hooks/useShares', () => ({
  useCreateShare: () => ({ mutateAsync: createShare, isPending: false, error: null }),
}))

import { SnapshotDialog } from './SnapshotDialog'

it('creates a snapshot that expires in three days', async () => {
  createShare.mockReset().mockResolvedValue({ share: { slug: 'trip-expiring' } })
  render(<SnapshotDialog collectionId="collection-1" onClose={vi.fn()} />)
  const now = Date.now()
  fireEvent.change(screen.getByLabelText('Expiration'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create snapshot' }))

  await waitFor(() =>
    expect(createShare).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionId: 'collection-1',
        expiresAt: expect.any(String),
      }),
    ),
  )
  const expiresAt = new Date(createShare.mock.calls[0]?.[0].expiresAt ?? '').getTime()
  expect(expiresAt).toBeGreaterThanOrEqual(now + 3 * 86_400_000)
  expect(expiresAt).toBeLessThan(now + 3 * 86_400_000 + 1_000)
})
