import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { rename, share } = vi.hoisted(() => ({
	rename: vi.fn(),
	share: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: { children: React.ReactNode }) => (
		<a href="/collections/test">{children}</a>
	),
}));
vi.mock("@/hooks/useCollections", () => ({
	useUpdateCollection: () => ({ mutateAsync: rename, isPending: false }),
}));
vi.mock("@/hooks/useShares", () => ({
	useCreateShare: () => ({ mutateAsync: share, isPending: false }),
}));

import { CollectionListItem } from "./CollectionListItem";

const collection = {
	id: "test",
	userId: "user",
	title: "Trip",
	slug: "trip",
	description: null,
	syncedFromGoogle: false,
	placeCount: 3,
	createdAt: "2026-10-06T12:00:00Z",
	updatedAt: "",
};
beforeEach(() => {
	rename.mockReset().mockResolvedValue({});
	share.mockReset().mockResolvedValue({ share: { slug: "trip-snapshot" } });
});
it("shows count/date and renames a manual collection without navigating", async () => {
	render(<CollectionListItem collection={collection} />);
	expect(
		screen.getByText("3 saved items · Created 06/10/2026"),
	).toBeInTheDocument();
	fireEvent.click(screen.getByLabelText("Actions for Trip"));
	fireEvent.click(screen.getByRole("button", { name: "Rename" }));
	fireEvent.change(screen.getByLabelText("Collection name"), {
		target: { value: "Weekend" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save name" }));
	await waitFor(() =>
		expect(rename).toHaveBeenCalledWith({ id: "test", title: "Weekend" }),
	);
});
it("shares synced collections but does not offer rename", async () => {
	render(
		<CollectionListItem
			collection={{ ...collection, syncedFromGoogle: true }}
		/>,
	);
	fireEvent.click(screen.getByLabelText("Actions for Trip"));
	expect(
		screen.queryByRole("button", { name: "Rename" }),
	).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Share snapshot" }));
	expect((screen.getByLabelText("Expiration") as HTMLSelectElement).value).toBe(
		"never",
	);
	fireEvent.click(screen.getByRole("button", { name: "Create snapshot" }));
	await waitFor(() =>
		expect(share).toHaveBeenCalledWith({
			collectionId: "test",
			expiresAt: null,
		}),
	);
	expect(
		await screen.findByRole("link", { name: /trip-snapshot/ }),
	).toHaveAttribute("href", "http://localhost:3000/share/trip-snapshot");
});
