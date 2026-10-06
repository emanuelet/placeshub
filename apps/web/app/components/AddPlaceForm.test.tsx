import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("usehooks-ts", () => ({
	useDebounceValue: (value: string) => [value],
}));
vi.mock("@/hooks/useCollections", () => ({
	useCollections: () => ({
		data: {
			collections: [
				{ id: "manual-id", title: "Weekend", syncedFromGoogle: false },
				{ id: "google-id", title: "Google List", syncedFromGoogle: true },
			],
		},
		isLoading: false,
		error: null,
	}),
}));
vi.mock("@/hooks/usePlaces", () => ({
	toSavePlaceInput: (place: object) => place,
	useSavePlace: () => ({ mutateAsync: save, isPending: false }),
	useSearchPlaces: (query: string) => ({
		data:
			query.length >= 2
				? {
						places: [
							{
								googlePlaceId: "ChIJexample",
								name: "Cafe",
								address: "Main St",
							},
						],
					}
				: undefined,
		isLoading: false,
		error: null,
	}),
}));

import { AddPlaceForm } from "./AddPlaceForm";

describe("adding places", () => {
	beforeEach(() =>
		save.mockReset().mockResolvedValue({ place: { id: "place-1" } }),
	);

	it("saves a Google result with optional notes and a chosen manual collection", async () => {
		const onAdded = vi.fn();
		render(<AddPlaceForm onAdded={onAdded} onCancel={vi.fn()} />);
		expect(
			screen.getByRole("dialog", { name: "Add a place" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("option", { name: "Google List" }),
		).not.toBeInTheDocument();
		fireEvent.change(
			screen.getByRole("combobox", { name: "Collection (optional)" }),
			{
				target: { value: "manual-id" },
			},
		);
		fireEvent.change(
			screen.getByRole("textbox", { name: "Personal notes (optional)" }),
			{
				target: { value: "Good pastries" },
			},
		);
		const input = screen.getByRole("combobox", {
			name: "Search Google Places",
		});
		fireEvent.change(input, {
			target: { value: "cafe" },
		});
		expect(input.parentElement?.nextElementSibling).toBe(
			screen.getByRole("listbox", { name: "Place suggestions" }),
		);
		fireEvent.click(screen.getByRole("option", { name: /Cafe/ }));
		expect(save).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Save place" }));
		await waitFor(() =>
			expect(save).toHaveBeenCalledWith(
				expect.objectContaining({
					collectionId: "manual-id",
					googlePlaceId: "ChIJexample",
					notes: "Good pastries",
				}),
			),
		);
		expect(onAdded).toHaveBeenCalledWith("place-1");
	});

	it("preselects the current collection in its add-place flow", async () => {
		render(
			<AddPlaceForm
				collectionId="manual-id"
				onAdded={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);
		expect(
			screen.queryByRole("combobox", { name: "Collection (optional)" }),
		).not.toBeInTheDocument();
		fireEvent.change(
			screen.getByRole("combobox", { name: "Search Google Places" }),
			{
				target: { value: "cafe" },
			},
		);
		fireEvent.click(screen.getByRole("option", { name: /Cafe/ }));
		fireEvent.click(screen.getByRole("button", { name: "Save place" }));
		await waitFor(() =>
			expect(save).toHaveBeenCalledWith(
				expect.objectContaining({ collectionId: "manual-id" }),
			),
		);
	});

	it("supports keyboard selection and cancelling the modal", () => {
		const onCancel = vi.fn();
		render(<AddPlaceForm onAdded={vi.fn()} onCancel={onCancel} />);
		const input = screen.getByRole("combobox", {
			name: "Search Google Places",
		});
		fireEvent.change(input, { target: { value: "cafe" } });
		fireEvent.keyDown(input, { key: "ArrowDown" });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(screen.getByRole("button", { name: "Save place" })).toBeEnabled();
		expect(
			screen.queryByRole("listbox", { name: "Place suggestions" }),
		).not.toBeInTheDocument();
		fireEvent.click(
			screen.getByRole("button", { name: "Close add place dialog" }),
		);
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("stays open when Strict Mode replays dialog effects", () => {
		const prototype = HTMLDialogElement.prototype;
		const originalShow = Object.getOwnPropertyDescriptor(
			prototype,
			"showModal",
		);
		const originalClose = Object.getOwnPropertyDescriptor(prototype, "close");
		Object.defineProperty(prototype, "showModal", {
			configurable: true,
			value(this: HTMLDialogElement) {
				this.setAttribute("open", "");
			},
		});
		Object.defineProperty(prototype, "close", {
			configurable: true,
			value(this: HTMLDialogElement) {
				this.removeAttribute("open");
				this.dispatchEvent(new Event("close"));
			},
		});

		function DialogHost() {
			const [open, setOpen] = useState(true);
			return open ? (
				<AddPlaceForm onAdded={vi.fn()} onCancel={() => setOpen(false)} />
			) : null;
		}

		try {
			render(
				<StrictMode>
					<DialogHost />
				</StrictMode>,
			);
			expect(
				screen.getByRole("dialog", { name: "Add a place" }),
			).toHaveAttribute("open");
		} finally {
			if (originalShow)
				Object.defineProperty(prototype, "showModal", originalShow);
			else Reflect.deleteProperty(prototype, "showModal");
			if (originalClose)
				Object.defineProperty(prototype, "close", originalClose);
			else Reflect.deleteProperty(prototype, "close");
		}
	});
});
