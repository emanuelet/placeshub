import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/sync")({
	component: () => (
		<Navigate to="/settings" search={{ tab: "google-sync" }} replace />
	),
});
