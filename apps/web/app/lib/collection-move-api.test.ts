import { beforeEach, describe, expect, it, vi } from "vitest";

const sourceId = "10000000-0000-4000-8000-000000000001";
const placeId = "20000000-0000-4000-8000-000000000002";
const secondPlaceId = "20000000-0000-4000-8000-000000000004";
const targetId = "30000000-0000-4000-8000-000000000003";

const { state } = vi.hoisted(() => ({
	state: {
		queryCount: 0,
		sourceHasPlace: true,
		targetOwned: true,
		targetSynced: false,
		targetHasPlace: false,
		sourceRows: [] as Array<{ placeId: string; notes: string | null }>,
		insertedRows: [] as Array<{
			collectionId: string;
			placeId: string;
			notes: string | null;
			sortOrder: number;
		}>,
		removed: false,
	},
}));

vi.mock("../../../api/src/middleware/auth", () => ({
	auth: async (
		c: { set: (name: string, value: string) => void },
		next: () => Promise<void>,
	) => {
		c.set("userId", "user-1");
		await next();
	},
}));

vi.mock("../../../api/src/lib/db", () => ({
	getDb: () => {
		const tx = {
			select: () => {
				const index = state.queryCount++;
				return {
					from: () => ({
						where: () =>
							index === 5
								? Promise.resolve([{ sortOrder: 2 }])
								: {
										for: async () =>
											index === 0 || (index === 2 && state.targetOwned)
												? [{ id: "collection" }]
												: [],
										limit: async () =>
											index === 3 && state.targetSynced
												? [{ id: "synced" }]
												: [],
										orderBy: () => ({
											for: async () =>
												state.sourceHasPlace ? state.sourceRows : [],
										}),
									},
					}),
				};
			},
			insert: () => ({
				values: (rows: typeof state.insertedRows) => {
					state.insertedRows = rows;
					return {
						onConflictDoNothing: () => ({
							returning: async () =>
								state.targetHasPlace
									? []
									: state.insertedRows.map((row) => ({ placeId: row.placeId })),
						}),
					};
				},
			}),
			delete: () => ({
				where: async () => {
					state.removed = true;
				},
			}),
		};
		type FakeTx = typeof tx;
		return {
			db: {
				transaction: async (fn: (transaction: FakeTx) => Promise<object>) =>
					fn(tx),
			},
			client: { end: async () => {} },
		};
	},
}));

import { collections } from "../../../api/src/routes/collections";

async function move(body: object) {
	return collections.request(
		`/${sourceId}/places/move`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
		{ DATABASE_URL: "unused" },
	);
}

describe("manual collection moves", () => {
	beforeEach(() => {
		state.queryCount = 0;
		state.sourceHasPlace = true;
		state.targetOwned = true;
		state.targetSynced = false;
		state.targetHasPlace = false;
		state.sourceRows = [{ placeId, notes: "Keep this note" }];
		state.insertedRows = [];
		state.removed = false;
	});

	it("appends the place with its collection note, then removes the source membership", async () => {
		const response = await move({
			targetCollectionId: targetId,
			placeIds: [placeId],
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ movedCount: 1, addedCount: 1 });
		expect(state.insertedRows).toEqual([
			{
				collectionId: targetId,
				placeId,
				notes: "Keep this note",
				sortOrder: 3,
			},
		]);
		expect(state.removed).toBe(true);
	});

	it("does not overwrite a place already in the destination", async () => {
		state.targetHasPlace = true;
		const response = await move({
			targetCollectionId: targetId,
			placeIds: [placeId],
		});
		expect(await response.json()).toEqual({ movedCount: 1, addedCount: 0 });
		expect(state.removed).toBe(true);
	});

	it("moves multiple places in source order as one operation", async () => {
		state.sourceRows = [
			{ placeId, notes: "First note" },
			{ placeId: secondPlaceId, notes: null },
		];
		const response = await move({
			targetCollectionId: targetId,
			placeIds: [secondPlaceId, placeId],
		});
		expect(await response.json()).toEqual({ movedCount: 2, addedCount: 2 });
		expect(state.insertedRows).toEqual([
			{ collectionId: targetId, placeId, notes: "First note", sortOrder: 3 },
			{
				collectionId: targetId,
				placeId: secondPlaceId,
				notes: null,
				sortOrder: 4,
			},
		]);
	});

	it("does not move anything if a requested source place is missing", async () => {
		state.sourceHasPlace = false;
		const response = await move({
			targetCollectionId: targetId,
			placeIds: [placeId],
		});
		expect(response.status).toBe(404);
		expect(state.insertedRows).toEqual([]);
		expect(state.removed).toBe(false);
	});

	it.each([
		["not owned", false, false, 404],
		["Google-synced", true, true, 403],
	])("rejects a %s destination", async (_label, owned, synced, status) => {
		state.targetOwned = owned;
		state.targetSynced = synced;
		const response = await move({
			targetCollectionId: targetId,
			placeIds: [placeId],
		});
		expect(response.status).toBe(status);
		expect(state.insertedRows).toEqual([]);
		expect(state.removed).toBe(false);
	});

	it("rejects a move into the same collection", async () => {
		const response = await move({
			targetCollectionId: sourceId,
			placeIds: [placeId],
		});
		expect(response.status).toBe(400);
		expect(state.removed).toBe(false);
	});
});
