import { doublePrecision, jsonb, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const places = pgTable('places', {
  id: uuid('id').defaultRandom().primaryKey(),
  googlePlaceId: text('google_place_id').notNull().unique(),
  name: text('name').notNull(),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  address: text('address'),
  googleMapsUri: text('google_maps_uri'),
  types: text('types').array(),
  phone: text('phone'),
  website: text('website'),
  rating: real('rating'),
  metadata: jsonb('metadata'),
  cachedAt: timestamp('cached_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
