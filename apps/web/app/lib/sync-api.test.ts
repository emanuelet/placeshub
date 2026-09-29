import { beforeEach, describe, expect, it, vi } from 'vitest'

const { transaction, connection } = vi.hoisted(() => ({
  transaction: vi.fn(),
  connection: { current: { id: 'connection-1', userId: 'user-1' } as object | null },
}))

vi.mock('../../../api/src/lib/db', () => ({
  getDb: () => ({
    db: {
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => (connection.current ? [connection.current] : []) }),
        }),
      }),
      update: () => ({ set: () => ({ where: async () => [] }) }),
      transaction,
    },
    client: { end: async () => {} },
  }),
}))

import { sync } from '../../../api/src/routes/sync'

const place = { sourcePlaceId: 'maps:cid:1:2', name: 'Cafe', lat: 1, lng: 2 }

async function submit(snapshot: object) {
  return sync.request(
    '/snapshots',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer phs_test', 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    },
    { DATABASE_URL: 'unused' },
  )
}

describe('sync snapshot validation', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { subtle: { digest: async () => new Uint8Array(32).buffer } })
    transaction.mockReset()
    connection.current = { id: 'connection-1', userId: 'user-1' }
  })

  it('rejects an incomplete snapshot before any reconciliation transaction', async () => {
    const response = await submit({
      sourceListId: 'list-1',
      title: 'Want to go',
      complete: true,
      expectedCount: 2,
      places: [place],
    })
    expect(response.status).toBe(400)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects duplicate place identities before any removals', async () => {
    const response = await submit({
      sourceListId: 'list-1',
      title: 'Want to go',
      complete: true,
      expectedCount: 2,
      places: [place, place],
    })
    expect(response.status).toBe(400)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('does not accept a revoked or unknown extension key', async () => {
    connection.current = null
    const response = await submit({
      sourceListId: 'list-1',
      title: 'Want to go',
      complete: true,
      expectedCount: 1,
      places: [place],
    })
    expect(response.status).toBe(401)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('accepts a complete place snapshot with a real Place ID and rich details', async () => {
    transaction.mockResolvedValue({ imported: 1, removed: 0, collectionId: 'collection-1' })
    const response = await submit({
      sourceListId: 'list-1',
      title: 'Want to go',
      complete: true,
      expectedCount: 1,
      places: [
        {
          ...place,
          placeId: 'ChIJexamplePlaceID12345',
          rating: 4.7,
          phone: '123456789',
          website: 'https://example.com',
          metadata: {
            reviewCount: 166,
            category: ['Cafe'],
            hours: [{ day: 'Monday', hours: 'Closed' }],
          },
        },
      ],
    })
    expect(response.status).toBe(200)
    expect(transaction).toHaveBeenCalledOnce()
  })
})
