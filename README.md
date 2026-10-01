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

## Database migrations

`packages/db/supabase/` contains the legacy bootstrap scripts:
`001-initial.sql`, `002-google-sync.sql`, `003-place-source-keys.sql`, and
`004-mcp-api-keys.sql`. Apply all four in order to a new database, then run:

```sh
pnpm --filter @placeshub/db run db:migrate
```

The first Drizzle migration, `legacy_baseline`, validates the installed schema
and records it in `drizzle.__drizzle_migrations` without recreating tables or
changing place data. For later changes, run `db:generate`, review its SQL, then
run `db:migrate`. Generating creates migration
files; migrating applies existing files and records them in the database. An
empty Drizzle folder makes migration a no-op, even if SQL files exist elsewhere.

The legacy SQL also owns PostGIS geometry, row-level security policies, and
some original constraints not described by the application TypeScript schema.
Review any generated changes to existing tables against the live schema; do
not run `db:push` on a hosted database. Check migration tracking with:

```sql
SELECT id, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;
```

## Google Maps list sync (Chrome and Firefox extensions)

The extension also builds for Firefox. See [extension publishing](docs/extension-publishing.md)
for separate Chrome/Firefox packages, installation and store requirements.

1. For a new database, apply all four legacy SQL scripts as described in **Database migrations** above.
2. Build both packages with `pnpm --filter @placeshub/extension build`. In Chrome, open `chrome://extensions`, enable Developer mode and **Load unpacked** from `apps/extension/dist/chrome`. In Firefox, open `about:debugging#/runtime/this-firefox` and load `apps/extension/dist/firefox/manifest.json` temporarily.
3. Sign in to PlacesHub and open **Settings → Google Sync**. Create an extension key. In the extension popup, open **Settings** and enter the PlacesHub address and the key on its Options page. Keys can be revoked in PlacesHub settings.
4. In the same browser profile, sign in to Google Maps, open **Saved**, each list you want to sync (including **Favorite places**), and one place's full details card so Maps generates list-specific and place-detail requests. Click **Sync now** in the extension. After discovery, select the lists to sync in its popup. After updating the unpacked extension, reload it in `chrome://extensions` before repeating these steps.

The extension checks selected lists every hour and shortly after Chrome starts. It uses the browser's signed-in Maps session to read Google's internal list and place-detail responses; Google cookies are never sent to PlacesHub. The extension key is stored locally and only grants snapshot imports. Places with a Maps CID are enriched with real Place IDs and available contact, rating and opening-hours data; places without a CID or whose detail request fails retain their basic list data. Imported memberships follow Google, while directly saved places and cached place rows remain after removal. List notes are stored on the collection membership, not on a user's direct-save note.

In manually created collections, use **Move** on one place or select several and use **Move selected** to transfer them to another manual collection. A moved place keeps its collection note unless it is already in the destination, in which case the existing destination note remains. Synced Google collections cannot be changed this way.

Google's endpoints are undocumented. An incomplete or unverifiable empty response (including a paginated list not yet supported by the captured request) is rejected rather than removing PlacesHub memberships. A response-format error shows only a structural summary (array/ID/count shape and whether a list-specific request was captured), never place data. If **Favorite places** still fails after opening it in Maps, copy that summary from the extension popup to diagnose its response. Lists without an ID in Google's discovery response cannot currently sync; in the captured sample, this includes default Saved places, while Starred places are not present. The extension displays failures and last-run results in its popup; live account/browser verification is required before relying on scheduled updates.

## AI agent access (MCP)

1. Apply `packages/db/supabase/004-mcp-api-keys.sql` after the earlier numbered migrations.
2. Sign in and open **Settings → AI agents**. Create a named key, copy it once, and give it to your MCP client as `Authorization: Bearer phm_…`.
3. Connect with Streamable HTTP at `https://<your-PlacesHub-origin>/api/mcp` (locally `http://localhost:3013/api/mcp`). Every request includes the same key; no session ID is needed.

Example remote MCP client configuration (replace URL and key; keep the key outside version control):

```json
{
  "mcpServers": {
    "placeshub": {
      "url": "https://<your-PlacesHub-origin>/api/mcp",
      "headers": { "Authorization": "Bearer phm_<your-key>" }
    }
  }
}
```

Tools cover Google place search; listing saved places and collections; singular and bulk save, update notes/tags, and delete saved places; creating, editing, and deleting manual collections; and singular/bulk collection membership additions and removals. Bulk calls accept 1–100 items and roll back the **entire** batch when any item is invalid, missing, unowned, or targets a Google-synced collection. `savedPlaceId` identifies a user's saved row; `placeId` identifies the shared place used in collection memberships. Deleting a saved row or a collection does not delete shared place data. Extension `phs_` keys cannot use MCP; revoke MCP keys in **Settings → AI agents**.

## Deploy

Deploy the API to Cloudflare Workers and the web app to Cloudflare Pages. The
Pages Function forwards `/api/*` to the Worker over a service binding, so the
browser and the Chrome/Firefox extensions use the same origin. See
[production deployment](docs/deployment.md) for setup, required variables, and
smoke checks.
