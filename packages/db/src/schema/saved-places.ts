import { pgTable, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'
import { places } from './places'

export const savedPlaces = pgTable('saved_places', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  placeId: uuid('place_id').notNull().references(() => places.id, { onDelete: 'cascade' }),
  notes: text('notes'),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userPlaceUnique: uniqueIndex('user_place_unique').on(table.userId, table.placeId),
}))
