# PlacesHub

Personal Spatial CRM for curated Google Maps place bookmarks with public sharing via map + KML export.

## Stack

- **Web**: Vite + React + TanStack Router (file-based routing)
- **API**: Hono on Cloudflare Workers
- **Database**: Supabase PostgreSQL with PostGIS, Drizzle ORM
- **Maps**: Mapbox GL JS
- **Monorepo**: Turborepo
- **Linting/Formatting**: Biome

## Apps and Packages

- `@placeshub/web`: Vite + React frontend
- `@placeshub/api`: Hono API on Cloudflare Workers
- `@placeshub/db`: Drizzle ORM schema and migrations
- `@repo/ui`: Shared React components
- `@repo/typescript-config`: Shared tsconfig

## Getting Started

```sh
pnpm install
```

### Develop

```sh
pnpm dev
```

This starts the web app at http://localhost:3013 and API server on port 4000 concurrently.

### Build

```sh
pnpm build
```

### Lint & Format

```sh
pnpm check        # Biome check
pnpm format       # Biome format
pnpm check-types  # TypeScript type-check
```

## Environment

Copy `.env.example` to the repository root `.env.local` and configure:

- Supabase project URL and anon key
- Google Places API key (`GOOGLE_PLACES_API_KEY`) with Places API (New) enabled, for server-side place search. Set it in `.env.local` for local development and as a Worker secret for deployment; never expose it through `VITE_` variables.
- Mapbox access token

## Google Maps list sync (Chrome extension)

1. For a new database, apply `packages/db/supabase/001-initial.sql` first. Then apply `002-google-sync.sql` and `003-place-source-keys.sql` from the same directory, in order.
2. In Chrome, open `chrome://extensions`, enable Developer mode and **Load unpacked** from `apps/extension`.
3. Sign in to PlacesHub and open **Settings → Google Sync**. Create an extension key. In the extension popup, open **Settings** and enter the PlacesHub address and the key on its Options page. Keys can be revoked in PlacesHub settings.
4. In the same browser profile, sign in to Google Maps, open **Saved**, a list and a place within it once so Maps generates list and place-detail requests. Click **Sync now** in the extension. After discovery, select the lists to sync in its popup.

The extension checks selected lists every hour and shortly after Chrome starts. It uses the browser's signed-in Maps session to read Google's internal list and place-detail responses; Google cookies are never sent to PlacesHub. The extension key is stored locally and only grants snapshot imports. Places with a Maps CID are enriched with real Place IDs and available contact, rating and opening-hours data; places without a CID or whose detail request fails retain their basic list data. Imported memberships follow Google, while directly saved places and cached place rows remain after removal. List notes are stored on the collection membership, not on a user's direct-save note.

Google's endpoints are undocumented. An incomplete response (including a paginated list not yet supported by the captured request) is rejected rather than removing PlacesHub memberships. Lists without an ID in Google's discovery response cannot currently sync; in the captured sample, this includes default Saved places, while Starred places are not present. The extension displays failures and last-run results in its popup; live account/browser verification is required before relying on scheduled updates.

## Deploy

- **Web**: Cloudflare Pages
- **API**: Cloudflare Workers
