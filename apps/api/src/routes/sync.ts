import {
	collectionPlaces,
	collections,
	placeSourceKeys,
	places,
	savedPlaces,
	syncConnections,
	syncedLists,
} from "@placeshub/db/schema";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { type Context, Hono, type Next } from "hono";
import { z } from "zod";
import { getDb } from "../lib/db";
import { type AuthEnv, auth } from "../middleware/auth";

const sync = new Hono<AuthEnv>();

async function hashToken(token: string) {
	const bytes = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(token),
	);
	return Array.from(new Uint8Array(bytes), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

async function syncAuth(c: Context<AuthEnv>, next: Next) {
	const header = c.req.header("Authorization");
	if (!header?.startsWith("Bearer phs_"))
		return c.json({ error: "unauthorized" }, 401);
	const { db, client } = getDb(c.env.DATABASE_URL);
	try {
		const [connection] = await db
			.select()
			.from(syncConnections)
			.where(
				and(
					eq(syncConnections.tokenHash, await hashToken(header.slice(7))),
					sql`${syncConnections.revokedAt} IS NULL`,
				),
			)
			.limit(1);
		if (!connection) return c.json({ error: "unauthorized" }, 401);
		c.set("userId", connection.userId);
		await db
			.update(syncConnections)
			.set({ lastUsedAt: new Date() })
			.where(eq(syncConnections.id, connection.id));
	} finally {
		await client.end();
	}
	await next();
}

const snapshotSchema = z.object({
	sourceListId: z.string().min(1).max(200),
	title: z.string().min(1).max(200),
	complete: z.literal(true),
	expectedCount: z.number().int().min(0).max(3000),
	places: z
		.array(
			z.object({
				sourcePlaceId: z.string().min(1).max(250),
				placeId: z
					.string()
					.regex(/^[\w-]{15,200}$/)
					.optional(),
				name: z.string().max(500),
				lat: z.number().finite().min(-90).max(90),
				lng: z.number().finite().min(-180).max(180),
				address: z.string().max(1000).nullable().optional(),
				notes: z.string().max(5000).nullable().optional(),
				googleMapsUri: z.string().url().max(2000).nullable().optional(),
				phone: z.string().max(100).nullable().optional(),
				website: z.string().url().max(2000).nullable().optional(),
				rating: z.number().min(0).max(5).nullable().optional(),
				metadata: z
					.object({
						reviewCount: z.number().int().nonnegative().nullable().optional(),
						category: z.array(z.string().max(120)).max(20).optional(),
						hours: z
							.array(
								z.object({
									day: z.string().max(30),
									hours: z.string().max(200),
								}),
							)
							.max(7)
							.nullable()
							.optional(),
						imageUrl: z.string().url().max(2000).nullable().optional(),
						plusCode: z.string().max(100).nullable().optional(),
						city: z.string().max(200).nullable().optional(),
						postalCode: z.string().max(40).nullable().optional(),
						state: z.string().max(200).nullable().optional(),
						countryCode: z.string().max(8).nullable().optional(),
						country: z.string().max(200).nullable().optional(),
						dateAdded: z.string().datetime().nullable().optional(),
						dateUpdated: z.string().datetime().nullable().optional(),
					})
					.optional(),
			}),
		)
		.max(3000),
});

sync.post("/connections", auth, async (c) => {
	const token = `phs_${crypto.randomUUID()}${crypto.randomUUID()}`;
	const { db, client } = getDb(c.env.DATABASE_URL);
	try {
		const [connection] = await db
			.insert(syncConnections)
			.values({
				userId: c.get("userId"),
				tokenHash: await hashToken(token),
			})
			.returning({ id: syncConnections.id });
		return c.json({ token, id: connection?.id }, 201);
	} finally {
		await client.end();
	}
});

sync.get("/connections", auth, async (c) => {
	const { db, client } = getDb(c.env.DATABASE_URL);
	try {
		const connections = await db
			.select({
				id: syncConnections.id,
				createdAt: syncConnections.createdAt,
				lastUsedAt: syncConnections.lastUsedAt,
				revokedAt: syncConnections.revokedAt,
			})
			.from(syncConnections)
			.where(eq(syncConnections.userId, c.get("userId")));
		const lists = await db
			.select({
				title: collections.title,
				sourceListId: syncedLists.sourceListId,
				lastSyncedAt: syncedLists.lastSyncedAt,
			})
			.from(syncedLists)
			.innerJoin(collections, eq(syncedLists.collectionId, collections.id))
			.where(eq(syncedLists.userId, c.get("userId")));
		return c.json({ connections, lists });
	} finally {
		await client.end();
	}
});

sync.delete("/connections/:id", auth, async (c) => {
	const { db, client } = getDb(c.env.DATABASE_URL);
	try {
		const [revoked] = await db
			.update(syncConnections)
			.set({ revokedAt: new Date() })
			.where(
				and(
					eq(syncConnections.id, c.req.param("id")),
					eq(syncConnections.userId, c.get("userId")),
				),
			)
			.returning({ id: syncConnections.id });
		return revoked
			? c.json({ success: true })
			: c.json({ error: "not found" }, 404);
	} finally {
		await client.end();
	}
});

sync.post("/snapshots", syncAuth, async (c) => {
	const parsed = snapshotSchema.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "invalid snapshot" }, 400);
	const { sourceListId, title, places: entries, expectedCount } = parsed.data;
	if (
		entries.length !== expectedCount ||
		new Set(entries.map((p) => p.sourcePlaceId)).size !== entries.length
	) {
		return c.json(
			{ error: "incomplete or duplicate snapshot; no changes applied" },
			400,
		);
	}
	const userId = c.get("userId");
	const { db, client } = getDb(c.env.DATABASE_URL);
	try {
		const summary = await db.transaction(async (tx) => {
			let [synced] = await tx
				.select()
				.from(syncedLists)
				.where(
					and(
						eq(syncedLists.userId, userId),
						eq(syncedLists.sourceListId, sourceListId),
					),
				)
				.limit(1);
			if (!synced) {
				const [collection] = await tx
					.insert(collections)
					.values({
						userId,
						title,
						slug: `google-${crypto.randomUUID()}`,
					})
					.returning();
				if (!collection) throw new Error("failed to create collection");
				[synced] = await tx
					.insert(syncedLists)
					.values({
						userId,
						sourceListId,
						collectionId: collection.id,
					})
					.returning();
			}
			if (!synced) throw new Error("failed to create synced list");
			const collectionId = synced.collectionId;
			await tx
				.update(collections)
				.set({ title, updatedAt: new Date() })
				.where(eq(collections.id, collectionId));

			const placeIds: string[] = [];
			// Bound each statement so even a large list fits Postgres parameter limits.
			for (let offset = 0; offset < entries.length; offset += 100) {
				const batch = entries.slice(offset, offset + 100);
				const existingSources = await tx
					.select()
					.from(placeSourceKeys)
					.where(
						inArray(
							placeSourceKeys.sourceKey,
							batch.map((entry) => entry.sourcePlaceId),
						),
					);
				const mapped = new Map(
					existingSources.map((row) => [row.sourceKey, row.placeId]),
				);
				for (const entry of batch) {
					const existingId = mapped.get(entry.sourcePlaceId);
					if (existingId && !entry.placeId) {
						await tx
							.update(places)
							.set({
								name: entry.name || entry.address || "Unnamed place",
								lat: entry.lat,
								lng: entry.lng,
								...(entry.address ? { address: entry.address } : {}),
								metadata: sql`COALESCE(${places.metadata}, '{}'::jsonb) || ${JSON.stringify(entry.metadata ?? {})}::jsonb`,
								cachedAt: new Date(),
							})
							.where(eq(places.id, existingId));
					}
				}
				const toUpsert = new Map(
					batch
						.filter(
							(entry) => entry.placeId || !mapped.has(entry.sourcePlaceId),
						)
						.map((entry) => [entry.placeId ?? entry.sourcePlaceId, entry]),
				);
				const rows = toUpsert.size
					? await tx
							.insert(places)
							.values(
								[...toUpsert].map(([googlePlaceId, entry]) => ({
									googlePlaceId,
									name: entry.name || entry.address || "Unnamed place",
									lat: entry.lat,
									lng: entry.lng,
									address: entry.address ?? null,
									googleMapsUri: entry.googleMapsUri ?? null,
									phone: entry.phone ?? null,
									website: entry.website ?? null,
									rating: entry.rating ?? null,
									types: entry.metadata?.category ?? null,
									metadata: entry.metadata ?? null,
								})),
							)
							.onConflictDoUpdate({
								target: places.googlePlaceId,
								set: {
									name: sql`excluded.name`,
									lat: sql`excluded.lat`,
									lng: sql`excluded.lng`,
									address: sql`COALESCE(excluded.address, places.address)`,
									googleMapsUri: sql`COALESCE(excluded.google_maps_uri, places.google_maps_uri)`,
									phone: sql`COALESCE(excluded.phone, places.phone)`,
									website: sql`COALESCE(excluded.website, places.website)`,
									rating: sql`COALESCE(excluded.rating, places.rating)`,
									types: sql`COALESCE(excluded.types, places.types)`,
									metadata: sql`COALESCE(excluded.metadata, places.metadata)`,
									cachedAt: new Date(),
								},
							})
							.returning({ id: places.id, googlePlaceId: places.googlePlaceId })
					: [];
				if (rows.length !== toUpsert.size)
					throw new Error("failed to save all places");
				const ids = new Map(rows.map((row) => [row.googlePlaceId, row.id]));
				const sourceRows = batch.map((entry) => ({
					sourceKey: entry.sourcePlaceId,
					placeId:
						ids.get(entry.placeId ?? entry.sourcePlaceId) ??
						mapped.get(entry.sourcePlaceId),
				}));
				if (sourceRows.some((row) => !row.placeId))
					throw new Error("failed to resolve place identity");
				await tx
					.insert(placeSourceKeys)
					.values(sourceRows as { sourceKey: string; placeId: string }[])
					.onConflictDoUpdate({
						target: placeSourceKeys.sourceKey,
						set: { placeId: sql`excluded.place_id` },
					});
				const membership = batch.map((entry, index) => ({
					collectionId,
					placeId: (sourceRows[index] as { placeId: string }).placeId,
					sortOrder: offset + index,
					notes: entry.notes ?? null,
				}));
				const uniqueMembership = [
					...new Map(
						membership.map((entry) => [entry.placeId, entry]),
					).values(),
				];
				placeIds.push(...uniqueMembership.map((entry) => entry.placeId));
				await tx
					.insert(savedPlaces)
					.values(
						uniqueMembership.map((entry) => ({
							userId,
							placeId: entry.placeId,
							directlySaved: false,
						})),
					)
					.onConflictDoNothing();
				await tx
					.insert(collectionPlaces)
					.values(uniqueMembership)
					.onConflictDoUpdate({
						target: [collectionPlaces.collectionId, collectionPlaces.placeId],
						set: {
							sortOrder: sql`excluded.sort_order`,
							notes: sql`excluded.notes`,
						},
					});
			}

			const removed = await tx
				.delete(collectionPlaces)
				.where(
					placeIds.length
						? and(
								eq(collectionPlaces.collectionId, collectionId),
								notInArray(collectionPlaces.placeId, placeIds),
							)
						: eq(collectionPlaces.collectionId, collectionId),
				)
				.returning({ placeId: collectionPlaces.placeId });
			if (removed.length) {
				await tx.delete(savedPlaces).where(
					and(
						eq(savedPlaces.userId, userId),
						eq(savedPlaces.directlySaved, false),
						inArray(
							savedPlaces.placeId,
							removed.map((p) => p.placeId),
						),
						sql`NOT EXISTS (SELECT 1 FROM collection_places cp WHERE cp.place_id = ${savedPlaces.placeId} AND cp.collection_id IN (SELECT id FROM collections WHERE user_id = ${userId}))`,
					),
				);
			}
			await tx
				.update(syncedLists)
				.set({ lastSyncedAt: new Date() })
				.where(eq(syncedLists.id, synced.id));
			return {
				imported: entries.length,
				removed: removed.length,
				collectionId,
			};
		});
		return c.json(summary);
	} finally {
		await client.end();
	}
});

export { sync };
