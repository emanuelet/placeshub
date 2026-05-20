import { collectionPlaces, collections, places } from '@placeshub/db/schema'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { getDb } from '../lib/db'
import { type AuthEnv, auth } from '../middleware/auth'

const collectionsRouter = new Hono<AuthEnv>()

collectionsRouter.use('/*', auth)

collectionsRouter.get('/', async (c) => {
  const userId = c.get('userId')
  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const results = await db
      .select()
      .from(collections)
      .where(eq(collections.userId, userId))
      .orderBy(collections.createdAt)

    return c.json({ collections: results })
  } finally {
    await client.end()
  }
})

collectionsRouter.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()
  const { title, description } = body

  if (!title) {
    return c.json({ error: 'title is required' }, 400)
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const [collection] = await db
      .insert(collections)
      .values({ userId, title, description, slug })
      .returning()

    return c.json({ collection }, 201)
  } finally {
    await client.end()
  }
})

collectionsRouter.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const [collection] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))

    if (!collection) {
      return c.json({ error: 'not found' }, 404)
    }

    const collectionPlacesList = await db
      .select({
        sortOrder: collectionPlaces.sortOrder,
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
      .from(collectionPlaces)
      .innerJoin(places, eq(collectionPlaces.placeId, places.id))
      .where(eq(collectionPlaces.collectionId, id))
      .orderBy(collectionPlaces.sortOrder)

    return c.json({ collection, places: collectionPlacesList })
  } finally {
    await client.end()
  }
})

collectionsRouter.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const body = await c.req.json()

  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const [updated] = await db
      .update(collections)
      .set({
        title: body.title,
        description: body.description,
        updatedAt: new Date(),
      })
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .returning()

    if (!updated) {
      return c.json({ error: 'not found' }, 404)
    }

    return c.json({ collection: updated })
  } finally {
    await client.end()
  }
})

collectionsRouter.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const deleted = await db
      .delete(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .returning()

    if (deleted.length === 0) {
      return c.json({ error: 'not found' }, 404)
    }

    return c.json({ success: true })
  } finally {
    await client.end()
  }
})

collectionsRouter.post('/:id/places', async (c) => {
  const userId = c.get('userId')
  const collectionId = c.req.param('id')
  const body = await c.req.json()
  const { placeId, sortOrder } = body

  if (!placeId) {
    return c.json({ error: 'placeId is required' }, 400)
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

    const [cp] = await db
      .insert(collectionPlaces)
      .values({ collectionId, placeId, sortOrder: sortOrder ?? 0 })
      .returning()

    return c.json({ collectionPlace: cp }, 201)
  } finally {
    await client.end()
  }
})

collectionsRouter.delete('/:id/places/:placeId', async (c) => {
  const userId = c.get('userId')
  const collectionId = c.req.param('id')
  const placeId = c.req.param('placeId')

  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const collectionResult = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))

    if (collectionResult.length === 0) {
      return c.json({ error: 'collection not found' }, 404)
    }

    const deleted = await db
      .delete(collectionPlaces)
      .where(
        and(eq(collectionPlaces.collectionId, collectionId), eq(collectionPlaces.placeId, placeId)),
      )
      .returning()

    if (deleted.length === 0) {
      return c.json({ error: 'not found' }, 404)
    }

    return c.json({ success: true })
  } finally {
    await client.end()
  }
})

export { collectionsRouter as collections }
