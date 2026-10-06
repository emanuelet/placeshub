import path from "node:path";
import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({
	path: path.resolve(__dirname, "../../.env.local"),
	quiet: true,
});
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const databaseUrl =
	process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		"Set MIGRATION_DATABASE_URL or DATABASE_URL before running Drizzle",
	);
}

export default defineConfig({
	schema: "./src/schema/index.ts",
	out: process.env.DRIZZLE_OUT ?? "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: databaseUrl,
	},
	extensionsFilters: ["postgis"],
	schemaFilter: ["public"],
	tablesFilter: ["*"],
});
