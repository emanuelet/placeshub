import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({ component: Privacy });

function Privacy() {
	return (
		<article className="ui-panel mx-auto max-w-3xl space-y-6 p-5 sm:p-8">
			<h1 className="ui-page-title">PlacesHub extension privacy</h1>
			<p>
				The PlacesHub Chrome and Firefox extensions sync the Google Maps lists
				you select to your PlacesHub account. They read saved-list names, place
				names and identifiers, addresses, coordinates, notes, and available
				place details from Google Maps while you are signed in there. Sync runs
				when you request it, hourly while the browser is running, and shortly
				after startup. It is one way: PlacesHub does not change your Google Maps
				lists.
			</p>
			<section className="space-y-2">
				<h2 className="ui-section-title">Data sent to PlacesHub</h2>
				<p>
					The extension sends the selected list and place data to the PlacesHub
					address you configure, using an extension key you create in Settings →
					Google Sync. Your Google sign-in cookies and password are not sent to
					PlacesHub. PlacesHub stores imported lists, places and notes so you
					can browse them; removing a place from a Google list removes that
					collection membership on the next successful sync, while direct saves
					and cached place details can remain.
				</p>
			</section>
			<section className="space-y-2">
				<h2 className="ui-section-title">Data kept in your browser</h2>
				<p>
					The extension stores your PlacesHub address and key, list selection,
					recent sync results, and Google Maps request templates in extension
					storage, not in the Google Maps website. On supported Chrome versions,
					the extension restricts this storage to trusted extension contexts;
					Firefox does not provide that restriction. Disconnecting in extension
					settings clears these local values and removes the PlacesHub site
					permission. Revoke the key in PlacesHub Settings → Google Sync to
					prevent further uploads with it.
				</p>
			</section>
			<section className="space-y-2">
				<h2 className="ui-section-title">Site access</h2>
				<p>
					Google Maps access lets the extension read your saved lists through
					your browser session. The extension requests access to your chosen
					PlacesHub site when you connect it. It does not run on other websites
					or sell your data.
				</p>
			</section>
		</article>
	);
}
