import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { places } from "./places";

export const placeEnrichmentJobs = pgTable(
	"place_enrichment_jobs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		placeId: uuid("place_id")
			.notNull()
			.references(() => places.id, { onDelete: "cascade" }),
		status: text("status").notNull().default("pending"),
		resolvedGooglePlaceId: text("resolved_google_place_id"),
		candidates: jsonb("candidates"),
		attempts: integer("attempts").notNull().default(0),
		lastError: text("last_error"),
		nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => ({
		placeUnique: uniqueIndex("place_enrichment_jobs_place_unique").on(
			table.placeId,
		),
		pendingIndex: index("place_enrichment_jobs_pending_idx").on(
			table.status,
			table.nextAttemptAt,
		),
	}),
);
