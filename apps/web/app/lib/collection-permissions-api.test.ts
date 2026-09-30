import { beforeEach, describe, expect, it, vi } from 'vitest'

const { insert, update, remove } = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('../../../api/src/middleware/auth', () => ({
  auth: async (c: { set: (name: string, value: string) => void }, next: () => Promise<void>) => {
    c.set('userId', 'user-1')
    await next()
  },
}))

vi.mock('../../../api/src/lib/db', () => ({
  getDb: () => {
    const tx = {
      select: () => ({
        from: () => ({
          where: () => ({
            for: async () => [{ id: 'collection-1' }],
            limit: async () => [{ id: 'synced-list-1' }],
          }),
        }),
      }),
      insert,
      update,
      delete: remove,
    }
    type FakeTx = typeof tx
    return {
      db: { transaction: async (fn: (transaction: FakeTx) => Promise<object>) => fn(tx) },
      client: { end: async () => {} },
    }
  },
}))

import { collections } from '../../../api/src/routes/collections'

const id = '10000000-0000-4000-8000-000000000001'
const targetId = '30000000-0000-4000-8000-000000000003'
const placeId = '20000000-0000-4000-8000-000000000002'

async function request(path: string, method: string, body?: object) {
  return collections.request(
    path,
    {
      method,
      ...(body
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        : {}),
    },
    { DATABASE_URL: 'unused' },
  )
}

describe('Google-synced collection protection', () => {
  beforeEach(() => {
    insert.mockReset()
    update.mockReset()
    remove.mockReset()
  })

  it.each([
    ['PATCH', `/${id}`, { title: 'Rename' }],
    ['DELETE', `/${id}`, undefined],
    ['POST', `/${id}/places`, { placeId }],
    ['DELETE', `/${id}/places/${placeId}`, undefined],
    ['POST', `/${id}/places/bulk-remove`, { placeIds: [placeId] }],
    ['POST', `/${id}/places/move`, { placeIds: [placeId], targetCollectionId: targetId }],
  ])('rejects %s %s without mutating records', async (method, path, body) => {
    const response = await request(path, method, body)
    expect(response.status).toBe(403)
    expect(insert).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })
})
