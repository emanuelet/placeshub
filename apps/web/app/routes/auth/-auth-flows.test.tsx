import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, navigate } = vi.hoisted(() => ({
	auth: {
		googleAuthEnabled: false,
		signIn: vi.fn(),
		signUp: vi.fn(),
		signInWithGoogle: vi.fn(),
	},
	navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: unknown }) => options,
	useNavigate: () => navigate,
	Link: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => auth }));

import { Route as LoginRoute } from "./login";
import { Route as SignupRoute } from "./signup";

describe("authentication interactions", () => {
	beforeEach(() => {
		auth.googleAuthEnabled = false;
		auth.signIn.mockReset();
		auth.signUp.mockReset();
		auth.signInWithGoogle.mockReset();
		navigate.mockReset();
	});

	it("does not offer Google sign-in when the provider is disabled", () => {
		const Login = (LoginRoute as unknown as { component: React.ComponentType })
			.component;
		render(<Login />);
		expect(
			screen.queryByRole("button", { name: "Continue with Google" }),
		).not.toBeInTheDocument();
	});

	it("shows an OAuth failure in the form rather than an unhandled rejection", async () => {
		auth.googleAuthEnabled = true;
		auth.signInWithGoogle.mockRejectedValue(new Error("Provider unavailable"));
		const Login = (LoginRoute as unknown as { component: React.ComponentType })
			.component;
		render(<Login />);
		fireEvent.click(
			screen.getByRole("button", { name: "Continue with Google" }),
		);
		expect(await screen.findByText("Provider unavailable")).toBeInTheDocument();
	});

	it("asks for email confirmation instead of navigating to a signed-out dashboard", async () => {
		auth.signUp.mockResolvedValue(false);
		const Signup = (
			SignupRoute as unknown as { component: React.ComponentType }
		).component;
		render(<Signup />);
		fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
			target: { value: "new@example.test" },
		});
		fireEvent.change(screen.getByLabelText("Password"), {
			target: { value: "password123" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Create account" }));
		await waitFor(() => expect(auth.signUp).toHaveBeenCalledOnce());
		expect(await screen.findByRole("status")).toHaveTextContent(
			"Check your email",
		);
		expect(navigate).not.toHaveBeenCalled();
	});
});
