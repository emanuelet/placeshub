import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDb, end, values, revokeWhere } = vi.hoisted(() => ({
  getDb: vi.fn(),
  end: vi.fn(),
  values: vi.fn(),
  revokeWhere: vi.fn(),
}))

vi.mock('../../../api/src/lib/db', () => ({ getDb }))
vi.mock('../../../api/src/middleware/auth', () => ({
  auth: async (c: { set: (key: string, value: string) => void }, next: () => Promise<void>) => {
    c.set('userId', 'user-1')
    await next()
  },
}))

import { mcpKeys } from '../../../api/src/routes/mcp-keys'

describe('MCP key management', () => {
  beforeEach(() => {
    values.mockReset()
    end.mockReset()
    revokeWhere.mockReset()
    getDb.mockReturnValue({
      client: { end },
      db: {
        insert: () => ({
          values: (value: unknown) => {
            values(value)
            return { returning: async () => [{ id: 'key-id' }] }
          },
        }),
        select: () => ({
          from: () => ({
            where: () => ({ orderBy: async () => [{ id: 'key-id', name: 'Agent' }] }),
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => {
              revokeWhere()
              return { returning: async () => [{ id: 'key-id' }] }
            },
          }),
        }),
      },
    })
  })

  it('issues one-time phm_ keys and stores only a hash tied to the signed-in user', async () => {
    const response = await mcpKeys.request(
      '/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Agent' }),
      },
      { DATABASE_URL: 'unused' },
    )
    expect(response.status).toBe(201)
    const { token } = (await response.json()) as { token: string }
    expect(token).toMatch(/^phm_[0-9a-f-]{72}$/)
    expect(values).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Agent',
      tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    })
    expect(values.mock.calls[0]?.[0].tokenHash).not.toBe(token)
    expect(await (await mcpKeys.request('/', {}, { DATABASE_URL: 'unused' })).json()).toEqual({
      keys: [{ id: 'key-id', name: 'Agent' }],
    })
    expect(end).toHaveBeenCalledTimes(2)
  })

  it('rejects blank names and non-UUID revocations before DB access', async () => {
    const invalid = await mcpKeys.request(
      '/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ' ' }),
      },
      { DATABASE_URL: 'unused' },
    )
    expect(invalid.status).toBe(400)
    expect(
      (await mcpKeys.request('/not-an-id', { method: 'DELETE' }, { DATABASE_URL: 'unused' }))
        .status,
    ).toBe(404)
    expect(getDb).not.toHaveBeenCalled()
    expect(revokeWhere).not.toHaveBeenCalled()
  })
})
