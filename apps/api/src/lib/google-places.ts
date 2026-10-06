import { sql } from "drizzle-orm";
import { getDb } from "./db";

const dailyLimit = 1000;
const backgroundSpacingMs = 96_000;
const candidateFields =
	"places.id,places.displayName,places.location,places.formattedAddress";
const fullFields =
	"places.id,places.displayName,places.location,places.formattedAddress,places.googleMapsUri,places.types,places.nationalPhoneNumber,places.websiteUri,places.rating,places.businessStatus,places.priceLevel,places.userRatingCount,places.regularOpeningHours.weekdayDescriptions,places.plusCode.globalCode";

export class GooglePlacesError extends Error {
	constructor(
		message: string,
		readonly status = 502,
	) {
		super(message);
	}
}

export type GooglePlace = {
	googlePlaceId: string;
	name: string;
	lat: number | null;
	lng: number | null;
	address: string | null;
	googleMapsUri: string | null;
	types: string[];
	phone: string | null;
	website: string | null;
	rating: number | null;
	metadata: Record<string, unknown>;
};
type RawPlace = {
	id?: string;
	displayName?: { text?: string };
	location?: { latitude?: number; longitude?: number };
	formattedAddress?: string;
	googleMapsUri?: string;
	types?: string[];
	nationalPhoneNumber?: string;
	websiteUri?: string;
	rating?: number;
	businessStatus?: string;
	priceLevel?: string;
	userRatingCount?: number;
	regularOpeningHours?: { weekdayDescriptions?: string[] };
	plusCode?: { globalCode?: string };
};

function pacificDay() {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Los_Angeles",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(new Date());
	return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

async function reserveGoogleRequest(databaseUrl: string, background: boolean) {
	const { db, client } = getDb(databaseUrl);
	try {
		const now = new Date();
		const rows = await db.execute(sql<{ attempts: number }>`
      INSERT INTO google_request_usage (day, attempts, next_request_at, updated_at)
      VALUES (${pacificDay()}::date, 1, ${new Date(now.getTime() + backgroundSpacingMs)}, ${now})
      ON CONFLICT (day) DO UPDATE SET
        attempts = google_request_usage.attempts + 1,
        next_request_at = CASE WHEN ${background} THEN GREATEST(google_request_usage.next_request_at, ${now}) + interval '96 seconds' ELSE google_request_usage.next_request_at END,
        updated_at = ${now}
      WHERE google_request_usage.attempts < ${dailyLimit}
        AND (NOT ${background} OR google_request_usage.next_request_at <= ${now})
      RETURNING attempts
    `);
		if (!rows.length)
			throw new GooglePlacesError(
				"Google Places request budget is exhausted or paced",
				429,
			);
	} finally {
		await client.end();
	}
}

function mapPlace(place: RawPlace): GooglePlace | null {
	if (!place.id || !place.displayName?.text) return null;
	return {
		googlePlaceId: place.id,
		name: place.displayName.text,
		lat: place.location?.latitude ?? null,
		lng: place.location?.longitude ?? null,
		address: place.formattedAddress ?? null,
		googleMapsUri: place.googleMapsUri ?? null,
		types: place.types ?? [],
		phone: place.nationalPhoneNumber ?? null,
		website: place.websiteUri ?? null,
		rating: place.rating ?? null,
		metadata: {
			...(place.businessStatus ? { businessStatus: place.businessStatus } : {}),
			...(place.priceLevel ? { priceLevel: place.priceLevel } : {}),
			...(place.userRatingCount != null
				? { reviewCount: place.userRatingCount }
				: {}),
			...(place.plusCode?.globalCode
				? { plusCode: place.plusCode.globalCode }
				: {}),
			...(place.regularOpeningHours?.weekdayDescriptions
				? {
						hours: place.regularOpeningHours.weekdayDescriptions.map(
							(description) => {
								const separator = description.indexOf(":");
								return {
									day:
										separator < 0
											? description
											: description.slice(0, separator),
									hours:
										separator < 0
											? ""
											: description.slice(separator + 1).trim(),
								};
							},
						),
					}
				: {}),
		},
	};
}

export function googlePlaces(
	env: { DATABASE_URL: string; GOOGLE_PLACES_API_KEY?: string },
	background = false,
) {
	if (!env.GOOGLE_PLACES_API_KEY)
		throw new GooglePlacesError("Google Places search is not configured", 503);
	const request = async (
		url: string,
		init: { method: string; body?: string },
		fieldMask: string,
	) => {
		await reserveGoogleRequest(env.DATABASE_URL, background);
		const response = await fetch(url, {
			...init,
			headers: {
				"Content-Type": "application/json",
				"X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY as string,
				"X-Goog-FieldMask": fieldMask,
			},
		});
		if (!response.ok)
			throw new GooglePlacesError(
				`Google Places request failed (${response.status})`,
				response.status === 429 ? 429 : 502,
			);
		return response.json();
	};
	return {
		async searchText(input: {
			textQuery: string;
			pageSize: number;
			locationBias?: { latitude: number; longitude: number; radius: number };
			fields?: "candidate" | "full";
		}) {
			const body = (await request(
				"https://places.googleapis.com/v1/places:searchText",
				{
					method: "POST",
					body: JSON.stringify({
						textQuery: input.textQuery,
						pageSize: input.pageSize,
						...(input.locationBias
							? {
									locationBias: {
										circle: {
											center: {
												latitude: input.locationBias.latitude,
												longitude: input.locationBias.longitude,
											},
											radius: input.locationBias.radius,
										},
									},
								}
							: {}),
					}),
				},
				input.fields === "candidate" ? candidateFields : fullFields,
			)) as { places?: RawPlace[] };
			return (body.places ?? []).flatMap((place) => {
				const mapped = mapPlace(place);
				return mapped ? [mapped] : [];
			});
		},
		async getDetails(googlePlaceId: string) {
			const body = (await request(
				`https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}`,
				{ method: "GET" },
				fullFields,
			)) as RawPlace;
			const place = mapPlace(body);
			if (!place)
				throw new GooglePlacesError("Google Places details were incomplete");
			return place;
		},
	};
}
