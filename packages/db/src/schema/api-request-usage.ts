import {
	date,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const apiRequestUsage = pgTable(
	"api_request_usage",
	{
		service: text("service").notNull(),
		day: date("day").notNull(),
		attempts: integer("attempts").notNull().default(0),
		nextRequestAt: timestamp("next_request_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.service, table.day] })],
);
