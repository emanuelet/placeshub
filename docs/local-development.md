# Local development with Supabase

Use Node 24, pnpm 12.6.0 and a running Docker-compatible container runtime.
The repo includes the Supabase CLI dependency and `supabase/config.toml`, so
there is no need to run `supabase init` again.

1. Install dependencies and start the local stack from the repo root:

   ```sh
   pnpm install --frozen-lockfile
   pnpm exec supabase start
   pnpm exec supabase status
   ```

2. Open **Supabase Studio** at `http://127.0.0.1:54323`. Use its SQL editor to
   apply the four [database bootstrap scripts](database-migrations.md) in order,
   or use `psql`. Studio's Table Editor and Authentication pages let you inspect
   local data and users. Local services are separate from hosted Supabase.

3. Copy `.env.example` to `.env.local` and use the local URLs and public key
   printed by `supabase status`:

   ```dotenv
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
   SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_KEY=<local publishable or anon key>
   SUPABASE_ANON_KEY=<same local public key>
   VITE_SUPABASE_KEY=<same local public key>
   GOOGLE_PLACES_API_KEY=<server-side Places API (New) key>
   VITE_MAPBOX_TOKEN=<public Mapbox token>
   ```

   Do not use a secret/service-role key as the public key. The API loads
   `.env.local`; Vite embeds only its `VITE_` variables in browser JavaScript.
   Keep the database URL and Google Places API key out of `VITE_` variables.

4. Run `pnpm dev`. The web app is at `http://localhost:3013`; its `/api` proxy
   reaches the Worker at port 4000. Sign up/sign in to use private pages.
   If email confirmation is required, inspect local mail at
   `http://127.0.0.1:54324`. Stop the stack with `pnpm exec supabase stop` when
   finished; this preserves local database data.

Official guide: [Supabase CLI and local Studio setup](https://supabase.com/docs/guides/local-development/cli/getting-started?queryGroups=access-method&access-method=studio).
