import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Key = {
	id: string;
	name: string;
	createdAt: string;
	lastUsedAt: string | null;
};

export function McpSettings() {
	const { user, loading } = useAuth();
	const [keys, setKeys] = useState<Key[]>([]);
	const [name, setName] = useState("My AI agent");
	const [token, setToken] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const refresh = useCallback(async () => {
		const result = await api.get<{ keys: Key[] }>("/mcp/keys");
		setKeys(result.keys);
	}, []);

	useEffect(() => {
		if (user?.id) refresh().catch((e) => setError(e.message));
	}, [user?.id, refresh]);

	if (loading) return <p className="text-muted-foreground">Loading...</p>;
	if (!user)
		return (
			<p>
				<Link to="/auth/login" className="underline">
					Sign in
				</Link>{" "}
				to create an MCP key.
			</p>
		);

	const create = async () => {
		setBusy(true);
		setError(null);
		setToken(null);
		try {
			const result = await api.post<{ token: string }>("/mcp/keys", { name });
			setToken(result.token);
			await refresh();
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setBusy(false);
		}
	};

	const revoke = async (id: string) => {
		setBusy(true);
		setError(null);
		try {
			await api.delete(`/mcp/keys/${id}`);
			setToken(null);
			await refresh();
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<section className="ui-panel space-y-5 p-5">
			<h2 className="ui-section-title">AI agent access</h2>
			<p>
				Use a dedicated key to manage your places and collections via stateless
				MCP. Keys can make changes; keep them private and revoke them when no
				longer needed.
			</p>
			<p>
				MCP URL: <code>{window.location.origin}/api/mcp</code>
			</p>
			<label className="block" htmlFor="mcp-key-name">
				Key name
			</label>
			<input
				id="mcp-key-name"
				className="ui-input"
				maxLength={100}
				value={name}
				onChange={(e) => setName(e.target.value)}
			/>
			<button
				type="button"
				className="ui-button ui-button-primary"
				disabled={busy || !name.trim()}
				onClick={create}
			>
				Create MCP key
			</button>
			{token && (
				<div className="space-y-2">
					<p>
						Copy this key now. It is shown only once. Send it as{" "}
						<code>Authorization: Bearer &lt;key&gt;</code>.
					</p>
					<textarea
						className="ui-input w-full"
						readOnly
						value={token}
						aria-label="MCP key"
						rows={2}
					/>
					<button
						type="button"
						className="ui-button ui-button-secondary"
						onClick={() =>
							navigator.clipboard
								.writeText(token)
								.catch(() => setError("Select the key above to copy it."))
						}
					>
						Copy key
					</button>
				</div>
			)}
			{error && <p className="ui-alert-error">{error}</p>}
			<h3 className="ui-section-title">Active keys</h3>
			{keys.map((key) => (
				<div key={key.id} className="ui-list-row">
					<span>
						{key.name} · Created {new Date(key.createdAt).toLocaleString()} ·
						Last used{" "}
						{key.lastUsedAt
							? new Date(key.lastUsedAt).toLocaleString()
							: "never"}
					</span>
					<button
						type="button"
						className="ui-button ui-button-danger"
						disabled={busy}
						onClick={() => revoke(key.id)}
					>
						Revoke
					</button>
				</div>
			))}
		</section>
	);
}
