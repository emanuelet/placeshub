import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute:
		() =>
		(options: {
			component: React.ComponentType;
			validateSearch: (search: Record<string, unknown>) => { tab: string };
		}) => ({ ...options, useSearch: () => ({ tab: "appearance" }) }),
	Link: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/GoogleSyncSettings", () => ({
	GoogleSyncSettings: () => null,
}));
vi.mock("@/components/McpSettings", () => ({ McpSettings: () => null }));
vi.mock("@/components/SnapshotSettings", () => ({
	SnapshotSettings: () => null,
}));

import { Route } from "./settings";

it("offers three persistent palettes and accepts the snapshots tab", async () => {
	localStorage.removeItem("palette");
	const options = Route as unknown as {
		component: React.ComponentType;
		validateSearch: (search: Record<string, unknown>) => { tab: string };
	};
	const Settings = options.component;
	render(<Settings />);
	expect(screen.getByRole("radio", { name: "Blue & orange" })).toBeChecked();
	fireEvent.click(screen.getByRole("radio", { name: "Teal & amber" }));
	await waitFor(() => expect(localStorage.getItem("palette")).toBe('"teal"'));
	fireEvent.click(screen.getByRole("radio", { name: "Purple & rose" }));
	await waitFor(() => expect(localStorage.getItem("palette")).toBe('"purple"'));
	expect(options.validateSearch({ tab: "snapshots" })).toEqual({
		tab: "snapshots",
	});
	localStorage.removeItem("palette");
});
