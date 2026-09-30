import { mcpApiKeys } from '@placeshub/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../lib/db'
import { type AuthEnv, auth } from '../middleware/auth'

export async function hashMcpKey(token: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const keys = new Hono<AuthEnv>()
keys.use('/*', auth)

keys.get('/', async (c) => {
  const { db, client } = getDb(c.env.DATABASE_URL)
  try {
    const results = await db
      .select({
        id: mcpApiKeys.id,
        name: mcpApiKeys.name,
        createdAt: mcpApiKeys.createdAt,
        lastUsedAt: mcpApiKeys.lastUsedAt,
      })
      .from(mcpApiKeys)
      .where(and(eq(mcpApiKeys.userId, c.get('userId')), isNull(mcpApiKeys.revokedAt)))
      .orderBy(mcpApiKeys.createdAt)
    return c.json({ keys: results })
  } finally {
    await client.end()
  }
})

keys.post('/', async (c) => {
  const parsed = z
    .object({ name: z.string().trim().min(1).max(100) })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'name must be 1–100 characters' }, 400)
  const token = `phm_${crypto.randomUUID()}${crypto.randomUUID()}`
  const { db, client } = getDb(c.env.DATABASE_URL)
  try {
    const [key] = await db
      .insert(mcpApiKeys)
      .values({
        userId: c.get('userId'),
        name: parsed.data.name,
        tokenHash: await hashMcpKey(token),
      })
      .returning({ id: mcpApiKeys.id })
    return c.json({ id: key?.id, token }, 201)
  } finally {
    await client.end()
  }
})

keys.delete('/:id', async (c) => {
  if (!z.uuid().safeParse(c.req.param('id')).success) return c.json({ error: 'not found' }, 404)
  const { db, client } = getDb(c.env.DATABASE_URL)
  try {
    const [revoked] = await db
      .update(mcpApiKeys)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(mcpApiKeys.id, c.req.param('id')),
          eq(mcpApiKeys.userId, c.get('userId')),
          isNull(mcpApiKeys.revokedAt),
        ),
      )
      .returning({ id: mcpApiKeys.id })
    return revoked ? c.json({ success: true }) : c.json({ error: 'not found' }, 404)
  } finally {
    await client.end()
  }
})

export { keys as mcpKeys }
