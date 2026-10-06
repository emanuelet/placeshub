import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { setPlaces, flyTo, shareData } = vi.hoisted(() => ({
	setPlaces: vi.fn(),
	flyTo: vi.fn(),
	shareData: {
		current: {
			share: {
				placesSnapshot: [
					{ id: "a", name: "Cafe", lat: 1, lng: 2, address: "Main St" },
					{ id: "b", name: "Unlocated", lat: null, lng: null },
				],
			},
		} as { share: { placesSnapshot: object[] } } | undefined,
	},
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: unknown }) => ({
		...options,
		useParams: () => ({ slug: "sample" }),
	}),
}));

vi.mock("@/hooks/useShares", () => ({
	useShare: () => ({ data: shareData.current, isLoading: false, error: null }),
}));

vi.mock("@/lib/mapContext", () => ({
	useMapManager: () => ({
		setPlaces,
		setOnPlaceClick: vi.fn(),
		setSelectedPlaceId: vi.fn(),
		flyTo,
	}),
}));

import { Route } from "./$slug";

describe("public share interactions", () => {
	it("lets a visitor focus a place while keeping places without coordinates off the map", () => {
		setPlaces.mockClear();
		flyTo.mockClear();
		const SharedView = (Route as unknown as { component: React.ComponentType })
			.component;
		render(<SharedView />);

		expect(setPlaces).toHaveBeenCalledWith([
			expect.objectContaining({ id: "a" }),
		]);
		expect(screen.getAllByRole("button", { name: "Show on map" })).toHaveLength(
			1,
		);
		fireEvent.click(screen.getByRole("button", { name: "Show on map" }));
		expect(flyTo).toHaveBeenCalledWith(1, 2);
		expect(screen.getByText("Unlocated")).toBeInTheDocument();
	});
});
