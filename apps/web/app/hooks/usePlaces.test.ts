import { describe, expect, it } from "vitest";
import { toSavePlaceInput } from "@/hooks/usePlaces";

describe("toSavePlaceInput", () => {
	it("uses the real coordinates and address from a search result, not a hardcoded stub", () => {
		const result = toSavePlaceInput({
			id: "p1",
			googlePlaceId: "gp1",
			name: "Sydney Opera House",
			lat: -33.8568,
			lng: 151.2153,
			address: "Bennelong Point, Sydney NSW",
			googleMapsUri: "https://maps.google.com/?cid=1",
			types: ["tourist_attraction"],
			phone: null,
			website: null,
			rating: 4.7,
		});

		expect(result.lat).toBe(-33.8568);
		expect(result.lng).toBe(151.2153);
		expect(result.address).toBe("Bennelong Point, Sydney NSW");
		expect(result.lat).not.toBe(51.5074);
		expect(result.lng).not.toBe(-0.1276);
	});

	it("maps null fields to undefined", () => {
		const result = toSavePlaceInput({
			id: "p1",
			googlePlaceId: "gp1",
			name: "Somewhere",
			lat: null,
			lng: null,
			address: null,
			googleMapsUri: null,
			types: null,
			phone: null,
			website: null,
			rating: null,
		});

		expect(result.lat).toBeUndefined();
		expect(result.lng).toBeUndefined();
		expect(result.address).toBeUndefined();
	});
});
