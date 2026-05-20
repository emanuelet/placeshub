import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { places } from './places'
import { users } from './users'

export const savedPlaces = pgTable(
  'saved_places',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    notes: text('notes'),
    tags: text('tags').array().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userPlaceUnique: uniqueIndex('user_place_unique').on(table.userId, table.placeId),
  }),
)
