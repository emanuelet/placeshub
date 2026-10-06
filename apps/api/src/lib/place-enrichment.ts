import {
	placeEnrichmentJobs,
	placeSourceKeys,
	places,
} from "@placeshub/db/schema";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "./db";
import { googlePlaces } from "./google-places";

type Env = { DATABASE_URL: string; GOOGLE_PLACES_API_KEY?: string };
type Candidate = { name: string; lat: number | null; lng: number | null };

function isStrongMatch(
	place: { name: string; lat: number | null; lng: number | null },
	candidate: Candidate,
) {
	const name = place.name.trim().toLowerCase();
	const candidateName = candidate.name.trim().toLowerCase();
	if (
		!name ||
		!candidateName ||
		!(
			name === candidateName ||
			candidateName.includes(name) ||
			name.includes(candidateName)
		)
	)
		return false;
	if (
		place.lat == null ||
		place.lng == null ||
		candidate.lat == null ||
		candidate.lng == null
	)
		return true;
	const lat = ((place.lat - candidate.lat) * Math.PI) / 180;
	const lng = ((place.lng - candidate.lng) * Math.PI) / 180;
	const a =
		Math.sin(lat / 2) ** 2 +
		Math.cos((place.lat * Math.PI) / 180) *
			Math.cos((candidate.lat * Math.PI) / 180) *
			Math.sin(lng / 2) ** 2;
	return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= 500;
}

export async function processOnePlaceEnrichment(env: Env) {
	if (!env.GOOGLE_PLACES_API_KEY) return;
	const { db, client } = getDb(env.DATABASE_URL);
	try {
		const job = await db.transaction(async (tx) => {
			const [job] = await tx
				.select({
					id: placeEnrichmentJobs.id,
					status: placeEnrichmentJobs.status,
					attempts: placeEnrichmentJobs.attempts,
					resolvedGooglePlaceId: placeEnrichmentJobs.resolvedGooglePlaceId,
					place: {
						id: places.id,
						name: places.name,
						lat: places.lat,
						lng: places.lng,
					},
				})
				.from(placeEnrichmentJobs)
				.innerJoin(places, eq(placeEnrichmentJobs.placeId, places.id))
				.where(
					and(
						inArray(placeEnrichmentJobs.status, [
							"pending",
							"resolving",
							"details",
						]),
						lte(placeEnrichmentJobs.nextAttemptAt, new Date()),
					),
				)
				.orderBy(asc(placeEnrichmentJobs.nextAttemptAt))
				.limit(1)
				.for("update");
			if (!job) return null;
			await tx
				.update(placeEnrichmentJobs)
				.set({
					nextAttemptAt: new Date(Date.now() + 15 * 60 * 1000),
					updatedAt: new Date(),
				})
				.where(eq(placeEnrichmentJobs.id, job.id));
			return job;
		});
		if (!job) return;
		try {
			if (job.status === "pending" || job.status === "resolving") {
				const candidates = await googlePlaces(env, true).searchText({
					textQuery: job.place.name,
					pageSize: 3,
					fields: "candidate",
					...(job.place.lat != null && job.place.lng != null
						? {
								locationBias: {
									latitude: job.place.lat,
									longitude: job.place.lng,
									radius: 1000,
								},
							}
						: {}),
				});
				const strong = candidates.filter((candidate) =>
					isStrongMatch(job.place, candidate),
				);
				await db
					.update(placeEnrichmentJobs)
					.set(
						strong.length === 1
							? {
									status: "details",
									resolvedGooglePlaceId: strong[0]?.googlePlaceId,
									candidates,
									attempts: sql`${placeEnrichmentJobs.attempts} + 1`,
									nextAttemptAt: new Date(),
									updatedAt: new Date(),
								}
							: {
									status: candidates.length ? "ambiguous" : "unmatched",
									candidates,
									attempts: sql`${placeEnrichmentJobs.attempts} + 1`,
									completedAt: new Date(),
									updatedAt: new Date(),
								},
					)
					.where(eq(placeEnrichmentJobs.id, job.id));
				return;
			}
			const details = await googlePlaces(env, true).getDetails(
				job.resolvedGooglePlaceId as string,
			);
			await db.transaction(async (tx) => {
				const [canonical] = await tx
					.select({ id: places.id })
					.from(places)
					.where(eq(places.googlePlaceId, job.resolvedGooglePlaceId as string))
					.limit(1);
				if (canonical && canonical.id !== job.place.id) {
					// Keep every user relationship before deleting the temporary My Maps row.
					await tx.execute(sql`
            INSERT INTO saved_places (user_id, place_id, notes, directly_saved, tags, created_at)
            SELECT user_id, ${canonical.id}, notes, directly_saved, tags, created_at
            FROM saved_places WHERE place_id = ${job.place.id}
            ON CONFLICT (user_id, place_id) DO UPDATE SET
              directly_saved = saved_places.directly_saved OR excluded.directly_saved,
              notes = COALESCE(saved_places.notes, excluded.notes),
              tags = (
                SELECT array_agg(DISTINCT tag ORDER BY tag)
                FROM unnest(COALESCE(saved_places.tags, '{}') || COALESCE(excluded.tags, '{}')) AS tag
              )
          `);
					await tx.execute(sql`
            INSERT INTO collection_places (collection_id, place_id, sort_order, notes, created_at)
            SELECT collection_id, ${canonical.id}, sort_order, notes, created_at
            FROM collection_places WHERE place_id = ${job.place.id}
            ON CONFLICT (collection_id, place_id) DO UPDATE SET
              notes = COALESCE(collection_places.notes, excluded.notes)
          `);
					await tx
						.update(placeSourceKeys)
						.set({ placeId: canonical.id })
						.where(eq(placeSourceKeys.placeId, job.place.id));
					await tx.delete(places).where(eq(places.id, job.place.id));
					return;
				}
				await tx
					.update(places)
					.set({
						googlePlaceId: details.googlePlaceId,
						name: details.name,
						lat: details.lat ?? job.place.lat,
						lng: details.lng ?? job.place.lng,
						address: details.address,
						googleMapsUri: details.googleMapsUri,
						types: details.types,
						phone: details.phone,
						website: details.website,
						rating: details.rating,
						metadata: details.metadata,
						cachedAt: new Date(),
					})
					.where(eq(places.id, job.place.id));
				await tx
					.update(placeEnrichmentJobs)
					.set({
						status: "completed",
						attempts: sql`${placeEnrichmentJobs.attempts} + 1`,
						completedAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(placeEnrichmentJobs.id, job.id));
			});
		} catch (error) {
			await db
				.update(placeEnrichmentJobs)
				.set({
					status: "failed",
					attempts: sql`${placeEnrichmentJobs.attempts} + 1`,
					lastError:
						error instanceof Error ? error.message : "Google request failed",
					completedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(placeEnrichmentJobs.id, job.id));
		}
	} finally {
		await client.end();
	}
}
