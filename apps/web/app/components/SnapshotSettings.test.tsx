import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const { remove } = vi.hoisted(() => ({ remove: vi.fn() }));
vi.mock("@/hooks/useShares", () => ({
	useShares: () => ({
		data: {
			shares: [
				{
					id: "share-id",
					collectionTitle: "Trip",
					slug: "trip-test",
					placeCount: 2,
					createdAt: "2026-10-06T12:00:00Z",
				},
			],
		},
		isLoading: false,
		error: null,
	}),
	useDeleteShare: () => ({ mutate: remove, isPending: false }),
}));

import { SnapshotSettings } from "./SnapshotSettings";

it("requires confirmation to invalidate a snapshot link", () => {
	remove.mockReset();
	const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
	render(<SnapshotSettings />);
	expect(screen.getByRole("link", { name: "Trip" })).toHaveAttribute(
		"href",
		"/share/trip-test",
	);
	fireEvent.click(screen.getByRole("button", { name: /Delete snapshot/ }));
	expect(remove).not.toHaveBeenCalled();
	confirm.mockReturnValue(true);
	fireEvent.click(screen.getByRole("button", { name: /Delete snapshot/ }));
	expect(remove).toHaveBeenCalledWith("share-id");
	confirm.mockRestore();
});
