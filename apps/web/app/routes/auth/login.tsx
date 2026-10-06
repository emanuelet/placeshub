import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth/login")({
	component: Login,
});

function Login() {
	const { signIn, signInWithGoogle, googleAuthEnabled } = useAuth();
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			await signIn(email, password);
			navigate({ to: "/dashboard" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to sign in");
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleSignIn = async () => {
		setError("");
		setLoading(true);
		try {
			await signInWithGoogle();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to sign in with Google",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-[calc(100vh-120px)] items-center justify-center py-8">
			<div className="ui-panel w-full max-w-md p-6 sm:p-8">
				<h1 className="ui-page-title mb-2">Sign in to PlacesHub</h1>
				<p className="mb-6 text-sm text-muted-foreground">
					Pick up where you left off.
				</p>

				{error && <div className="ui-alert-error mb-4">{error}</div>}

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label htmlFor="email" className="ui-field-label">
							Email
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="ui-input"
							required
						/>
					</div>
					<div>
						<label htmlFor="password" className="ui-field-label">
							Password
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="ui-input"
							required
						/>
					</div>
					<button
						type="submit"
						disabled={loading}
						className="ui-button ui-button-primary w-full"
					>
						{loading ? "Signing in..." : "Sign in"}
					</button>
				</form>

				{googleAuthEnabled && (
					<div className="mt-4">
						<button
							type="button"
							onClick={handleGoogleSignIn}
							disabled={loading}
							className="ui-button ui-button-secondary w-full"
						>
							Continue with Google
						</button>
					</div>
				)}

				<p className="mt-4 text-sm text-muted-foreground">
					Don&apos;t have an account?{" "}
					<Link
						to="/auth/signup"
						className="font-semibold text-primary hover:underline"
					>
						Sign up
					</Link>
				</p>
			</div>
		</div>
	);
}
