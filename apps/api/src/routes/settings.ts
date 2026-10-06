import { users } from "@placeshub/db/schema";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../lib/db";
import { type AuthEnv, auth } from "../middleware/auth";

const settings = new Hono<AuthEnv>();
const timezone = z.string().trim().min(1).max(100);

settings.use("/*", auth);

settings.get("/timezone", async (c) => {
	const { db, client } = getDb(c.env.DATABASE_URL);
	try {
		const [user] = await db
			.select({ timezone: users.timezone })
			.from(users)
			.where(eq(users.id, c.get("userId")));
		return c.json({ timezone: user?.timezone ?? "UTC" });
	} finally {
		await client.end();
	}
});

settings.patch("/timezone", async (c) => {
	const parsed = timezone.safeParse(
		(await c.req.json().catch(() => null))?.timezone,
	);
	if (!parsed.success) return c.json({ error: "timezone is required" }, 400);
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: parsed.data }).format();
	} catch {
		return c.json({ error: "timezone must be an IANA timezone" }, 400);
	}
	const { db, client } = getDb(c.env.DATABASE_URL);
	try {
		await db
			.update(users)
			.set({ timezone: parsed.data })
			.where(eq(users.id, c.get("userId")));
		return c.json({ timezone: parsed.data });
	} finally {
		await client.end();
	}
});

export { settings };
