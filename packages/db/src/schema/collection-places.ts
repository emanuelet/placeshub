import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { collections } from './collections'
import { places } from './places'

export const collectionPlaces = pgTable(
  'collection_places',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    collectionPlaceUnique: uniqueIndex('collection_place_unique').on(
      table.collectionId,
      table.placeId,
    ),
  }),
)
