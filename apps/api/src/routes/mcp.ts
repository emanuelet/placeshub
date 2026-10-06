import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { mcpApiKeys } from "@placeshub/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Bindings } from "../index";
import { getDb } from "../lib/db";
import { GooglePlacesError, googlePlaces } from "../lib/google-places";
import {
	batch,
	changeMembership,
	deleteSavedPlaces,
	getCollection,
	listCollections,
	listSavedPlaces,
	manageCollection,
	PlaceOperationError,
	saveInput,
	savePlaces,
	placeUpdateInput,
	updatePlace,
	updateInput,
	updateSavedPlaces,
	uuid,
} from "../lib/mcp-places";
import { hashMcpKey } from "./mcp-keys";

const mcp = new Hono<{ Bindings: Bindings }>();

function buildServer(userId: string, env: Bindings) {
	const server = new McpServer({ name: "placeshub", version: "1.0.0" });
	const url = env.DATABASE_URL;
	const result = (value: unknown) => ({
		content: [{ type: "text" as const, text: JSON.stringify(value) }],
	});
	const execute = async (work: () => Promise<unknown>) => {
		try {
			return result(await work());
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text:
							error instanceof PlaceOperationError
								? error.message
								: "Operation failed",
					},
				],
				isError: true,
			};
		}
	};
	const readOnly = { readOnlyHint: true };
	const destructive = { destructiveHint: true };
	const page = {
		limit: z.number().int().min(1).max(100).default(50),
		offset: z.number().int().nonnegative().default(0),
	};

	server.registerTool(
		"list_saved_places",
		{
			description:
				"List or search your saved places by name. Returns savedPlaceId in id and global placeId in place.id; paginate with offset.",
			inputSchema: z.object({
				...page,
				query: z.string().trim().min(1).max(200).optional(),
			}),
			annotations: readOnly,
		},
		({ limit, offset, query }) =>
			execute(() => listSavedPlaces(url, userId, limit, offset, query)),
	);

	server.registerTool(
		"list_collections",
		{
			description:
				"List your collections, including whether each is Google-synced (read-only). Paginate with offset.",
			inputSchema: z.object(page),
			annotations: readOnly,
		},
		({ limit, offset }) =>
			execute(() => listCollections(url, userId, limit, offset)),
	);

	server.registerTool(
		"get_collection",
		{
			description:
				"Get an owned collection and a page of its places. Use place.id for membership tools.",
			inputSchema: z.object({ collectionId: uuid, ...page }),
			annotations: readOnly,
		},
		({ collectionId, limit, offset }) =>
			execute(() => getCollection(url, userId, collectionId, limit, offset)),
	);

	server.registerTool(
		"search_places",
		{
			description:
				"Find Google Places to save; use googlePlaceId and name in save_place. External Google Places lookup.",
			inputSchema: z.object({ query: z.string().trim().min(1).max(200) }),
			annotations: readOnly,
		},
		({ query }) =>
			execute(async () => {
				try {
					return {
						places: await googlePlaces(env).searchText({
							textQuery: query,
							pageSize: 20,
						}),
					};
				} catch (error) {
					throw new PlaceOperationError(
						error instanceof GooglePlacesError
							? error.message
							: "Google Places search failed",
					);
				}
			}),
	);

	server.registerTool(
		"add_place",
		{
			description:
				"Save one Google Place; existing shared place fields are never overwritten. Optional collectionId adds it to an owned manual collection.",
			inputSchema: saveInput,
		},
		(item) => execute(async () => (await savePlaces(url, userId, [item]))[0]),
	);
	server.registerTool(
		"bulk_save_places",
		{
			description:
				"Save 1–100 places atomically; duplicate Google IDs or any invalid collection aborts all.",
			inputSchema: z.object({ places: batch(saveInput) }),
		},
		({ places }) => execute(() => savePlaces(url, userId, places)),
	);

	server.registerTool(
		"update_place",
		{
			description:
				"Fill missing shared place fields by global placeId. Existing values, including the name, are never overwritten.",
			inputSchema: placeUpdateInput,
		},
		(item) => execute(() => updatePlace(url, userId, item)),
	);
	server.registerTool(
		"update_saved_place",
		{
			description: "Update notes/tags by savedPlaceId (not global placeId).",
			inputSchema: updateInput,
		},
		(item) =>
			execute(async () => (await updateSavedPlaces(url, userId, [item]))[0]),
	);
	server.registerTool(
		"bulk_update_saved_places",
		{
			description:
				"Update 1–100 saved places atomically; unknown or unowned ID aborts all.",
			inputSchema: z.object({ updates: batch(updateInput) }),
		},
		({ updates }) => execute(() => updateSavedPlaces(url, userId, updates)),
	);

	server.registerTool(
		"delete_saved_place",
		{
			description:
				"Delete your saved-place row by savedPlaceId; collection memberships remain.",
			inputSchema: z.object({ savedPlaceId: uuid }),
			annotations: destructive,
		},
		({ savedPlaceId }) =>
			execute(() => deleteSavedPlaces(url, userId, [savedPlaceId])),
	);
	server.registerTool(
		"bulk_delete_saved_places",
		{
			description:
				"Delete 1–100 saved-place rows atomically; collection memberships remain. Any missing or unowned ID aborts all.",
			inputSchema: z.object({ savedPlaceIds: batch(uuid) }),
			annotations: destructive,
		},
		({ savedPlaceIds }) =>
			execute(() => deleteSavedPlaces(url, userId, savedPlaceIds)),
	);

	server.registerTool(
		"add_place_to_collection",
		{
			description:
				"Add your saved place to an owned manual collection using global placeId.",
			inputSchema: z.object({ collectionId: uuid, placeId: uuid }),
		},
		({ collectionId, placeId }) =>
			execute(() =>
				changeMembership(url, userId, collectionId, [placeId], "add"),
			),
	);
	server.registerTool(
		"bulk_add_places_to_collection",
		{
			description:
				"Add 1–100 owned saved places to a manual collection atomically; invalid/unowned place aborts all.",
			inputSchema: z.object({ collectionId: uuid, placeIds: batch(uuid) }),
		},
		({ collectionId, placeIds }) =>
			execute(() =>
				changeMembership(url, userId, collectionId, placeIds, "add"),
			),
	);
	server.registerTool(
		"remove_place_from_collection",
		{
			description: "Remove membership by global placeId; saved place remains.",
			inputSchema: z.object({ collectionId: uuid, placeId: uuid }),
			annotations: destructive,
		},
		({ collectionId, placeId }) =>
			execute(() =>
				changeMembership(url, userId, collectionId, [placeId], "remove"),
			),
	);
	server.registerTool(
		"bulk_remove_places_from_collection",
		{
			description:
				"Remove 1–100 collection memberships atomically; missing membership aborts all. Saved places remain.",
			inputSchema: z.object({ collectionId: uuid, placeIds: batch(uuid) }),
			annotations: destructive,
		},
		({ collectionId, placeIds }) =>
			execute(() =>
				changeMembership(url, userId, collectionId, placeIds, "remove"),
			),
	);

	server.registerTool(
		"create_collection",
		{
			description: "Create a manual collection for your places.",
			inputSchema: z.object({
				title: z.string().trim().min(1).max(200),
				description: z.string().max(2000).nullable().optional(),
			}),
		},
		(input) =>
			execute(() =>
				manageCollection(url, userId, { action: "create", ...input }),
			),
	);
	server.registerTool(
		"update_collection",
		{
			description: "Edit an owned manual collection.",
			inputSchema: z
				.object({
					collectionId: uuid,
					title: z.string().trim().min(1).max(200).optional(),
					description: z.string().max(2000).nullable().optional(),
				})
				.refine(
					(item) => item.title !== undefined || item.description !== undefined,
				),
		},
		({ collectionId, ...input }) =>
			execute(() =>
				manageCollection(url, userId, {
					action: "update",
					id: collectionId,
					...input,
				}),
			),
	);
	server.registerTool(
		"delete_collection",
		{
			description:
				"Delete an owned manual collection and its memberships; saved places remain.",
			inputSchema: z.object({ collectionId: uuid }),
			annotations: destructive,
		},
		({ collectionId }) =>
			execute(() =>
				manageCollection(url, userId, { action: "delete", id: collectionId }),
			),
	);

	return server;
}

mcp.all("/", async (c) => {
	// Browser requests must originate from this site. Non-browser MCP clients omit Origin.
	const origin = c.req.header("Origin");
	if (origin && origin !== new URL(c.req.url).origin)
		return c.json({ error: "forbidden origin" }, 403);
	const header = c.req.header("Authorization");
	if (!header || !/^Bearer phm_[0-9a-f-]{72}$/i.test(header))
		return c.json({ error: "unauthorized" }, 401);
	const { db, client } = getDb(c.env.DATABASE_URL);
	let userId: string;
	try {
		const [key] = await db
			.update(mcpApiKeys)
			.set({ lastUsedAt: new Date() })
			.where(
				and(
					eq(mcpApiKeys.tokenHash, await hashMcpKey(header.slice(7))),
					isNull(mcpApiKeys.revokedAt),
				),
			)
			.returning({ userId: mcpApiKeys.userId });
		if (!key) return c.json({ error: "unauthorized" }, 401);
		userId = key.userId;
	} finally {
		await client.end();
	}
	return createMcpHandler(() => buildServer(userId, c.env)).fetch(c.req.raw);
});

export { mcp };
