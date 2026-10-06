import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export function createMapboxMap(
	container: HTMLDivElement,
	isDarkMode: boolean,
) {
	const map = new mapboxgl.Map({
		container,
		style: isDarkMode
			? "mapbox://styles/mapbox/dark-v11"
			: "mapbox://styles/mapbox/streets-v12",
		center: [153.0251, -27.4698],
		zoom: 12,
	});
	map.addControl(new mapboxgl.NavigationControl(), "top-right");
	map.addControl(
		new mapboxgl.GeolocateControl({
			positionOptions: { enableHighAccuracy: true },
			trackUserLocation: true,
			showUserHeading: true,
		}),
	);
	return map;
}
