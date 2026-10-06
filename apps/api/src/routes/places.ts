import {
	collectionPlaces,
	collections,
	places,
	savedPlaces,
	syncedLists,
} from "@placeshub/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "../lib/db";
import { GooglePlacesError, googlePlaces } from "../lib/google-places";
import { type AuthEnv, auth } from "../middleware/auth";

const placesRouter = new Hono<AuthEnv>();

placesRouter.use("/*", auth);

placesRouter.get("/search", async (c) => {
	const query = c.req.query("q")?.trim();
	if (!query) {
		return c.json({ places: [] });
	}
	if (query.length > 200) {
		return c.json({ error: "query must be at most 200 characters" }, 400);
	}
	try {
		return c.json({
			places: await googlePlaces(c.env).searchText({
				textQuery: query,
				pageSize: 20,
			}),
		});
	} catch (error) {
		return c.json(
			{
				error:
					error instanceof GooglePlacesError
						? error.message
						: "Google Places search is unavailable",
			},
			error instanceof GooglePlacesError
				? (error.status as 429 | 502 | 503)
				: 502,
		);
	}
});

placesRouter.get("/", async (c) => {
	const userId = c.get("userId");
	const { db, client } = getDb(c.env.DATABASE_URL);

	try {
		const results = await db
			.select({
				id: savedPlaces.id,
				notes: savedPlaces.notes,
				directlySaved: savedPlaces.directlySaved,
				syncedCollectionIds: sql<
					string[]
				>`(SELECT COALESCE(array_agg(sl.source_list_id), ARRAY[]::text[]) FROM collection_places cp INNER JOIN synced_lists sl ON cp.collection_id = sl.collection_id WHERE cp.place_id = ${places.id} AND sl.user_id = ${userId})`,
				tags: savedPlaces.tags,
				createdAt: savedPlaces.createdAt,
				place: {
					id: places.id,
					googlePlaceId: places.googlePlaceId,
					name: places.name,
					lat: places.lat,
					lng: places.lng,
					address: places.address,
					googleMapsUri: places.googleMapsUri,
					types: places.types,
					phone: places.phone,
					website: places.website,
					rating: places.rating,
					metadata: places.metadata,
				},
			})
			.from(savedPlaces)
			.innerJoin(places, eq(savedPlaces.placeId, places.id))
			.where(eq(savedPlaces.userId, userId))
			.orderBy(savedPlaces.createdAt);

		return c.json({ savedPlaces: results });
	} finally {
		await client.end();
	}
});

