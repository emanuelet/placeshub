import { collectionPlaces, collections, places, shares } from '@placeshub/db/schema'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { getDb } from '../lib/db'
import { type AuthEnv, auth } from '../middleware/auth'

const sharesRouter = new Hono<AuthEnv>()

sharesRouter.post('/', auth, async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()
  const { collectionId, includeNotes = false } = body

  if (!collectionId) {
    return c.json({ error: 'collectionId is required' }, 400)
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
        entry.notes = cp.place.metadata
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
