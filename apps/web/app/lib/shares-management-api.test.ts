import { beforeEach, expect, it, vi } from 'vitest'
import { PgDialect } from '../../../api/node_modules/drizzle-orm/pg-core/index.js'

const { getDb, where, end, state } = vi.hoisted(() => ({
  getDb: vi.fn(),
  where: vi.fn(),
  end: vi.fn(),
  state: { owned: true },
}))
vi.mock('../../../api/src/lib/db', () => ({ getDb }))
vi.mock('../../../api/src/middleware/auth', () => ({
  auth: async (c: { set: (key: string, value: string) => void }, next: () => Promise<void>) => {
    c.set('userId', 'user-1')
    await next()
  },
}))

import { shares } from '../../../api/src/routes/shares'

const id = '10000000-0000-4000-8000-000000000001'
beforeEach(() => {
  state.owned = true
  where.mockReset()
  getDb.mockReset()
  end.mockReset()
  getDb.mockReturnValue({
    client: { end },
    db: {
      delete: () => ({
        where: (predicate: Parameters<PgDialect['sqlToQuery']>[0]) => {
          where(new PgDialect().sqlToQuery(predicate))
          return { returning: async () => (state.owned ? [{ id }] : []) }
        },
      }),
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: (predicate: Parameters<PgDialect['sqlToQuery']>[0]) => {
              where(new PgDialect().sqlToQuery(predicate))
              return { orderBy: async () => [] }
            },
          }),
        }),
      }),
    },
  })
})
it('restricts listing to the authenticated collection owner', async () => {
  const response = await shares.request('/', {}, { DATABASE_URL: 'unused' })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ shares: [] })
  expect(where.mock.calls[0][0].params).toContain('user-1')
  expect(where.mock.calls[0][0].sql).toContain('user_id')
})
it('enforces ownership in the delete itself and returns 404 for an unowned snapshot', async () => {
  state.owned = false
  const response = await shares.request(`/${id}`, { method: 'DELETE' }, { DATABASE_URL: 'unused' })
  expect(response.status).toBe(404)
  expect(where.mock.calls[0][0].params).toEqual([id, 'user-1'])
  expect(where.mock.calls[0][0].sql).toContain('EXISTS')
  expect(end).toHaveBeenCalledOnce()
})
it('rejects an invalid snapshot expiration before opening a database', async () => {
  const response = await shares.request(
    '/',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        collectionId: '10000000-0000-4000-8000-000000000001',
        expiresAt: 'not-a-date',
      }),
    },
    { DATABASE_URL: 'unused' },
  )
  expect(response.status).toBe(400)
  expect(getDb).not.toHaveBeenCalled()
})
it('deletes an owned snapshot and rejects malformed identifiers before opening a database', async () => {
  expect(
    (await shares.request(`/${id}`, { method: 'DELETE' }, { DATABASE_URL: 'unused' })).status,
  ).toBe(200)
  getDb.mockClear()
  expect(
    (await shares.request('/invalid', { method: 'DELETE' }, { DATABASE_URL: 'unused' })).status,
  ).toBe(404)
  expect(getDb).not.toHaveBeenCalled()
})
