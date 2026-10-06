import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/src/middleware/auth", () => ({
	auth: async (
		c: { set: (name: string, value: string) => void },
		next: () => Promise<void>,
	) => {
		c.set("userId", "user-1");
		await next();
	},
}));

import { places } from "../../../api/src/routes/places";

function search(query: string, key?: string) {
	return places.request(
		`/search?q=${encodeURIComponent(query)}`,
		{},
		{ GOOGLE_PLACES_API_KEY: key },
	);
}

describe("Google Places search API", () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns a configuration error instead of an empty list when the key is absent", async () => {
		const response = await search("coffee");
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: "Google Places search is not configured",
		});
	});

	it("returns mapped Google results without sending the API key to the browser", async () => {
		const fetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					places: [
						{
							id: "ChIJexample",
							displayName: { text: "Cafe" },
							location: { latitude: 1.5, longitude: 2.5 },
							formattedAddress: "Main St",
							googleMapsUri: "https://maps.google.com/?cid=1",
							rating: 4.7,
							userRatingCount: 120,
							regularOpeningHours: {
								weekdayDescriptions: ["Monday: 8:00 AM – 5:00 PM"],
							},
							plusCode: { globalCode: "XX22+ABC" },
						},
					],
				}),
				{ status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetch);
		const response = await search(" cafe ", "secret-key");
		expect(response.status).toBe(200);
		expect(fetch).toHaveBeenCalledWith(
			"https://places.googleapis.com/v1/places:searchText",
			expect.objectContaining({
				body: JSON.stringify({ textQuery: "cafe", pageSize: 20 }),
				headers: expect.objectContaining({ "X-Goog-Api-Key": "secret-key" }),
			}),
		);
		const body = await response.text();
		expect(body).not.toContain("secret-key");
		expect(JSON.parse(body).places[0]).toEqual(
			expect.objectContaining({
				googlePlaceId: "ChIJexample",
				name: "Cafe",
				lat: 1.5,
				lng: 2.5,
				address: "Main St",
				metadata: expect.objectContaining({
					reviewCount: 120,
					plusCode: "XX22+ABC",
					hours: [{ day: "Monday", hours: "8:00 AM – 5:00 PM" }],
				}),
			}),
		);
	});

	it("reports upstream failures instead of silently showing no results", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("error", { status: 403 })),
		);
		const response = await search("coffee", "secret-key");
		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({
			error: "Google Places search failed",
		});
	});
});
