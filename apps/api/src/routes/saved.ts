import { collections, places, savedPlaces } from '@placeshub/db/schema'
import { and, eq, ilike, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../lib/db'
import { type AuthEnv, auth } from '../middleware/auth'

const savedRouter = new Hono<AuthEnv>()
savedRouter.use('/*', auth)

const scopeSchema = z.object({ collectionId: z.uuid().optional() })
const searchSchema = scopeSchema
  .extend({
    q: z.string().max(200).optional(),
    locationType: z.enum(['city', 'address']).optional(),
    locationValue: z.string().max(1000).optional(),
    city: z.string().max(200).optional(),
    country: z.string().max(200).optional(),
    category: z.string().max(120).optional(),
    tag: z.string().max(200).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    sortBy: z.enum(['name', 'location']).default('name'),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
  })
  .refine((value) => !!value.locationType === !!value.locationValue, {
    message: 'locationType and locationValue must be provided together',
  })

// Escape LIKE wildcards: a typed '%' or '_' should be searched literally.
const pattern = (value: string) => `%${value.replace(/[\\%_]/g, '\\$&')}%`
const city = sql<string>`NULLIF(${places.metadata}->>'city', '')`
const country = sql<string>`NULLIF(${places.metadata}->>'country', '')`
const location = sql<string>`COALESCE(${city}, NULLIF(${places.address}, ''))`

function ownedScope(userId: string, collectionId?: string) {
  const membership = sql`EXISTS (
    SELECT 1 FROM collection_places cp JOIN collections c ON c.id = cp.collection_id
        WHERE cp.place_id = ${places.id} AND c.user_id = ${userId}
        ${collectionId ? sql`AND c.id = ${collectionId}` : sql``}
  )`
  return collectionId
    ? membership
    : or(and(eq(savedPlaces.userId, userId), eq(savedPlaces.directlySaved, true)), membership)
}

savedRouter.get('/locations', async (c) => {
  const parsed = scopeSchema.extend({ q: z.string().max(200).default('') }).safeParse(c.req.query())
  if (!parsed.success) return c.json({ error: 'invalid search parameters' }, 400)
  const { collectionId, q } = parsed.data
  if (q.trim().length < 2) return c.json({ locations: [] })

  const userId = c.get('userId')
  const { db, client } = getDb(c.env.DATABASE_URL)
  try {
    const scope = ownedScope(userId, collectionId)
    const [cities, addresses] = await Promise.all([
      db
        .select({ value: city })
        .from(places)
        .leftJoin(
          savedPlaces,
          and(eq(savedPlaces.placeId, places.id), eq(savedPlaces.userId, userId)),
        )
        .where(and(scope, ilike(city, pattern(q.trim()))))
        .groupBy(city)
        .orderBy(sql`lower(${city})`)
        .limit(6),
      db
        .select({ value: places.address })
        .from(places)
        .leftJoin(
          savedPlaces,
          and(eq(savedPlaces.placeId, places.id), eq(savedPlaces.userId, userId)),
        )
        .where(and(scope, ilike(places.address, pattern(q.trim()))))
        .groupBy(places.address)
        .orderBy(sql`lower(${places.address})`)
        .limit(6),
    ])
    const locations = cities
      .filter((row): row is { value: string } => !!row.value)
      .map((row) => ({ type: 'city' as const, value: row.value }))
    const addressLocations = addresses
      .filter((row): row is { value: string } => !!row.value)
      .map((row) => ({ type: 'address' as const, value: row.value }))
    return c.json({
      locations: [...locations, ...addressLocations]
        .sort((a, b) => a.value.localeCompare(b.value))
        .slice(0, 12),
    })
  } finally {
    await client.end()
  }
})

savedRouter.get('/search', async (c) => {
  const parsed = searchSchema.safeParse(c.req.query())
  if (!parsed.success) return c.json({ error: 'invalid search parameters' }, 400)
  const params = parsed.data
  const userId = c.get('userId')
  const { db, client } = getDb(c.env.DATABASE_URL)
  try {
    if (params.collectionId) {
      const [owned] = await db
        .select({ id: collections.id })
        .from(collections)
        .where(and(eq(collections.id, params.collectionId), eq(collections.userId, userId)))
        .limit(1)
      if (!owned) return c.json({ error: 'collection not found' }, 404)
    }

    const scope = ownedScope(userId, params.collectionId)
    const base = db
      .select({
        city: city.as('city'),
        country: country.as('country'),
        address: places.address,
        types: places.types,
        tags: savedPlaces.tags,
      })
      .from(places)
      .leftJoin(
        savedPlaces,
        and(eq(savedPlaces.placeId, places.id), eq(savedPlaces.userId, userId)),
      )
      .where(scope)
      .as('base')
    const facetRows = await db.select().from(base)
    const values = (items: (string | null | undefined)[]) =>
      [...new Set(items.filter((value): value is string => !!value))].sort((a, b) =>
        a.localeCompare(b),
      )
    const filters = {
      cities: values(facetRows.map((row) => row.city)),
      countries: values(facetRows.map((row) => row.country)),
      categories: values(facetRows.flatMap((row) => row.types ?? [])),
      tags: values(facetRows.flatMap((row) => row.tags ?? [])),
    }

    const conditions = [scope]
    if (params.q?.trim()) {
      const match = pattern(params.q.trim())
      conditions.push(
        sql`(${ilike(places.name, match)} OR ${ilike(city, match)} OR ${ilike(places.address, match)})`,
      )
    }
    if (params.locationType === 'city' && params.locationValue) {
      conditions.push(
        sql`(lower(${city}) = lower(${params.locationValue}) OR (${city} IS NULL AND ${ilike(places.address, pattern(params.locationValue))}))`,
      )
    }
    if (params.locationType === 'address' && params.locationValue) {
      conditions.push(sql`lower(${places.address}) = lower(${params.locationValue})`)
    }
    if (params.city) conditions.push(sql`lower(${city}) = lower(${params.city})`)
    if (params.country) conditions.push(sql`lower(${country}) = lower(${params.country})`)
    if (params.category) conditions.push(sql`${params.category} = ANY(${places.types})`)
    if (params.tag) conditions.push(sql`${params.tag} = ANY(${savedPlaces.tags})`)
    if (params.minRating !== undefined)
      conditions.push(sql`${places.rating} >= ${params.minRating}`)

    const primary = params.sortBy === 'location' ? location : places.name
    const order = params.sortDir === 'desc' ? sql`DESC` : sql`ASC`
    const results = await db
      .select({
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
        savedPlaceId: savedPlaces.id,
        personalNotes: savedPlaces.notes,
        notes: params.collectionId
          ? sql<
              string | null
            >`(SELECT cp.notes FROM collection_places cp WHERE cp.collection_id = ${params.collectionId} AND cp.place_id = ${places.id})`
          : savedPlaces.notes,
        tags: savedPlaces.tags,
      })
      .from(places)
      .leftJoin(
        savedPlaces,
        and(eq(savedPlaces.placeId, places.id), eq(savedPlaces.userId, userId)),
      )
      .where(and(...conditions))
      .orderBy(
        sql`lower(${primary}) ${order} NULLS LAST`,
        ...(params.sortBy === 'location'
          ? [sql`lower(${places.address}) ${order} NULLS LAST`]
          : []),
        sql`lower(${places.name}) ASC`,
        sql`${places.id} ASC`,
      )

    return c.json({ places: results, filters })
  } finally {
    await client.end()
  }
})

export { savedRouter as saved }
