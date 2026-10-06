import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { PlaceDetails } from "@/components/PlaceDetails";
import { useShare } from "@/hooks/useShares";
import { type MapPlace, useMapManager } from "@/lib/mapContext";

export const Route = createFileRoute("/share/$slug")({
	component: SharedView,
});

function SharedView() {
	const { slug } = Route.useParams();
	const { data, isLoading, error } = useShare(slug);
	const { setPlaces, setOnPlaceClick, setSelectedPlaceId, flyTo } =
		useMapManager();
	const [selectedId, setSelectedId] = useState<string | null>(null);

	useEffect(() => {
		if (!data?.share) {
			setPlaces([]);
			setOnPlaceClick(null);
			return;
		}
		const placesSnapshot = data.share.placesSnapshot as Array<{
			id: string;
			name: string;
			lat: number | null;
			lng: number | null;
			address?: string;
			rating?: number;
			notes?: string;
		}>;
		const mapPlaces: MapPlace[] = placesSnapshot.flatMap((p) =>
			typeof p.lat === "number" &&
			Number.isFinite(p.lat) &&
			typeof p.lng === "number" &&
			Number.isFinite(p.lng)
				? [
						{
							id: p.id,
							name: p.name,
							lat: p.lat,
							lng: p.lng,
							address: p.address,
							rating: p.rating,
							notes: p.notes,
						},
					]
				: [],
		);
		setPlaces(mapPlaces);
		setOnPlaceClick((place) => {
			setSelectedId(place.id);
			setSelectedPlaceId(place.id);
			flyTo(place.lat, place.lng);
		});
		return () => {
			setOnPlaceClick(null);
		};
	}, [data, setPlaces, setOnPlaceClick, setSelectedPlaceId, flyTo]);

	useEffect(() => {
		setSelectedPlaceId(selectedId);
	}, [selectedId, setSelectedPlaceId]);

	useEffect(() => () => setSelectedPlaceId(null), [setSelectedPlaceId]);

	if (isLoading) {
		return <div>Loading...</div>;
	}

	if (error) {
		const unavailable =
			error.message === "share not found" || error.message === "share expired";
		return (
			<div className="text-center">
				<h1 className="text-2xl font-bold mb-2">
					{error.message === "share expired"
						? "Share expired"
						: unavailable
							? "Share not found"
							: "Couldn't load this share"}
				</h1>
				<p className="text-muted-foreground">
					{unavailable ? "Ask the owner for a new link." : error.message}
				</p>
			</div>
		);
	}

	if (!data?.share) {
		return (
			<div className="text-center">
				<h1 className="text-2xl font-bold mb-2">Share not found</h1>
				<p className="text-muted-foreground">
					This share link may have expired.
				</p>
			</div>
		);
	}

	const share = data.share;
	const placesSnapshot = share.placesSnapshot as Array<{
		id: string;
		name: string;
		lat: number | null;
		lng: number | null;
		address?: string;
		rating?: number;
		notes?: string;
		googleMapsUri?: string;
	}>;
	const selected = placesSnapshot.find((place) => place.id === selectedId);

	return (
		<div
			className={`grid min-h-0 gap-3 lg:h-full ${selected ? "min-[1280px]:grid-cols-2" : ""}`}
		>
			<div className="ui-panel flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
				<h2 className="text-base font-bold tracking-tight">
					Places ({placesSnapshot.length})
				</h2>
				<div className="space-y-3">
					{placesSnapshot.map((p) => (
						<div
							key={p.id}
							className={`w-full rounded-control border bg-surface p-3 ${selectedId === p.id ? "border-primary bg-muted" : ""}`}
						>
							<p className="font-medium text-sm break-words">{p.name}</p>
							{p.address && (
								<p className="text-xs text-muted-foreground break-words">
									{p.address}
								</p>
							)}
							{p.notes && (
								<p className="text-xs text-muted-foreground mt-1 italic whitespace-pre-wrap break-words">
									{p.notes}
								</p>
							)}
							{typeof p.lat === "number" &&
								Number.isFinite(p.lat) &&
								typeof p.lng === "number" &&
								Number.isFinite(p.lng) && (
									<button
										type="button"
										onClick={() => {
											setSelectedId(p.id);
											setSelectedPlaceId(p.id);
											if (p.lat != null && p.lng != null) flyTo(p.lat, p.lng);
										}}
										className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
									>
										<MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Show
										on map
									</button>
								)}
							{(p.lat == null || p.lng == null) && (
								<button
									type="button"
									onClick={() => {
										setSelectedId(p.id);
										setSelectedPlaceId(p.id);
									}}
									className="mt-2 text-xs font-semibold text-primary underline"
								>
									Show details
								</button>
							)}
						</div>
					))}
				</div>
			</div>
			{selected && (
				<PlaceDetails
					place={selected}
					personalNotes={selected.notes}
					onClose={() => {
						setSelectedId(null);
						setSelectedPlaceId(null);
					}}
				/>
			)}
		</div>
	);
}
