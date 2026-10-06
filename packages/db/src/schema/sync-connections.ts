import {
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { collections } from "./collections";
import { users } from "./users";

export const syncConnections = pgTable("sync_connections", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	tokenHash: text("token_hash").notNull().unique(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
	revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const syncedLists = pgTable(
	"synced_lists",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		sourceListId: text("source_list_id").notNull(),
		collectionId: uuid("collection_id")
			.notNull()
			.references(() => collections.id, { onDelete: "cascade" }),
		lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
	},
	(table) => ({
		userSourceUnique: uniqueIndex("synced_list_user_source_unique").on(
			table.userId,
			table.sourceListId,
		),
		collectionUnique: uniqueIndex("synced_list_collection_unique").on(
			table.collectionId,
		),
	}),
);
