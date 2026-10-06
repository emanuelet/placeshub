import { beforeEach, describe, expect, it, vi } from 'vitest'

const key = `phm_${'00000000-0000-4000-8000-000000000001'.repeat(2)}`
const { getDb, activeKey, end } = vi.hoisted(() => ({
  getDb: vi.fn(),
  activeKey: vi.fn(),
  end: vi.fn(),
}))

vi.mock('../../../api/src/lib/db', () => ({ getDb }))

import { mcp } from '../../../api/src/routes/mcp'

const env = { DATABASE_URL: 'unused', SUPABASE_URL: 'unused', SUPABASE_KEY: 'unused' }

async function request(method: string, token?: string, origin?: string, args?: object) {
  return mcp.request(
    '/',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, ...(args ? { params: args } : {}) }),
    },
    env,
  )
}

async function message(response: Response) {
  const text = await response.text()
  const json = text.includes('data: ') ? text.split('data: ')[1]?.split('\n')[0] : text
  return JSON.parse(json ?? '')
}

describe('stateless MCP transport', () => {
  beforeEach(() => {
    activeKey.mockReset().mockReturnValue({ id: 'key-1', userId: 'user-1' })
    end.mockReset()
    getDb.mockReset().mockReturnValue({
      db: {
        update: () => ({
          set: () => ({
            where: () => ({
              returning: async () => {
                const found = activeKey()
                return found ? [found] : []
              },
            }),
          }),
        }),
      },
      client: { end },
    })
  })

  it('rejects missing, extension, revoked, and foreign-origin credentials before MCP execution', async () => {
    expect((await request('tools/list')).status).toBe(401)
    expect((await request('tools/list', 'phs_old-extension')).status).toBe(401)
    expect((await request('tools/list', key, 'https://attacker.example')).status).toBe(403)
    activeKey.mockReturnValue(null)
    expect((await request('tools/list', key)).status).toBe(401)
    expect(end).toHaveBeenCalledTimes(1)
  })

  it('lists tools on independent requests without a session ID', async () => {
    const initialized = await request('initialize', key, undefined, {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-agent', version: '1' },
    })
    expect(initialized.status).toBe(200)
    expect((await message(initialized)).result.serverInfo.name).toBe('placeshub')
    expect(initialized.headers.get('mcp-session-id')).toBeNull()
    const first = await request('tools/list', key, 'http://localhost')
    const second = await request('tools/list', key)
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(first.headers.get('mcp-session-id')).toBeNull()
    const tools = (await message(first)).result.tools.map((tool: { name: string }) => tool.name)
    expect(tools).toContain('bulk_save_places')
    expect(tools).toContain('bulk_update_saved_places')
    expect(tools).toContain('bulk_delete_saved_places')
    expect(tools).toContain('bulk_add_places_to_collection')
    expect(tools).toContain('bulk_remove_places_from_collection')
    expect(tools).toContain('add_place')
    expect(tools).toContain('update_place')
    expect((await message(second)).result.tools).toHaveLength(tools.length)
  })

  it('rejects invalid bulk input before accessing the place database', async () => {
    const response = await request('tools/call', key, undefined, {
      name: 'bulk_delete_saved_places',
      arguments: { savedPlaceIds: [] },
    })
    expect(response.status).toBe(200)
    expect((await message(response)).result.isError).toBe(true)
    expect(getDb).toHaveBeenCalledTimes(1) // key lookup only
  })

  it('executes an authenticated tool call and returns its result', async () => {
    const savedPlaceId = '10000000-0000-4000-8000-000000000001'
    getDb
      .mockImplementationOnce(() => ({
        client: { end },
        db: {
          update: () => ({
            set: () => ({ where: () => ({ returning: async () => [activeKey()] }) }),
          }),
        },
      }))
      .mockImplementationOnce(() => ({
        client: { end },
        db: {
          transaction: async (work: (tx: object) => Promise<unknown>) =>
            work({
              delete: () => ({ where: () => ({ returning: async () => [{ id: savedPlaceId }] }) }),
            }),
        },
      }))
    const response = await request('tools/call', key, undefined, {
      name: 'delete_saved_place',
      arguments: { savedPlaceId },
    })
    expect(response.status).toBe(200)
    expect((await message(response)).result.content[0].text).toBe('{"deletedCount":1}')
    expect(end).toHaveBeenCalledTimes(2)
  })
})
