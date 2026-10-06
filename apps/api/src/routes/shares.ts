import { collectionPlaces, collections, places, shares } from '@placeshub/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../lib/db'
import { type AuthEnv, auth } from '../middleware/auth'

const sharesRouter = new Hono<AuthEnv>()
const createShareSchema = z.object({
  collectionId: z.uuid(),
  includeNotes: z.boolean().optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
})

sharesRouter.get('/', auth, async (c) => {
  const { db, client } = getDb(c.env.DATABASE_URL)
  try {
    const results = await db
      .select({
        id: shares.id,
        collectionId: shares.collectionId,
        collectionTitle: collections.title,
        slug: shares.slug,
        includeNotes: shares.includeNotes,
        createdAt: shares.createdAt,
        expiresAt: shares.expiresAt,
        placeCount: sql<number>`jsonb_array_length(${shares.placesSnapshot})`,
      })
      .from(shares)
      .innerJoin(collections, eq(shares.collectionId, collections.id))
      .where(eq(collections.userId, c.get('userId')))
      .orderBy(desc(shares.createdAt))
    return c.json({ shares: results })
  } finally {
    await client.end()
  }
})

sharesRouter.delete('/:id', auth, async (c) => {
  const id = c.req.param('id')
  if (!z.uuid().safeParse(id).success) return c.json({ error: 'share not found' }, 404)
  const { db, client } = getDb(c.env.DATABASE_URL)
  try {
    const [deleted] = await db
      .delete(shares)
      .where(
        and(
          eq(shares.id, id),
          sql`EXISTS (
      SELECT 1 FROM collections c WHERE c.id = ${shares.collectionId} AND c.user_id = ${c.get('userId')}
    )`,
        ),
      )
      .returning({ id: shares.id })
    return deleted ? c.json({ success: true }) : c.json({ error: 'share not found' }, 404)
  } finally {
    await client.end()
  }
})

sharesRouter.post('/', auth, async (c) => {
  const userId = c.get('userId')
  const parsed = createShareSchema.safeParse(await c.req.json())
  if (!parsed.success) return c.json({ error: 'invalid snapshot request' }, 400)
  const { collectionId, includeNotes = false, expiresAt = null } = parsed.data
  const expiration = expiresAt ? new Date(expiresAt) : null
  if (expiration && expiration <= new Date()) {
    return c.json({ error: 'expiration must be in the future' }, 400)
  }

  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const collectionResult = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))

    if (collectionResult.length === 0) {
      return c.json({ error: 'collection not found' }, 404)
    }

    const collectionPlacesList = await db
      .select({
        place: places,
        sortOrder: collectionPlaces.sortOrder,
        notes: collectionPlaces.notes,
      })
      .from(collectionPlaces)
      .innerJoin(places, eq(collectionPlaces.placeId, places.id))
      .where(eq(collectionPlaces.collectionId, collectionId))
      .orderBy(collectionPlaces.sortOrder)

    const placesSnapshot = collectionPlacesList.map((cp) => {
      const entry: Record<string, unknown> = {
        id: cp.place.id,
        name: cp.place.name,
        lat: cp.place.lat,
        lng: cp.place.lng,
        address: cp.place.address,
        googleMapsUri: cp.place.googleMapsUri,
        rating: cp.place.rating,
      }
      if (includeNotes) {
        entry.notes = cp.notes
      }
      return entry
    })

    const collection = collectionResult[0]
    if (!collection) {
      return c.json({ error: 'collection not found' }, 404)
    }

    const slug = `${collection.slug}-${Date.now().toString(36)}`

    const [share] = await db
      .insert(shares)
      .values({
        collectionId,
        slug,
        includeNotes,
        expiresAt: expiration,
        placesSnapshot,
      })
      .returning()

    return c.json({ share }, 201)
  } finally {
    await client.end()
  }
})

sharesRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug')

  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const [share] = await db.select().from(shares).where(eq(shares.slug, slug))

    if (!share) {
      return c.json({ error: 'share not found' }, 404)
    }

    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return c.json({ error: 'share expired' }, 410)
    }

    return c.json({ share })
  } finally {
    await client.end()
  }
})

export { sharesRouter as shares }
