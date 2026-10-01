# PlacesHub

PlacesHub brings saved Google Maps places into one map. Sync saved lists with the
Chrome or Firefox extension, import Google My Maps KML/KMZ files, organise places
into collections with notes, and share a public map or export KML.

**Website:** [placeshub.org](https://placeshub.org) · **Extension setup:**
[Chrome and Firefox instructions](#google-maps-list-sync-chrome-and-firefox-extensions)

### App preview

| Browse saved places on a map | Import a Google My Maps KML/KMZ collection |
| --- | --- |
| ![PlacesHub dashboard showing saved places beside a map](apps/web/public/screenshots/dashboard.webp) | ![PlacesHub Google My Maps import dialog](apps/web/public/screenshots/my-maps-import.webp) |

### Extension preview

| Select lists and see sync results (example data) | Connect with a revocable extension key |
| --- | --- |
| ![PlacesHub extension popup showing selected lists and example sync results](apps/web/public/screenshots/extension-popup.png) | ![PlacesHub extension settings with site address and extension key fields](apps/web/public/screenshots/extension-settings.png) |

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

## Local development

Use Node 24 and pnpm 12.6.0. Copy `.env.example` to `.env.local` and set the
Supabase URL and anon key, database URL, server-side Google Places API key, and
public Mapbox token. The API loads `.env.local`; the web app reads its `VITE_`
variables. Never put the database URL or Google Places API key in a `VITE_`
variable.

For a new database, apply the legacy SQL scripts in the order described in
[Database migrations](#database-migrations) before starting the app.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

This starts the web app at `http://localhost:3013` and the API at
`http://localhost:4000`. Sign in or create an account to use the dashboard;
public share links and the marketing page do not require sign-in.

### Checks

```sh
pnpm check         # Biome check
pnpm check-types   # TypeScript type-check
pnpm build         # Production build
pnpm --filter @placeshub/web test
pnpm --filter @placeshub/extension test
```

## Database migrations

`packages/db/supabase/` contains the legacy bootstrap scripts:
`001-initial.sql`, `002-google-sync.sql`, `003-place-source-keys.sql`, and
`004-mcp-api-keys.sql`. Apply all four **in order** to a new database using
`psql` or the Supabase SQL editor. The Drizzle command does not apply these
legacy scripts. With `DATABASE_URL` exported for the intended database, run:

```sh
for migration in packages/db/supabase/00[1-4]-*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration" || exit 1
done
```

There are currently no checked-in Drizzle migrations in `packages/db/drizzle/`.
`db:migrate` does **not** apply the legacy SQL and cannot bootstrap the database.
For future schema changes, generate and review a Drizzle migration, commit it,
then run `pnpm --filter @placeshub/db run db:migrate` against the intended
database. Do not use `db:push` on a hosted database.

If an **existing** local database returns HTTP 500 for `/api/mcp/keys`, check
whether `mcp_api_keys` exists. If it is missing, apply only
`packages/db/supabase/004-mcp-api-keys.sql` to that database; do not rerun the
whole bootstrap against existing tables.

The legacy SQL also owns PostGIS geometry, row-level security policies, and
some original constraints not described by the application TypeScript schema.
Review generated changes to existing tables against the live schema.

## Google Maps list sync (Chrome and Firefox extensions)

The same extension builds for Chrome and Firefox. Store downloads are not
published yet; install a local build using the steps below. See
[extension publishing](docs/extension-publishing.md) for release requirements.

1. Apply the database migrations above if setting up a new database. Build both
   packages with `pnpm --filter @placeshub/extension build`.
2. In Chrome, open `chrome://extensions`, enable Developer mode, then select
   **Load unpacked** from `apps/extension/dist/chrome`. In Firefox, open
   `about:debugging#/runtime/this-firefox` and load
   `apps/extension/dist/firefox/manifest.json` temporarily.
3. Sign in to PlacesHub, open **Settings → Google Sync**, and create an extension
   key. Open **Settings** in the extension popup and enter the PlacesHub address
   and key. You can revoke keys in PlacesHub settings.
4. In the same browser profile, sign in to Google Maps. Open **Saved**, each list
   you want to sync, and a place's full details card so Maps makes the needed
   requests. Click **Sync now** in the extension and select lists in its popup.
   After updating the unpacked extension, reload it in the browser's extension
   management page before syncing again.

The extension checks selected lists every hour and shortly after the browser
starts. It uses your signed-in Maps session; Google cookies are never sent to
PlacesHub. The extension key stays in local browser storage and grants snapshot
imports only. When available, place details include contact, rating, and hours;
places that cannot be enriched keep their basic list data. Imported memberships
follow Google, while directly saved places remain after removal from a list.
List notes belong to the collection membership, separate from personal notes.

## Import a Google My Maps collection

1. In [Google My Maps](https://www.google.com/maps/d/), open your map, choose
   **Export to KML/KMZ** from the menu beside its title, and export the
   **entire map**.
2. In PlacesHub, open **Collections → Import KML/KMZ** and select the file.
   Review the preview, then choose **Import collection**.

Point pins from all layers become one editable collection. Lines, polygons,
images, and duplicate or unsupported pins are skipped. Imports do not stay in
sync with My Maps. Files must be at most 10 MB, contain at most 3,000 placemarks,
and have KML content at most 5 MB.

In manually created collections, use **Move** on one place or **Move selected**
on several places to transfer them to another manual collection. Existing
destination notes take precedence over moved notes. Google-synced collections
cannot be changed this way.

Google's list endpoints are undocumented. The extension rejects incomplete or
unverifiable empty responses rather than removing memberships. A response-format
error shows a structural summary, not place data. If a list such as
**Favorite places** fails after opening it in Maps, use that summary to
diagnose the response. Lists without an ID in Google's discovery response
cannot sync.

## AI agent access (MCP)

1. Apply the database migrations above, including `004-mcp-api-keys.sql`.
2. Sign in and open **Settings → AI agents**. Create a key and copy it once.
   Send it as `Authorization: Bearer phm_…`.
3. Connect via Streamable HTTP at `https://placeshub.org/api/mcp` (locally
   `http://localhost:3013/api/mcp`). Every request includes the key; no session
   ID is needed.

Example remote MCP client configuration (replace the key and keep it outside
version control):

```json
{
  "mcpServers": {
    "placeshub": {
      "url": "https://placeshub.org/api/mcp",
      "headers": { "Authorization": "Bearer phm_<your-key>" }
    }
  }
}
```

Tools cover place search, saved places, collections, notes, tags, and collection
membership. Bulk calls accept 1–100 items and roll back the entire batch if any
item is invalid or unowned. `savedPlaceId` identifies a user's saved row;
`placeId` identifies the shared place used in collection memberships. Deleting
a saved row or collection does not delete shared place data. Extension `phs_`
keys cannot use MCP. Revoke MCP keys in **Settings → AI agents**.

## Deploy

Deploy the API to Cloudflare Workers and the web app to Cloudflare Pages. The
Pages Function forwards `/api/*` to the Worker over a service binding, so the
browser and the Chrome/Firefox extensions use the same origin. See
[production deployment](docs/deployment.md) for setup, required variables, and
smoke checks.
