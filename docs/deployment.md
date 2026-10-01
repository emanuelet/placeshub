# Production deployment (Cloudflare + Supabase)

PlacesHub has two Cloudflare services: the `placeshub-api` Worker and the
`placeshub-web` Pages project. The web app requests `/api/*` on its own origin;
`apps/web/functions/api/[[path]].ts` forwards those requests to the Worker
through the production-only `API` service binding in `apps/web/wrangler.toml`.
The production origin for the browser and extension is **https://placeshub.org**,
not the Worker URL. `placeshub-web.pages.dev` remains a Pages alias.

## 1. Prepare hosted services

1. Create a hosted Supabase project. Apply
   `packages/db/supabase/001-initial.sql`, `002-google-sync.sql`, and
   `003-place-source-keys.sql`, and `004-mcp-api-keys.sql` in order to the
   **hosted** database. The local `supabase/config.toml` configures local
   development, not hosted auth. Then run
   `pnpm --filter @placeshub/db run db:migrate` using the intended hosted
   database connection.
2. Enable Places API (New) in Google Cloud and obtain a server-side API key.
   Restrict the key to that API. Obtain a public Mapbox token.
3. Set Supabase Auth's Site URL to `https://placeshub.org` and allow that origin
   in Auth redirect URLs. OAuth sign-in returns to the current browser origin;
   without this allow-list entry, it cannot return to the custom domain.
   Configure the Google provider and its Supabase callback if using Google
   sign-in. Retain `https://placeshub-web.pages.dev` in the redirect allow-list
   only if that alias should also support sign-in. Add preview origins only when
   preview auth is intentionally enabled.

## 2. Deploy the API Worker

Use Node 24 and pnpm 12.6.0. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @placeshub/api check-types
pnpm --filter @placeshub/api run deploy
```

Set these four Worker **secrets** via Cloudflare's dashboard or
`pnpm --filter @placeshub/api exec wrangler secret put NAME` (enter each value
at the prompt; do not place values in `wrangler.toml`):

| Worker secret | Value |
| --- | --- |
| `DATABASE_URL` | Hosted Supabase Postgres **transaction-pooler** URL with `sslmode=require` |
| `SUPABASE_URL` | Hosted Supabase project URL |
| `SUPABASE_KEY` | Hosted Supabase **anon** key (not service-role key) |
| `GOOGLE_PLACES_API_KEY` | Server-side Places API (New) key |

The API opens at most one database connection per request and disables prepared
statements for transaction-pooler compatibility. `SUPABASE_URL` and
`SUPABASE_KEY` let the API validate user access tokens. Run a Worker health
check before connecting Pages.

## 3. Set up the Pages project

Create a Cloudflare Pages Git project in the **same Cloudflare account** as the
Worker, with:

| Setting | Value |
| --- | --- |
| Project name | `placeshub-web` |
| Root directory | `apps/web` |
| Build command | `pnpm --filter @placeshub/web build` |
| Output directory | `dist` |
| Production branch | `main` |
| Build environment | `NODE_VERSION=24`, `PNPM_VERSION=12.6.0` |

In the Pages project, attach `placeshub.org` as a custom domain. Its Cloudflare
DNS apex (`@`) should have a **proxied CNAME** to `placeshub-web.pages.dev`;
Cloudflare flattens that CNAME into public A/AAAA answers. The domain is managed
in Pages and DNS rather than in `apps/web/wrangler.toml`.

Set these **build-time** Pages environment variables for the production build:

| Pages variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Hosted Supabase project URL |
| `VITE_SUPABASE_KEY` | Hosted Supabase anon key |
| `VITE_MAPBOX_TOKEN` | Public Mapbox access token |

The `VITE_` values are embedded in browser JavaScript. Keep `DATABASE_URL`,
`GOOGLE_PLACES_API_KEY`, and any service-role key **out** of Pages build
variables. `apps/web/.node-version` selects Node 24; set `PNPM_VERSION`
explicitly because Pages' default pnpm is older than this repository's lockfile.

The Pages Wrangler config binds `API` to `placeshub-api` **only in production**.
Deploy the Worker first, then deploy Pages. If an existing Pages project is
already configured in the dashboard, reconcile its settings before using the
Wrangler file: deploying it makes the file the source of truth. Preview Pages
requests to `/api/*` return 503 until a separate preview Worker and service
binding are configured; they do not reach production data.

## 4. Verify

1. `https://placeshub.org/api/health` returns `{"status":"ok"}`. A 503 with
   `API service binding is not configured` means the Pages production binding
   did not apply. Plain `/api` should return an API response, not the SPA HTML.
2. Direct navigation and refresh of `/dashboard`, `/collections`, and
   `/settings` load the SPA. `apps/web/public/_routes.json` limits Function
   invocations to `/api` routes; static assets remain static.
3. Sign in using the hosted Supabase project and load collections. If the API
   cannot connect to Postgres, check the pooler URL, TLS, and hosted migrations.
4. In the extension's Settings, enter the **Pages origin** and a key generated
   in PlacesHub Settings → Google Sync. Then sync one Google list and check its
   result in the popup.
5. Create an AI agent key in Settings → AI agents. A Streamable HTTP client
   using `https://placeshub.org/api/mcp` and `Authorization: Bearer <key>` can
   list tools without a session ID. Revoking the key blocks its next request.

For local development, `pnpm dev` still uses Vite's `/api` proxy to the local
Worker. To test the production Pages Function locally, run `pnpm dev` first and
then run `pnpm --filter @placeshub/web exec wrangler pages dev dist --service
API=placeshub-api --port 8799` from another terminal after building the web
app. `http://localhost:8799/api/health` should return `{"status":"ok"}`.
Do not deploy a locally built `dist` containing local `.env.local` values; let
Pages build with its production variables.
