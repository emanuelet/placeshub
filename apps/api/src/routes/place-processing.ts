import { placeEnrichmentJobs, places, savedPlaces } from '@placeshub/db/schema'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../lib/db'
import { type AuthEnv, auth } from '../middleware/auth'

const router = new Hono<AuthEnv>()
const statusSchema = z.enum(['pending', 'resolving', 'details', 'ambiguous', 'unmatched', 'failed', 'skipped', 'completed'])

function pacificDay() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`
}

router.use('/*', auth)

router.get('/', async (c) => {
  const userId = c.get('userId')
  const status = statusSchema.safeParse(c.req.query('status'))
  const { db, client } = getDb(c.env.DATABASE_URL)
  try {
    const where = [eq(savedPlaces.userId, userId)]
    if (status.success) where.push(eq(placeEnrichmentJobs.status, status.data))
    const jobs = await db.select({ id: placeEnrichmentJobs.id, status: placeEnrichmentJobs.status, candidates: placeEnrichmentJobs.candidates, attempts: placeEnrichmentJobs.attempts, lastError: placeEnrichmentJobs.lastError, nextAttemptAt: placeEnrichmentJobs.nextAttemptAt, updatedAt: placeEnrichmentJobs.updatedAt, place: { id: places.id, name: places.name, googlePlaceId: places.googlePlaceId, lat: places.lat, lng: places.lng, address: places.address } }).from(placeEnrichmentJobs).innerJoin(places, eq(placeEnrichmentJobs.placeId, places.id)).innerJoin(savedPlaces, eq(savedPlaces.placeId, places.id)).where(and(...where)).orderBy(desc(placeEnrichmentJobs.updatedAt)).limit(200)
    const counts = Object.fromEntries((await db.select({ status: placeEnrichmentJobs.status, count: sql<number>`count(*)::int` }).from(placeEnrichmentJobs).innerJoin(savedPlaces, eq(savedPlaces.placeId, placeEnrichmentJobs.placeId)).where(eq(savedPlaces.userId, userId)).groupBy(placeEnrichmentJobs.status)).map((row) => [row.status, row.count]))
    const [usage] = await db.execute(sql<{ attempts: number; next_request_at: Date }>`SELECT attempts, next_request_at FROM google_request_usage WHERE day = ${pacificDay()}::date`)
    return c.json({ jobs, counts, usage: { attempts: usage?.attempts ?? 0, dailyLimit: 1000, target: 900, nextRequestAt: usage?.next_request_at ?? null } })
  } finally { await client.end() }
})

router.post('/:id/retry', async (c) => {
  const userId = c.get('userId')
  const { db, client } = getDb(c.env.DATABASE_URL)
  try {
    const [job] = await db.select({ id: placeEnrichmentJobs.id }).from(placeEnrichmentJobs).innerJoin(savedPlaces, eq(savedPlaces.placeId, placeEnrichmentJobs.placeId)).where(and(eq(placeEnrichmentJobs.id, c.req.param('id')), eq(savedPlaces.userId, userId))).limit(1)
    if (!job) return c.json({ error: 'not found' }, 404)
    await db.update(placeEnrichmentJobs).set({ status: 'pending', attempts: 0, lastError: null, nextAttemptAt: new Date(), updatedAt: new Date() }).where(eq(placeEnrichmentJobs.id, job.id))
    return c.json({ success: true })
  } finally { await client.end() }
})

router.post('/:id/select-candidate', async (c) => {
  const parsed = z.object({ googlePlaceId: z.string().trim().min(1).max(250) }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'googlePlaceId is required' }, 400)
  const userId = c.get('userId')
  const { db, client } = getDb(c.env.DATABASE_URL)
  try {
    const [job] = await db.select({ id: placeEnrichmentJobs.id, candidates: placeEnrichmentJobs.candidates }).from(placeEnrichmentJobs).innerJoin(savedPlaces, eq(savedPlaces.placeId, placeEnrichmentJobs.placeId)).where(and(eq(placeEnrichmentJobs.id, c.req.param('id')), eq(savedPlaces.userId, userId), eq(placeEnrichmentJobs.status, 'ambiguous'))).limit(1)
    const candidates = Array.isArray(job?.candidates) ? job.candidates : []
    if (!job || !candidates.some((candidate) => typeof candidate === 'object' && candidate !== null && (candidate as { googlePlaceId?: unknown }).googlePlaceId === parsed.data.googlePlaceId)) return c.json({ error: 'candidate not found' }, 404)
    await db.update(placeEnrichmentJobs).set({ status: 'details', resolvedGooglePlaceId: parsed.data.googlePlaceId, lastError: null, nextAttemptAt: new Date(), updatedAt: new Date() }).where(eq(placeEnrichmentJobs.id, job.id))
    return c.json({ success: true })
  } finally { await client.end() }
})

router.post('/:id/skip', async (c) => {
  const userId = c.get('userId')
  const { db, client } = getDb(c.env.DATABASE_URL)
  try {
    const [job] = await db.select({ id: placeEnrichmentJobs.id }).from(placeEnrichmentJobs).innerJoin(savedPlaces, eq(savedPlaces.placeId, placeEnrichmentJobs.placeId)).where(and(eq(placeEnrichmentJobs.id, c.req.param('id')), eq(savedPlaces.userId, userId))).limit(1)
    if (!job) return c.json({ error: 'not found' }, 404)
    await db.update(placeEnrichmentJobs).set({ status: 'skipped', completedAt: new Date(), updatedAt: new Date() }).where(eq(placeEnrichmentJobs.id, job.id))
    return c.json({ success: true })
  } finally { await client.end() }
})

export { router as placeProcessing }
