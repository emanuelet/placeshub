# Database migrations

Run commands from the repository root. `packages/db/supabase/` contains the
bootstrap scripts: `001-initial.sql`, `002-google-sync.sql`,
`003-place-source-keys.sql`, `004-mcp-api-keys.sql`, `005-place-enrichment.sql`, and
`006-api-request-usage.sql`, and `007-user-timezone.sql`. Apply all seven **in order**
to a new database using `psql` or Supabase Studio's SQL editor.

With `DATABASE_URL` exported for the intended database:

```sh
for migration in packages/db/supabase/00[1-7]-*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration" || exit 1
done
```

For local Supabase, use the database URL printed by `pnpm exec supabase status`.
See [local development](local-development.md) for starting the stack and Studio.
The bootstrap files live outside `supabase/migrations`, so `supabase start`
does not apply them automatically.

There are currently no checked-in Drizzle migrations in `packages/db/drizzle/`.
`db:migrate` does **not** apply the bootstrap SQL. For future schema changes,
generate and review a Drizzle migration, commit it, then run
`pnpm --filter @placeshub/db run db:migrate` against the intended database.
Do not use `db:push` on a hosted database.

If an existing database returns HTTP 500 for `/api/mcp/keys`, check whether
`mcp_api_keys` exists. If missing, apply only `004-mcp-api-keys.sql`; do not rerun
the whole bootstrap against existing tables.

The SQL also owns PostGIS geometry, row-level security policies, and constraints
not described by the TypeScript schema. Review generated changes against the
live schema.
