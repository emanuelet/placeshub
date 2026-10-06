import { Trash2 } from "lucide-react";
import { useDeleteShare, useShares } from "@/hooks/useShares";
import { formatDate } from "@/lib/date";

export function SnapshotSettings() {
	const { data, isLoading, error } = useShares();
	const remove = useDeleteShare();
	return (
		<section
			className="ui-panel space-y-4 p-5"
			aria-labelledby="snapshots-heading"
		>
			<h2 id="snapshots-heading" className="ui-section-title">
				Snapshots
			</h2>
			<p className="text-sm text-muted-foreground">
				Public collection snapshots you have created. Deleting one invalidates
				its share link.
			</p>
			{isLoading && <p role="status">Loading snapshots...</p>}
			{(error || remove.error) && (
				<p role="alert" className="ui-alert-error">
					{error?.message || remove.error?.message}
				</p>
			)}
			{data?.shares.length === 0 && (
				<p className="ui-empty-state">No snapshots yet.</p>
			)}
			{data?.shares.map((share) => (
				<div
					key={share.id}
					className="flex flex-wrap items-center gap-3 rounded-control border p-3"
				>
					<div className="min-w-0 flex-1">
						<a
							href={`/share/${share.slug}`}
							target="_blank"
							rel="noopener noreferrer"
							className="break-words font-semibold text-primary hover:underline"
						>
							{share.collectionTitle}
						</a>
						<p className="text-xs text-muted-foreground">
							{share.placeCount} places · Created {formatDate(share.createdAt)}
						</p>
						{share.expiresAt && (
							<p className="text-xs text-muted-foreground">
								Expires {formatDate(share.expiresAt)}
							</p>
						)}
					</div>
					<button
						type="button"
						className="ui-button ui-button-danger gap-2"
						aria-label={`Delete snapshot of ${share.collectionTitle} created ${formatDate(share.createdAt)}`}
						disabled={remove.isPending}
						onClick={() => {
							if (
								window.confirm(
									`Delete this snapshot of “${share.collectionTitle}”? Its public link will stop working.`,
								)
							)
								remove.mutate(share.id);
						}}
					>
						<Trash2 className="h-4 w-4" aria-hidden="true" />
						Delete
					</button>
				</div>
			))}
		</section>
	);
}
