import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { state, navigate } = vi.hoisted(() => ({
	state: {
		pathname: "/dashboard",
		user: null as { id: string } | null,
		loading: false,
	},
	navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	createRootRoute: (options: { component: React.ComponentType }) => options,
	Link: ({ children }: { children: React.ReactNode }) => (
		<span>{children}</span>
	),
	Navigate: ({ to, replace }: { to: string; replace: boolean }) => (
		<span data-testid="redirect" data-to={to} data-replace={replace} />
	),
	Outlet: () => <span data-testid="page" />,
	useLocation: () => ({ pathname: state.pathname }),
	useNavigate: () => navigate,
}));
vi.mock("@tanstack/react-query", () => ({
	QueryClientProvider: ({ children }: { children: React.ReactNode }) =>
		children,
}));
vi.mock("@tanstack/react-router-devtools", () => ({
	TanStackRouterDevtools: () => null,
}));
vi.mock("usehooks-ts", () => ({
	useLocalStorage: (_key: string, initial: string) => [initial, vi.fn()],
	useMediaQuery: () => false,
}));
vi.mock("@repo/ui/logo", () => ({ Logo: () => <span>PlacesHub</span> }));
vi.mock("@/lib/auth", () => ({
	AuthProvider: ({ children }: { children: React.ReactNode }) => children,
	useAuth: () => ({ ...state, signOut: vi.fn() }),
}));
vi.mock("@/lib/mapContext", () => ({
	MapProvider: ({ children }: { children: React.ReactNode }) => children,
	useMapManager: () => ({ containerRef: { current: null }, mapLoaded: false }),
}));
vi.mock("@/lib/query", () => ({ queryClient: {} }));

import { Route } from "./__root";

const Root = (Route as unknown as { component: React.ComponentType }).component;

describe("signed-out navigation", () => {
	beforeEach(() => {
		state.pathname = "/dashboard";
		state.user = null;
		state.loading = false;
		navigate.mockReset();
	});

	it.each([
		"/dashboard",
		"/collections",
		"/collections/123",
		"/settings",
		"/sync",
	])("redirects %s to the marketing page", (pathname) => {
		state.pathname = pathname;
		render(<Root />);
		expect(screen.getByTestId("redirect")).toHaveAttribute("data-to", "/");
		expect(screen.getByTestId("redirect")).toHaveAttribute(
			"data-replace",
			"true",
		);
		expect(screen.queryByTestId("page")).not.toBeInTheDocument();
	});

	it("waits for authentication before redirecting", () => {
		state.loading = true;
		render(<Root />);
		expect(screen.queryByTestId("redirect")).not.toBeInTheDocument();
	});

	it.each(["/", "/privacy", "/auth/login", "/auth/signup", "/share/example"])(
		"keeps public page %s available",
		(pathname) => {
			state.pathname = pathname;
			render(<Root />);
			expect(screen.getByTestId("page")).toBeInTheDocument();
		},
	);

	it("keeps private pages available to signed-in users", () => {
		state.user = { id: "user-1" };
		render(<Root />);
		expect(screen.getByTestId("page")).toBeInTheDocument();
	});
});
