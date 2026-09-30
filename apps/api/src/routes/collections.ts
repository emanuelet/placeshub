import {
  collectionPlaces,
  collections,
  places,
  savedPlaces,
  syncedLists,
} from '@placeshub/db/schema'
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { getDb } from '../lib/db'
import { type AuthEnv, auth } from '../middleware/auth'

const collectionsRouter = new Hono<AuthEnv>()
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Transaction = Parameters<Parameters<ReturnType<typeof getDb>['db']['transaction']>[0]>[0]

async function manualCollection(tx: Transaction, id: string, userId: string) {
  if (!uuidPattern.test(id)) return { error: 'collection not found' as const, status: 404 as const }
  const [collection] = await tx
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId)))
    .for('update')
  if (!collection) return { error: 'collection not found' as const, status: 404 as const }
  const [synced] = await tx
    .select({ id: syncedLists.id })
    .from(syncedLists)
    .where(eq(syncedLists.collectionId, id))
    .limit(1)
  if (synced)
    return { error: 'Google-synced collections cannot be edited' as const, status: 403 as const }
  return null
}

collectionsRouter.use('/*', auth)

collectionsRouter.get('/', async (c) => {
  const userId = c.get('userId')
  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const results = await db
      .select({
        id: collections.id,
        userId: collections.userId,
        title: collections.title,
        description: collections.description,
        slug: collections.slug,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
        syncedFromGoogle: isNotNull(syncedLists.id),
      })
      .from(collections)
      .leftJoin(syncedLists, eq(syncedLists.collectionId, collections.id))
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

  const slug = `${
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'collection'
  }-${crypto.randomUUID()}`

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
  if (!uuidPattern.test(id)) return c.json({ error: 'not found' }, 404)

  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const [collection] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))

    if (!collection) {
      return c.json({ error: 'not found' }, 404)
    }

    const [syncedList] = await db
      .select({ id: syncedLists.id })
      .from(syncedLists)
      .where(and(eq(syncedLists.collectionId, id), eq(syncedLists.userId, userId)))
      .limit(1)

    const collectionPlacesList = await db
      .select({
        sortOrder: collectionPlaces.sortOrder,
        notes: collectionPlaces.notes,
        savedPlaceId: savedPlaces.id,
        personalNotes: savedPlaces.notes,
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
          metadata: places.metadata,
        },
      })
      .from(collectionPlaces)
      .innerJoin(places, eq(collectionPlaces.placeId, places.id))
      .leftJoin(
        savedPlaces,
        and(eq(savedPlaces.placeId, places.id), eq(savedPlaces.userId, userId)),
      )
      .where(eq(collectionPlaces.collectionId, id))
      .orderBy(collectionPlaces.sortOrder)

    return c.json({
      collection: { ...collection, syncedFromGoogle: !!syncedList },
      places: collectionPlacesList,
    })
  } finally {
    await client.end()
  }
})

collectionsRouter.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const body = await c.req.json()
  if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim())) {
    return c.json({ error: 'title must be a nonempty string' }, 400)
  }
  if (
    body.description !== undefined &&
    body.description !== null &&
    typeof body.description !== 'string'
  ) {
    return c.json({ error: 'description must be a string or null' }, 400)
  }

  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const result = await db.transaction(async (tx) => {
      const error = await manualCollection(tx, id, userId)
      if (error) return error
      const [collection] = await tx
        .update(collections)
        .set({
          ...(body.title !== undefined ? { title: body.title.trim() } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          updatedAt: new Date(),
        })
        .where(eq(collections.id, id))
        .returning()
      return { collection }
    })
    if ('error' in result) return c.json({ error: result.error }, result.status)
    return c.json(result)
  } finally {
    await client.end()
  }
})

collectionsRouter.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const result = await db.transaction(async (tx) => {
      const error = await manualCollection(tx, id, userId)
      if (error) return error
      await tx.delete(collections).where(eq(collections.id, id))
      return { success: true }
    })
    if ('error' in result) return c.json({ error: result.error }, result.status)
    return c.json(result)
  } finally {
    await client.end()
  }
})

collectionsRouter.post('/:id/places', async (c) => {
  const userId = c.get('userId')
  const collectionId = c.req.param('id')
  const body = await c.req.json()
  const { placeId, sortOrder } = body

  if (typeof placeId !== 'string' || !uuidPattern.test(placeId)) {
    return c.json({ error: 'placeId must be a UUID' }, 400)
  }

  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const result = await db.transaction(async (tx) => {
      const error = await manualCollection(tx, collectionId, userId)
      if (error) return error
      const [place] = await tx
        .select({ id: savedPlaces.id })
        .from(savedPlaces)
        .where(and(eq(savedPlaces.placeId, placeId), eq(savedPlaces.userId, userId)))
        .limit(1)
      if (!place) return { error: 'saved place not found' as const, status: 404 as const }
      const [cp] = await tx
        .insert(collectionPlaces)
        .values({ collectionId, placeId, sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0 })
        .onConflictDoNothing({ target: [collectionPlaces.collectionId, collectionPlaces.placeId] })
        .returning()
      const collectionPlace =
        cp ??
        (
          await tx
            .select()
            .from(collectionPlaces)
            .where(
              and(
                eq(collectionPlaces.collectionId, collectionId),
                eq(collectionPlaces.placeId, placeId),
              ),
            )
            .limit(1)
        )[0]
      return { collectionPlace }
    })
    if ('error' in result) return c.json({ error: result.error }, result.status)
    return c.json(result, 201)
  } finally {
    await client.end()
  }
})

