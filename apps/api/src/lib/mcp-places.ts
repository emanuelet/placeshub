import {
	collectionPlaces,
	collections,
	places,
	savedPlaces,
	syncedLists,
} from "@placeshub/db/schema";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";

export const uuid = z
	.string()
	.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export const batch = <T extends z.ZodType>(item: T) =>
	z.array(item).min(1).max(100);

export const saveInput = z.object({
	googlePlaceId: z.string().trim().min(1).max(250),
	name: z.string().trim().min(1).max(500),
	lat: z.number().finite().min(-90).max(90).nullable().optional(),
	lng: z.number().finite().min(-180).max(180).nullable().optional(),
	address: z.string().max(1000).nullable().optional(),
	googleMapsUri: z.string().url().max(2000).nullable().optional(),
	types: z.array(z.string().max(120)).max(20).nullable().optional(),
	phone: z.string().max(100).nullable().optional(),
	website: z.string().url().max(2000).nullable().optional(),
	rating: z.number().finite().min(0).max(5).nullable().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	notes: z.string().max(5000).nullable().optional(),
	tags: z.array(z.string().max(100)).max(30).optional(),
	collectionId: uuid.optional(),
});
export const updateInput = z
	.object({
		savedPlaceId: uuid,
		notes: z.string().max(5000).nullable().optional(),
		tags: z.array(z.string().max(100)).max(30).optional(),
	})
	.refine(
		(item) => item.notes !== undefined || item.tags !== undefined,
		"notes or tags is required",
	);
export const placeUpdateInput = z
	.object({
		placeId: uuid,
		lat: z.number().finite().min(-90).max(90).optional(),
		lng: z.number().finite().min(-180).max(180).optional(),
		address: z.string().max(1000).optional(),
		googleMapsUri: z.string().url().max(2000).optional(),
		types: z.array(z.string().max(120)).max(20).optional(),
		phone: z.string().max(100).optional(),
		website: z.string().url().max(2000).optional(),
		rating: z.number().finite().min(0).max(5).optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
	})
	.refine(
		(item) =>
			item.lat !== undefined ||
			item.lng !== undefined ||
			item.address !== undefined ||
			item.googleMapsUri !== undefined ||
			item.types !== undefined ||
			item.phone !== undefined ||
			item.website !== undefined ||
			item.rating !== undefined ||
			item.metadata !== undefined,
		"at least one shared field is required",
	);

export class PlaceOperationError extends Error {}
function requireUnique(ids: string[]) {
	if (new Set(ids).size !== ids.length)
		throw new PlaceOperationError("duplicate items in batch");
}

type Db = ReturnType<typeof getDb>["db"];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function withMcpDb<T>(
	url: string,
	work: (db: Db) => Promise<T>,
): Promise<T> {
	const { db, client } = getDb(url);
	try {
		return await work(db);
	} finally {
		await client.end();
	}
}

async function manualCollection(tx: Tx, collectionId: string, userId: string) {
	const [collection] = await tx
		.select({ id: collections.id })
		.from(collections)
		.where(
			and(eq(collections.id, collectionId), eq(collections.userId, userId)),
		)
		.for("update");
	if (!collection) throw new PlaceOperationError("collection not found");
	const [synced] = await tx
		.select({ id: syncedLists.id })
		.from(syncedLists)
		.where(eq(syncedLists.collectionId, collectionId))
		.limit(1);
	if (synced)
		throw new PlaceOperationError("Google-synced collections cannot be edited");
}

export async function savePlaces(
	url: string,
	userId: string,
	items: z.infer<typeof saveInput>[],
) {
	requireUnique(items.map((item) => item.googlePlaceId));
	return withMcpDb(url, (db) =>
		db.transaction(async (tx) => {
			// Lock and validate all target collections before writing any place.
			for (const collectionId of new Set(
				items
					.map((item) => item.collectionId)
					.filter((id): id is string => !!id),
			)) {
				await manualCollection(tx, collectionId, userId);
			}
			const results = [];
			for (const item of items) {
				const [inserted] = await tx
					.insert(places)
					.values({
						googlePlaceId: item.googlePlaceId,
						name: item.name,
						lat: item.lat,
						lng: item.lng,
						address: item.address,
						googleMapsUri: item.googleMapsUri,
						types: item.types,
						phone: item.phone,
						website: item.website,
						rating: item.rating,
						metadata: item.metadata,
					})
					.onConflictDoNothing({ target: places.googlePlaceId })
					.returning();
				const place =
					inserted ??
					(
						await tx
							.select()
							.from(places)
							.where(eq(places.googlePlaceId, item.googlePlaceId))
							.for("update")
							.limit(1)
					)[0];
				if (!place) throw new PlaceOperationError("place could not be saved");
				const [savedPlace] = await tx
					.insert(savedPlaces)
					.values({
						userId,
						placeId: place.id,
						notes: item.notes ?? null,
						tags: item.tags ?? [],
					})
					.onConflictDoUpdate({
						target: [savedPlaces.userId, savedPlaces.placeId],
						set: {
							directlySaved: true,
							...(item.notes !== undefined ? { notes: item.notes } : {}),
							...(item.tags !== undefined ? { tags: item.tags } : {}),
						},
					})
					.returning();
				if (item.collectionId)
					await tx
						.insert(collectionPlaces)
						.values({ collectionId: item.collectionId, placeId: place.id })
						.onConflictDoNothing({
							target: [collectionPlaces.collectionId, collectionPlaces.placeId],
						});
				results.push({ savedPlace, place });
			}
			return results;
		}),
	);
}

