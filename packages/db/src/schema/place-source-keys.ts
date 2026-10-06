import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { places } from "./places";

// Maps list identities (CID pairs or coordinate fallbacks) are not Places API IDs.
export const placeSourceKeys = pgTable("place_source_keys", {
	sourceKey: text("source_key").primaryKey(),
	placeId: uuid("place_id")
		.notNull()
		.references(() => places.id, { onDelete: "cascade" }),
});
