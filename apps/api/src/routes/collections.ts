import {
  collectionPlaces,
  collections,
  placeEnrichmentJobs,
  placeSourceKeys,
  places,
  savedPlaces,
  syncedLists,
} from '@placeshub/db/schema'
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../lib/db'
import { type AuthEnv, auth } from '../middleware/auth'

const collectionsRouter = new Hono<AuthEnv>()
const importSchema = z.object({
  title: z.string().trim().min(1).max(200),
  places: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(500),
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
        notes: z.string().max(5000).nullable(),
      }),
    )
    .min(1)
    .max(3000),
})

async function importPlaceKey(name: string, lat: number, lng: number) {
  const data = new TextEncoder().encode(JSON.stringify([name.toLowerCase(), lat, lng]))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  return `mymaps:${Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

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

collectionsRouter.post('/import', async (c) => {
  if (Number(c.req.header('content-length')) > 8 * 1024 * 1024) {
    return c.json({ error: 'Import is too large (maximum 8 MB)' }, 413)
  }
  const raw = await c.req.text()
  if (new TextEncoder().encode(raw).length > 8 * 1024 * 1024) {
    return c.json({ error: 'Import is too large (maximum 8 MB)' }, 413)
  }
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return c.json({ error: 'Invalid JSON import' }, 400)
  }
  const parsed = importSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid map or places (maximum 3,000 pins)' }, 400)
  const { title, places: entries } = parsed.data
  const keys = await Promise.all(
    entries.map((entry) => importPlaceKey(entry.name, entry.lat, entry.lng)),
  )
  if (new Set(keys).size !== keys.length) {
    return c.json({ error: 'The map contains duplicate point pins' }, 400)
  }

  const userId = c.get('userId')
  const { db, client } = getDb(c.env.DATABASE_URL)
  try {
    const result = await db.transaction(async (tx) => {
      const [collection] = await tx
        .insert(collections)
        .values({ userId, title, slug: `mymaps-${crypto.randomUUID()}` })
        .returning()
      if (!collection) throw new Error('Failed to create collection')

      for (let offset = 0; offset < entries.length; offset += 100) {
        const batch = entries.slice(offset, offset + 100)
        const batchKeys = keys.slice(offset, offset + 100)
        const existingSources = await tx
          .select({ sourceKey: placeSourceKeys.sourceKey, placeId: placeSourceKeys.placeId })
          .from(placeSourceKeys)
          .where(inArray(placeSourceKeys.sourceKey, batchKeys))
        const sourceIds = new Map(existingSources.map((source) => [source.sourceKey, source.placeId]))
        const newPlaces = batch.flatMap((entry, index) => (sourceIds.has(batchKeys[index] as string) ? [] : [{
              googlePlaceId: batchKeys[index] as string,
              name: entry.name,
              lat: entry.lat,
              lng: entry.lng,
            }]))
        if (newPlaces.length) {
          await tx.insert(places).values(newPlaces).onConflictDoNothing({ target: places.googlePlaceId })
        }
        const rows = await tx
          .select({ id: places.id, googlePlaceId: places.googlePlaceId })
          .from(places)
          .where(inArray(places.googlePlaceId, batchKeys))
        if (rows.length !== batch.length - sourceIds.size) throw new Error('Failed to import all places')
        const ids = new Map(rows.map((row) => [row.googlePlaceId, row.id]))
        for (const [key, id] of sourceIds) ids.set(key, id)
        await tx
          .insert(placeSourceKeys)
          .values(batchKeys.map((sourceKey, index) => ({ sourceKey, placeId: ids.get(sourceKey) as string })))
          .onConflictDoNothing({ target: placeSourceKeys.sourceKey })
        await tx
          .insert(placeEnrichmentJobs)
          .values(batch.map((_, index) => ({ placeId: ids.get(batchKeys[index] as string) as string })))
          .onConflictDoNothing({ target: placeEnrichmentJobs.placeId })
        await tx
          .insert(savedPlaces)
          .values(
            batch.map((_, index) => ({
              userId,
              placeId: ids.get(batchKeys[index] as string) as string,
            })),
          )
          .onConflictDoUpdate({
            target: [savedPlaces.userId, savedPlaces.placeId],
            set: { directlySaved: true },
          })
        await tx.insert(collectionPlaces).values(
          batch.map((entry, index) => ({
            collectionId: collection.id,
            placeId: ids.get(batchKeys[index] as string) as string,
            sortOrder: offset + index,
            notes: entry.notes,
          })),
        )
      }
      return { collection, imported: entries.length }
    })
    return c.json(result, 201)
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
