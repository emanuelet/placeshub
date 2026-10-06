import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const mcpApiKeys = pgTable("mcp_api_keys", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	tokenHash: text("token_hash").notNull().unique(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
	revokedAt: timestamp("revoked_at", { withTimezone: true }),
});
