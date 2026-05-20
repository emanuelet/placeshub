import { places, savedPlaces } from '@placeshub/db/schema'
import { and, eq, ilike } from 'drizzle-orm'
import { Hono } from 'hono'
import { getDb } from '../lib/db'
import { type AuthEnv, auth } from '../middleware/auth'

const placesRouter = new Hono<AuthEnv>()

placesRouter.use('/*', auth)

placesRouter.get('/search', async (c) => {
  const query = c.req.query('q')
  if (!query) {
    return c.json({ places: [] })
  }

  const { db, client } = getDb(c.env.DATABASE_URL)
  try {
    const results = await db
      .select()
      .from(places)
      .where(ilike(places.name, `%${query}%`))
      .limit(20)

    return c.json({ places: results })
  } finally {
    await client.end()
  }
})

placesRouter.get('/', async (c) => {
  const userId = c.get('userId')
  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const results = await db
      .select({
        id: savedPlaces.id,
        notes: savedPlaces.notes,
        tags: savedPlaces.tags,
        createdAt: savedPlaces.createdAt,
        place: {
          id: places.id,
          googlePlaceId: places.googlePlaceId,
          name: places.name,
          lat: places.lat,
          lng: places.lng,
          address: places.address,
          googleMapsUri: places.googleMapsUri,
          types: places.types,
          phone: places.phone,
          website: places.website,
          rating: places.rating,
        },
      })
      .from(savedPlaces)
      .innerJoin(places, eq(savedPlaces.placeId, places.id))
      .where(eq(savedPlaces.userId, userId))
      .orderBy(savedPlaces.createdAt)

    return c.json({ savedPlaces: results })
  } finally {
    await client.end()
  }
})

placesRouter.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()
  const {
    googlePlaceId,
    name,
    lat,
    lng,
    address,
    googleMapsUri,
    types,
    phone,
    website,
    rating,
    notes,
    tags,
  } = body

  if (!googlePlaceId || !name) {
    return c.json({ error: 'googlePlaceId and name are required' }, 400)
  }

  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    let placeResult = await db
      .select()
      .from(places)
      .where(eq(places.googlePlaceId, googlePlaceId))
      .limit(1)

    if (placeResult.length === 0) {
      const [newPlace] = await db
        .insert(places)
        .values({
          googlePlaceId,
          name,
          lat,
          lng,
          address,
          googleMapsUri,
          types,
          phone,
          website,
          rating,
        })
        .returning()
      if (!newPlace) {
        return c.json({ error: 'failed to create place' }, 500)
      }
      placeResult = [newPlace]
    }

    const existingPlace = placeResult[0]
    if (!existingPlace) {
      return c.json({ error: 'failed to create place' }, 500)
    }

    const [savedPlace] = await db
      .insert(savedPlaces)
      .values({
        userId,
        placeId: existingPlace.id,
        notes: notes ?? null,
        tags: tags ?? [],
      })
      .onConflictDoNothing()
      .returning()

    return c.json({ savedPlace }, 201)
  } finally {
    await client.end()
  }
})

placesRouter.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const body = await c.req.json()

  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const [updated] = await db
      .update(savedPlaces)
      .set({ notes: body.notes, tags: body.tags })
      .where(and(eq(savedPlaces.id, id), eq(savedPlaces.userId, userId)))
      .returning()

    if (!updated) {
      return c.json({ error: 'not found' }, 404)
    }

    return c.json({ savedPlace: updated })
  } finally {
    await client.end()
  }
})

placesRouter.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const deleted = await db
      .delete(savedPlaces)
      .where(and(eq(savedPlaces.id, id), eq(savedPlaces.userId, userId)))
      .returning()

    if (deleted.length === 0) {
      return c.json({ error: 'not found' }, 404)
    }

    return c.json({ success: true })
  } finally {
    await client.end()
  }
})

export { placesRouter as places }