placesRouter.post("/", async (c) => {
	const userId = c.get("userId");
	const body = await c.req.json();
	const {
		googlePlaceId,
		name,
		lat,
		lng,
		address,
		googleMapsUri,
		types,
		phone,
		website,
		rating,
		notes,
		tags,
		metadata,
		collectionId,
	} = body;

	if (
		typeof googlePlaceId !== "string" ||
		!googlePlaceId.trim() ||
		typeof name !== "string" ||
		!name.trim()
	) {
		return c.json({ error: "googlePlaceId and name are required" }, 400);
	}
	if (
		collectionId != null &&
		(typeof collectionId !== "string" ||
			!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				collectionId,
			))
	) {
		return c.json({ error: "collectionId must be a UUID" }, 400);
	}
	if (notes !== undefined && notes !== null && typeof notes !== "string") {
		return c.json({ error: "notes must be a string or null" }, 400);
	}
	if (
		tags !== undefined &&
		(!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string"))
	) {
		return c.json({ error: "tags must be an array of strings" }, 400);
	}
	if (
		[lat, lng, rating].some(
			(value) =>
				value != null && (typeof value !== "number" || !Number.isFinite(value)),
		) ||
		(types != null &&
			(!Array.isArray(types) ||
				!types.every((type: unknown) => typeof type === "string")))
	) {
		return c.json(
			{ error: "invalid place coordinates, rating, or types" },
			400,
		);
	}

	const { db, client } = getDb(c.env.DATABASE_URL);

	try {
		const result = await db.transaction(async (tx) => {
			if (collectionId) {
				const [collection] = await tx
					.select({ id: collections.id })
					.from(collections)
					.where(
						and(
							eq(collections.id, collectionId),
							eq(collections.userId, userId),
						),
					)
					.for("update");
				if (!collection)
					return {
						error: "collection not found" as const,
						status: 404 as const,
					};
				const [synced] = await tx
					.select({ id: syncedLists.id })
					.from(syncedLists)
					.where(eq(syncedLists.collectionId, collectionId))
					.limit(1);
				if (synced)
					return {
						error: "Google-synced collections cannot be edited" as const,
						status: 403 as const,
					};
			}
			const [place] = await tx
				.insert(places)
				.values({
					googlePlaceId,
					name,
					lat,
					lng,
					address,
					googleMapsUri,
					types,
					phone,
					website,
					rating,
					metadata,
				})
				.onConflictDoNothing({ target: places.googlePlaceId })
				.returning();
			const existingPlace =
				place ??
				(
					await tx
						.update(places)
						.set({
							name,
							...(lat != null ? { lat } : {}),
							...(lng != null ? { lng } : {}),
							...(address ? { address } : {}),
							...(googleMapsUri ? { googleMapsUri } : {}),
							...(types?.length ? { types } : {}),
							...(phone ? { phone } : {}),
							...(website ? { website } : {}),
							...(rating != null ? { rating } : {}),
							...(metadata
								? {
										metadata: sql`COALESCE(${places.metadata}, '{}'::jsonb) || ${JSON.stringify(metadata)}::jsonb`,
									}
								: {}),
							cachedAt: new Date(),
						})
						.where(eq(places.googlePlaceId, googlePlaceId))
						.returning()
				)[0];
			if (!existingPlace) throw new Error("failed to create place");

			const [savedPlace] = await tx
				.insert(savedPlaces)
				.values({
					userId,
					placeId: existingPlace.id,
					notes: notes ?? null,
					tags: tags ?? [],
				})
				.onConflictDoUpdate({
					target: [savedPlaces.userId, savedPlaces.placeId],
					set: {
						directlySaved: true,
						...(notes !== undefined ? { notes } : {}),
						...(tags !== undefined ? { tags } : {}),
					},
				})
				.returning();
			if (collectionId) {
				await tx
					.insert(collectionPlaces)
					.values({ collectionId, placeId: existingPlace.id })
					.onConflictDoNothing({
						target: [collectionPlaces.collectionId, collectionPlaces.placeId],
					});
			}
			return { savedPlace, place: existingPlace };
		});
		if ("error" in result)
			return c.json({ error: result.error }, result.status);
		return c.json(result, 201);
	} finally {
		await client.end();
	}
});

placesRouter.patch("/:id", async (c) => {
	const userId = c.get("userId");
	const id = c.req.param("id");
	const body = await c.req.json();
	if (
		body.notes !== undefined &&
		body.notes !== null &&
		typeof body.notes !== "string"
	) {
		return c.json({ error: "notes must be a string or null" }, 400);
	}
	if (
		body.tags !== undefined &&
		(!Array.isArray(body.tags) ||
			!body.tags.every((tag: unknown) => typeof tag === "string"))
	) {
		return c.json({ error: "tags must be an array of strings" }, 400);
	}
	if (body.notes === undefined && body.tags === undefined) {
		return c.json({ error: "notes or tags is required" }, 400);
	}

	const { db, client } = getDb(c.env.DATABASE_URL);

	try {
		const [updated] = await db
			.update(savedPlaces)
			.set({
				...(body.notes !== undefined ? { notes: body.notes } : {}),
				...(body.tags !== undefined ? { tags: body.tags } : {}),
			})
			.where(and(eq(savedPlaces.id, id), eq(savedPlaces.userId, userId)))
			.returning();

		if (!updated) {
			return c.json({ error: "not found" }, 404);
		}

		return c.json({ savedPlace: updated });
	} finally {
		await client.end();
	}
});

placesRouter.delete("/:id", async (c) => {
	const userId = c.get("userId");
	const id = c.req.param("id");

	const { db, client } = getDb(c.env.DATABASE_URL);

	try {
		const deleted = await db
			.delete(savedPlaces)
			.where(and(eq(savedPlaces.id, id), eq(savedPlaces.userId, userId)))
			.returning();

		if (deleted.length === 0) {
			return c.json({ error: "not found" }, 404);
		}

		return c.json({ success: true });
	} finally {
		await client.end();
	}
});

export { placesRouter as places };
