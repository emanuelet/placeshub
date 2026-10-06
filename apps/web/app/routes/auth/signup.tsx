import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth/signup")({
	component: Signup,
});

function Signup() {
	const { signUp, signInWithGoogle, googleAuthEnabled } = useAuth();
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSuccess("");
		setLoading(true);
		try {
			const signedIn = await signUp(email, password, displayName || undefined);
			if (signedIn) navigate({ to: "/dashboard" });
			else
				setSuccess(
					"Check your email to confirm your account before signing in.",
				);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to sign up");
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
				<h1 className="ui-page-title mb-2">Create your account</h1>
				<p className="mb-6 text-sm text-muted-foreground">
					Save the places worth remembering.
				</p>

				{error && <div className="ui-alert-error mb-4">{error}</div>}
				{success && (
					<div role="status" className="ui-alert-success mb-4">
						{success}
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label htmlFor="display-name" className="ui-field-label">
							Display name
						</label>
						<input
							id="display-name"
							type="text"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							className="ui-input"
						/>
					</div>
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
							minLength={6}
						/>
					</div>
					<button
						type="submit"
						disabled={loading}
						className="ui-button ui-button-primary w-full"
					>
						{loading ? "Creating account..." : "Create account"}
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
					Already have an account?{" "}
					<Link
						to="/auth/login"
						className="font-semibold text-primary hover:underline"
					>
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
