import JSZip from "jszip";
import { z } from "zod";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_KML_BYTES = 5 * 1024 * 1024;
const MAX_PLACES = 3000;

export interface ImportedPin {
	name: string;
	lat: number;
	lng: number;
	notes: string | null;
}

export interface MyMapsImport {
	title: string;
	places: ImportedPin[];
	skipped: number;
}

function child(element: Element, name: string): Element | undefined {
	return Array.from(element.children).find((item) => item.localName === name);
}

function text(element: Element, name: string) {
	return child(element, name)?.textContent?.trim() ?? "";
}

export function parseMyMapsKml(xml: string): MyMapsImport {
	if (new TextEncoder().encode(xml).length > MAX_KML_BYTES) {
		throw new Error("The KML is too large (maximum 5 MB).");
	}
	if (/<!DOCTYPE|<!ENTITY/i.test(xml))
		throw new Error("KML document types are not supported.");
	const document = new DOMParser().parseFromString(xml, "application/xml");
	if (
		document.getElementsByTagName("parsererror").length ||
		document.documentElement.localName !== "kml"
	) {
		throw new Error("This file is not valid KML.");
	}
	const map = document.getElementsByTagNameNS("*", "Document")[0];
	if (!map) throw new Error("No map was found in this KML file.");
	const title = text(map, "name") || "Imported map";
	if (title.length > 200) throw new Error("The map name is too long.");

	const placemarks = Array.from(
		document.getElementsByTagNameNS("*", "Placemark"),
	);
	if (placemarks.length > MAX_PLACES)
		throw new Error("The map has too many pins (maximum 3,000).");
	const places: ImportedPin[] = [];
	const seen = new Set<string>();
	let skipped = 0;
	for (const placemark of placemarks) {
		const point = placemark.getElementsByTagNameNS("*", "Point")[0];
		const coordinates = point
			? text(point, "coordinates").split(/\s+/)[0]?.split(",")
			: undefined;
		const lng = Number(coordinates?.[0]);
		const lat = Number(coordinates?.[1]);
		const name = text(placemark, "name");
		const notes = text(placemark, "description") || null;
		if (
			!point ||
			!coordinates ||
			coordinates.length < 2 ||
			!coordinates[0] ||
			!coordinates[1] ||
			!Number.isFinite(lat) ||
			!Number.isFinite(lng) ||
			Math.abs(lat) > 90 ||
			Math.abs(lng) > 180 ||
			!name ||
			name.length > 500 ||
			(notes?.length ?? 0) > 5000
		) {
			skipped++;
			continue;
		}
		const key = JSON.stringify([name.trim().toLowerCase(), lat, lng]);
		if (seen.has(key)) {
			skipped++;
			continue;
		}
		seen.add(key);
		places.push({ name, lat, lng, notes });
	}
	if (!places.length) throw new Error("No point pins were found in this map.");
	return { title, places, skipped };
}

export async function parseMyMapsFile(file: File): Promise<MyMapsImport> {
	if (file.size > MAX_FILE_BYTES)
		throw new Error("The file is too large (maximum 10 MB).");
	const extension = file.name.toLowerCase().split(".").pop();
	if (extension === "kml") return parseMyMapsKml(await file.text());
	if (extension === "geojson")
		return parseGeoJson(
			await file.text(),
			file.name.replace(/\.geojson$/i, ""),
		);
	if (extension !== "kmz")
		throw new Error("Choose a .kml, .kmz or .geojson file.");

	let zip: JSZip;
	try {
		zip = await JSZip.loadAsync(await file.arrayBuffer());
	} catch {
		throw new Error("This KMZ file could not be opened.");
	}
	const kml =
		Object.values(zip.files).find(
			(entry) => !entry.dir && entry.name.toLowerCase() === "doc.kml",
		) ??
		Object.values(zip.files).find(
			(entry) => !entry.dir && entry.name.toLowerCase().endsWith(".kml"),
		);
	if (!kml) throw new Error("No KML map was found inside this KMZ file.");
	// JSZip exposes the ZIP central-directory size here, before decompressing an entry.
	const size = (kml as typeof kml & { _data?: { uncompressedSize?: number } })
		._data?.uncompressedSize;
	if (size == null || size > MAX_KML_BYTES)
		throw new Error("The KML is too large (maximum 5 MB).");
	return parseMyMapsKml(await kml.async("string"));
}

export function parseGeoJson(
	json: string,
	fallbackTitle = "Imported map",
): MyMapsImport {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		throw new Error("This file is not valid GeoJSON.");
	}
	const collection = z
		.object({
			type: z.literal("FeatureCollection"),
			name: z.string().optional(),
			features: z.array(z.unknown()),
		})
		.safeParse(parsed);
	if (!collection.success) {
		throw new Error("Choose a GeoJSON FeatureCollection.");
	}
	const data = collection.data;
	if (data.features.length > MAX_PLACES)
		throw new Error("The map has too many pins (maximum 3,000).");
	const title =
		typeof data.name === "string" && data.name.trim()
			? data.name.trim()
			: fallbackTitle;
	if (title.length > 200) throw new Error("The map name is too long.");
	const places: ImportedPin[] = [];
	const seen = new Set<string>();
	let skipped = 0;
	const pointSchema = z.object({
		type: z.literal("Feature"),
		geometry: z.object({
			type: z.literal("Point"),
			coordinates: z.array(z.number()).min(2),
		}),
		properties: z.object({
			name: z.string(),
			description: z.string().nullish(),
		}),
	});
	for (const item of data.features) {
		const result = pointSchema.safeParse(item);
		if (!result.success) {
			skipped++;
			continue;
		}
		const feature = result.data;
		const name = feature.properties.name.trim();
		const notes = feature.properties.description?.trim() || null;
		const [lng, lat] = feature.geometry.coordinates;
		if (
			typeof lat !== "number" ||
			typeof lng !== "number" ||
			!Number.isFinite(lat) ||
			!Number.isFinite(lng) ||
			Math.abs(lat) > 90 ||
			Math.abs(lng) > 180 ||
			!name ||
			name.length > 500 ||
			(notes?.length ?? 0) > 5000
		) {
			skipped++;
			continue;
		}
		const key = JSON.stringify([name.toLowerCase(), lat, lng]);
		if (seen.has(key)) {
			skipped++;
			continue;
		}
		seen.add(key);
		places.push({ name, lat, lng, notes });
	}
	if (!places.length) throw new Error("No point pins were found in this map.");
	return { title, places, skipped };
}
