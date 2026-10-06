import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authState, createCollection, importCollection, parseFile, navigate } =
	vi.hoisted(() => ({
		authState: { loggedIn: true, queryFailure: true },
		createCollection: vi.fn(),
		importCollection: vi.fn(),
		parseFile: vi.fn(),
		navigate: vi.fn(),
	}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (opts: { component: unknown }) => opts,
	useNavigate: () => navigate,
	Link: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/lib/auth", () => ({
	useAuth: () => ({
		user: authState.loggedIn ? { id: "user-1" } : null,
		loading: false,
	}),
}));

vi.mock("@/lib/mapContext", () => ({
	useMapManager: () => ({
		setPlaces: vi.fn(),
		setOnPlaceClick: vi.fn(),
		setSelectedPlaceId: vi.fn(),
	}),
}));

vi.mock("@/hooks/useCollections", () => ({
	useCollections: () => ({
		data: authState.queryFailure ? undefined : { collections: [] },
		isLoading: false,
		error: authState.queryFailure ? new Error("Network down") : null,
	}),
	useCreateCollection: () => ({
		mutateAsync: createCollection,
		isPending: false,
	}),
	useImportCollection: () => ({
		mutateAsync: importCollection,
		isPending: false,
	}),
}));

vi.mock("@/lib/my-maps-import", () => ({ parseMyMapsFile: parseFile }));

import { Route } from "./index";

describe("Collections route", () => {
	beforeEach(() => {
		authState.loggedIn = true;
		authState.queryFailure = true;
		createCollection.mockReset();
		importCollection.mockReset();
		parseFile.mockReset();
		navigate.mockReset();
	});

	it("renders an error message instead of hanging when the query fails", () => {
		const Collections = (Route as unknown as { component: React.ComponentType })
			.component;
		render(<Collections />);

		expect(screen.getByText(/couldn't load collections/i)).toBeInTheDocument();
		expect(screen.getByText("Network down")).toBeInTheDocument();
	});

	it("prompts guests to sign in rather than showing a raw unauthorized error", () => {
		authState.loggedIn = false;
		const Collections = (Route as unknown as { component: React.ComponentType })
			.component;
		render(<Collections />);

		expect(
			screen.getByText("Sign in to view your collections"),
		).toBeInTheDocument();
		expect(screen.queryByText("Network down")).not.toBeInTheDocument();
	});

	it("shows collection creation errors without leaving the form", async () => {
		authState.queryFailure = false;
		createCollection.mockRejectedValue(new Error("Name already used"));
		const Collections = (Route as unknown as { component: React.ComponentType })
			.component;
		render(<Collections />);

		fireEvent.click(screen.getByRole("button", { name: "New Collection" }));
		fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
			target: { value: "Coffee" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Create" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Name already used",
		);
		expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue(
			"Coffee",
		);
	});

	it("explains where to export and imports a selected map as one collection", async () => {
		authState.queryFailure = false;
		parseFile.mockResolvedValue({
			title: "Bali",
			places: [{ name: "Beach", lat: -8.7, lng: 115.1, notes: "Sunset" }],
			skipped: 1,
		});
		importCollection.mockResolvedValue({
			collection: { id: "collection-1" },
			imported: 1,
		});
		const Collections = (Route as unknown as { component: React.ComponentType })
			.component;
		render(<Collections />);

		fireEvent.click(screen.getByRole("button", { name: "Import map" }));
		expect(
			screen.getByRole("dialog", { name: "Import a map" }),
		).toBeInTheDocument();
		expect(screen.getByText(/Export to KML\/KMZ/)).toBeInTheDocument();
		expect(screen.getByText(/Entire map/)).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText("KML, KMZ or GeoJSON file"), {
			target: { files: [new File(["map"], "Bali.kmz")] },
		});
		expect(
			await screen.findByText(/Bali: 1 point pins ready to import/),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Import collection" }));
		await waitFor(() =>
			expect(importCollection).toHaveBeenCalledWith({
				title: "Bali",
				places: [{ name: "Beach", lat: -8.7, lng: 115.1, notes: "Sunset" }],
			}),
		);
		expect(navigate).toHaveBeenCalledWith({
			to: "/collections/$collectionId",
			params: { collectionId: "collection-1" },
		});
	});
});