export async function updatePlace(
	url: string,
	userId: string,
	item: z.infer<typeof placeUpdateInput>,
) {
	return withMcpDb(url, (db) =>
		db.transaction(async (tx) => {
			const [place] = await tx
				.select({
					id: places.id,
					lat: places.lat,
					lng: places.lng,
					address: places.address,
					googleMapsUri: places.googleMapsUri,
					types: places.types,
					phone: places.phone,
					website: places.website,
					rating: places.rating,
					metadata: places.metadata,
				})
				.from(places)
				.innerJoin(
					savedPlaces,
					and(
						eq(savedPlaces.placeId, places.id),
						eq(savedPlaces.userId, userId),
					),
				)
				.where(eq(places.id, item.placeId))
				.for("update")
				.limit(1);
			if (!place) throw new PlaceOperationError("place not found");

			const fields = {
				...(place.lat == null && item.lat !== undefined
					? { lat: item.lat }
					: {}),
				...(place.lng == null && item.lng !== undefined
					? { lng: item.lng }
					: {}),
				...(place.address == null && item.address !== undefined
					? { address: item.address }
					: {}),
				...(place.googleMapsUri == null && item.googleMapsUri !== undefined
					? { googleMapsUri: item.googleMapsUri }
					: {}),
				...(place.types == null && item.types !== undefined
					? { types: item.types }
					: {}),
				...(place.phone == null && item.phone !== undefined
					? { phone: item.phone }
					: {}),
				...(place.website == null && item.website !== undefined
					? { website: item.website }
					: {}),
				...(place.rating == null && item.rating !== undefined
					? { rating: item.rating }
					: {}),
				...(place.metadata == null && item.metadata !== undefined
					? { metadata: item.metadata }
					: {}),
			};
			if (Object.keys(fields).length === 0) return { place, updatedFields: [] };

			const [updated] = await tx
				.update(places)
				.set({ ...fields, cachedAt: new Date() })
				.where(eq(places.id, item.placeId))
				.returning();
			if (!updated) throw new PlaceOperationError("place not found");
			return { place: updated, updatedFields: Object.keys(fields) };
		}),
	);
}

export async function updateSavedPlaces(
	url: string,
	userId: string,
	items: z.infer<typeof updateInput>[],
) {
	requireUnique(items.map((item) => item.savedPlaceId));
	return withMcpDb(url, (db) =>
		db.transaction(async (tx) => {
			const results = [];
			for (const item of items) {
				const [updated] = await tx
					.update(savedPlaces)
					.set({
						...(item.notes !== undefined ? { notes: item.notes } : {}),
						...(item.tags !== undefined ? { tags: item.tags } : {}),
					})
					.where(
						and(
							eq(savedPlaces.id, item.savedPlaceId),
							eq(savedPlaces.userId, userId),
						),
					)
					.returning();
				if (!updated) throw new PlaceOperationError("saved place not found");
				results.push(updated);
			}
			return results;
		}),
	);
}

export async function deleteSavedPlaces(
	url: string,
	userId: string,
	ids: string[],
) {
	requireUnique(ids);
	return withMcpDb(url, (db) =>
		db.transaction(async (tx) => {
			const deleted = await tx
				.delete(savedPlaces)
				.where(
					and(eq(savedPlaces.userId, userId), inArray(savedPlaces.id, ids)),
				)
				.returning({ id: savedPlaces.id });
			if (deleted.length !== ids.length)
				throw new PlaceOperationError("saved place not found");
			return { deletedCount: deleted.length };
		}),
	);
}

