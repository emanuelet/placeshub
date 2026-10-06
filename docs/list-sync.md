# Google Maps list sync (Chrome and Firefox)

Store downloads are not published yet. For release requirements, see
[extension publishing](extension-publishing.md).

1. Apply [database migrations](database-migrations.md) if setting up a new
   database. Build both packages with `pnpm --filter @placeshub/extension build`.
2. In Chrome, open `chrome://extensions`, enable Developer mode, then choose
   **Load unpacked** from `apps/extension/dist/chrome`. In Firefox, open
   `about:debugging#/runtime/this-firefox` and temporarily load
   `apps/extension/dist/firefox/manifest.json`.
3. Sign in to PlacesHub, open **Settings → Google Sync**, and create an extension
   key. Open **Settings** in the extension popup and enter the PlacesHub origin
   and key. Use `https://placeshub.org`, your self-hosted HTTPS origin, or
   `http://localhost:3013` for local development.
4. In the same browser profile, sign in to Google Maps. Open **Saved**, each list
   you want to sync, and a place's full details card. Click **Sync now** and
   select lists in the popup. Reload the extension after updating its files.

The extension checks selected lists hourly and shortly after browser startup.
It uses your signed-in Maps session; Google cookies are never sent to PlacesHub.
The key stays in local browser storage and grants snapshot imports only.
Available place details include contact, ratings and hours; places that cannot
be enriched retain their basic list data.

Imported memberships follow Google. Directly saved places remain after removal
from a list. List notes belong to the collection membership, separate from
personal notes. Disconnecting clears local connection data; revoke the key in
PlacesHub to prevent future uploads.

Google's list endpoints are undocumented. Sync rejects incomplete or
unverifiable empty responses rather than removing memberships. A response-format
error shows a structural summary, not place data. If **Favorite places** or
another list fails after opening it in Maps, use that summary to diagnose it.
Lists without an ID in Google's discovery response cannot sync.