collectionsRouter.delete('/:id/places/:placeId', async (c) => {
  const userId = c.get('userId')
  const collectionId = c.req.param('id')
  const placeId = c.req.param('placeId')
  if (!uuidPattern.test(placeId)) return c.json({ error: 'placeId must be a UUID' }, 400)

  const { db, client } = getDb(c.env.DATABASE_URL)

  try {
    const result = await db.transaction(async (tx) => {
      const error = await manualCollection(tx, collectionId, userId)
      if (error) return error
      const deleted = await tx
        .delete(collectionPlaces)
        .where(
          and(
            eq(collectionPlaces.collectionId, collectionId),
            eq(collectionPlaces.placeId, placeId),
          ),
        )
        .returning({ id: collectionPlaces.id })
      if (!deleted.length) return { error: 'not found' as const, status: 404 as const }
      return { success: true }
    })
    if ('error' in result) return c.json({ error: result.error }, result.status)
    return c.json(result)
  } finally {
    await client.end()
  }
})

collectionsRouter.post('/:id/places/move', async (c) => {
  const userId = c.get('userId')
  const collectionId = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const targetCollectionId = body?.targetCollectionId
  if (
    !uuidPattern.test(collectionId) ||
    typeof targetCollectionId !== 'string' ||
    !uuidPattern.test(targetCollectionId) ||
    targetCollectionId === collectionId ||
    !Array.isArray(body?.placeIds) ||
    body.placeIds.length < 1 ||
    body.placeIds.length > 3000 ||
    !body.placeIds.every((id: unknown) => typeof id === 'string' && uuidPattern.test(id))
  ) {
    return c.json({ error: 'Provide a different manual collection and 1–3000 place IDs' }, 400)
  }
  const placeIds: string[] = [...new Set(body.placeIds as string[])]
  const { db, client } = getDb(c.env.DATABASE_URL)
  try {
    const result = await db.transaction(async (tx) => {
      // Lock collections in a stable order so concurrent moves in opposite directions cannot deadlock.
      for (const id of [collectionId, targetCollectionId].sort()) {
        const error = await manualCollection(tx, id, userId)
        if (error) return error
      }
      const sourceRows = await tx
        .select({
          placeId: collectionPlaces.placeId,
          notes: collectionPlaces.notes,
        })
        .from(collectionPlaces)
        .where(
          and(
            eq(collectionPlaces.collectionId, collectionId),
            inArray(collectionPlaces.placeId, placeIds),
          ),
        )
        .orderBy(collectionPlaces.sortOrder)
        .for('update')
      if (sourceRows.length !== placeIds.length) {
        return { error: 'places not found in collection' as const, status: 404 as const }
      }
      const [last] = await tx
        .select({ sortOrder: sql<number>`COALESCE(MAX(${collectionPlaces.sortOrder}), -1)` })
        .from(collectionPlaces)
        .where(eq(collectionPlaces.collectionId, targetCollectionId))
      const added = await tx
        .insert(collectionPlaces)
        .values(
          sourceRows.map((row, index) => ({
            collectionId: targetCollectionId,
            placeId: row.placeId,
            notes: row.notes,
            sortOrder: (last?.sortOrder ?? -1) + index + 1,
          })),
        )
        .onConflictDoNothing({ target: [collectionPlaces.collectionId, collectionPlaces.placeId] })
        .returning({ placeId: collectionPlaces.placeId })
      await tx
        .delete(collectionPlaces)
        .where(
          and(
            eq(collectionPlaces.collectionId, collectionId),
            inArray(collectionPlaces.placeId, placeIds),
          ),
        )
      return { movedCount: sourceRows.length, addedCount: added.length }
    })
    if ('error' in result) return c.json({ error: result.error }, result.status)
    return c.json(result)
  } finally {
    await client.end()
  }
})

collectionsRouter.post('/:id/places/bulk-remove', async (c) => {
  const userId = c.get('userId')
  const collectionId = c.req.param('id')
  const body = await c.req.json()
  if (
    !Array.isArray(body.placeIds) ||
    body.placeIds.length > 100 ||
    !body.placeIds.every((id: unknown) => typeof id === 'string' && uuidPattern.test(id))
  ) {
    return c.json({ error: 'placeIds must be an array of at most 100 UUIDs' }, 400)
  }
  const placeIds: string[] = [...new Set(body.placeIds as string[])]
  const { db, client } = getDb(c.env.DATABASE_URL)
  try {
    const result = await db.transaction(async (tx) => {
      const error = await manualCollection(tx, collectionId, userId)
      if (error) return error
      if (!placeIds.length) return { removedCount: 0 }
      const removed = await tx
        .delete(collectionPlaces)
        .where(
          and(
            eq(collectionPlaces.collectionId, collectionId),
            inArray(collectionPlaces.placeId, placeIds),
          ),
        )
        .returning({ id: collectionPlaces.id })
      return { removedCount: removed.length }
    })
    if ('error' in result) return c.json({ error: result.error }, result.status)
    return c.json(result)
  } finally {
    await client.end()
  }
})

export { collectionsRouter as collections }