export async function changeMembership(
	url: string,
	userId: string,
	collectionId: string,
	ids: string[],
	action: "add" | "remove",
) {
	requireUnique(ids);
	return withMcpDb(url, (db) =>
		db.transaction(async (tx) => {
			await manualCollection(tx, collectionId, userId);
			if (action === "add") {
				const owned = await tx
					.select({ placeId: savedPlaces.placeId })
					.from(savedPlaces)
					.where(
						and(
							eq(savedPlaces.userId, userId),
							inArray(savedPlaces.placeId, ids),
						),
					);
				if (owned.length !== ids.length)
					throw new PlaceOperationError("saved place not found");
				const inserted = await tx
					.insert(collectionPlaces)
					.values(ids.map((placeId) => ({ collectionId, placeId })))
					.onConflictDoNothing({
						target: [collectionPlaces.collectionId, collectionPlaces.placeId],
					})
					.returning({ id: collectionPlaces.id });
				return { addedCount: inserted.length };
			}
			const removed = await tx
				.delete(collectionPlaces)
				.where(
					and(
						eq(collectionPlaces.collectionId, collectionId),
						inArray(collectionPlaces.placeId, ids),
					),
				)
				.returning({ id: collectionPlaces.id });
			if (removed.length !== ids.length)
				throw new PlaceOperationError("collection place not found");
			return { removedCount: removed.length };
		}),
	);
}

export async function listSavedPlaces(
	url: string,
	userId: string,
	limit: number,
	offset: number,
	query?: string,
) {
	return withMcpDb(url, (db) =>
		db
			.select({
				id: savedPlaces.id,
				notes: savedPlaces.notes,
				tags: savedPlaces.tags,
				directlySaved: savedPlaces.directlySaved,
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
			.where(
				and(
					eq(savedPlaces.userId, userId),
					query
						? sql`position(lower(${query}) in lower(${places.name})) > 0`
						: undefined,
				),
			)
			.orderBy(savedPlaces.createdAt, savedPlaces.id)
			.limit(limit)
			.offset(offset),
	);
}

export async function listCollections(
	url: string,
	userId: string,
	limit: number,
	offset: number,
) {
	return withMcpDb(url, (db) =>
		db
			.select({
				id: collections.id,
				title: collections.title,
				description: collections.description,
				syncedFromGoogle: isNotNull(syncedLists.id),
			})
			.from(collections)
			.leftJoin(syncedLists, eq(syncedLists.collectionId, collections.id))
			.where(eq(collections.userId, userId))
			.orderBy(collections.createdAt, collections.id)
			.limit(limit)
			.offset(offset),
	);
}

export async function getCollection(
	url: string,
	userId: string,
	id: string,
	limit: number,
	offset: number,
) {
	return withMcpDb(url, async (db) => {
		const [collection] = await db
			.select({
				id: collections.id,
				title: collections.title,
				description: collections.description,
				syncedFromGoogle: isNotNull(syncedLists.id),
			})
			.from(collections)
			.leftJoin(syncedLists, eq(syncedLists.collectionId, collections.id))
			.where(and(eq(collections.id, id), eq(collections.userId, userId)));
		if (!collection) throw new PlaceOperationError("collection not found");
		const entries = await db
			.select({
				place: {
					id: places.id,
					googlePlaceId: places.googlePlaceId,
					name: places.name,
					lat: places.lat,
					lng: places.lng,
					address: places.address,
				},
				savedPlaceId: savedPlaces.id,
				notes: collectionPlaces.notes,
				sortOrder: collectionPlaces.sortOrder,
			})
			.from(collectionPlaces)
			.innerJoin(places, eq(collectionPlaces.placeId, places.id))
			.leftJoin(
				savedPlaces,
				and(eq(savedPlaces.placeId, places.id), eq(savedPlaces.userId, userId)),
			)
			.where(eq(collectionPlaces.collectionId, id))
			.orderBy(collectionPlaces.sortOrder, collectionPlaces.id)
			.limit(limit)
			.offset(offset);
		return { collection, places: entries };
	});
}

export async function manageCollection(
	url: string,
	userId: string,
	input:
		| { action: "create"; title: string; description?: string | null }
		| {
				action: "update";
				id: string;
				title?: string;
				description?: string | null;
		  }
		| { action: "delete"; id: string },
) {
	return withMcpDb(url, (db) =>
		db.transaction(async (tx) => {
			if (input.action === "create") {
				const slug = `${
					input.title
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, "-")
						.replace(/(^-|-$)/g, "") || "collection"
				}-${crypto.randomUUID()}`;
				const [collection] = await tx
					.insert(collections)
					.values({
						userId,
						title: input.title,
						description: input.description,
						slug,
					})
					.returning();
				return { collection };
			}
			await manualCollection(tx, input.id, userId);
			if (input.action === "delete") {
				await tx
					.delete(collections)
					.where(
						and(eq(collections.id, input.id), eq(collections.userId, userId)),
					);
				return { success: true };
			}
			const [collection] = await tx
				.update(collections)
				.set({
					...(input.title !== undefined ? { title: input.title } : {}),
					...(input.description !== undefined
						? { description: input.description }
						: {}),
					updatedAt: new Date(),
				})
				.where(
					and(eq(collections.id, input.id), eq(collections.userId, userId)),
				)
				.returning();
			return { collection };
		}),
	);
}
