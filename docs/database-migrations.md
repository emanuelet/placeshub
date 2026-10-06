# Database migrations

Run commands from the repository root. Drizzle is the source of truth for applying
schema changes. The first migration is an idempotent legacy baseline: it preserves
existing data while reconciling the former Supabase bootstrap schema, including RLS,
PostGIS, the auth trigger, enrichment jobs, request budgets, and user timezones.

With `MIGRATION_DATABASE_URL` (or `DATABASE_URL`) for the intended database,
generate and review a migration for each schema change, then apply it:

```sh
pnpm --filter @placeshub/db run db:generate -- --name <change-name>
pnpm --filter @placeshub/db run db:check
pnpm --filter @placeshub/db run db:migrate
```

Use a direct/session database connection for production DDL, not the Worker
transaction-pooler URL. Take a backup before production migrations. For local
Supabase, use the database URL printed by `pnpm exec supabase status`. See
[local development](local-development.md) for starting the stack and Studio.

Use `DRIZZLE_OUT=/tmp/placeshub-schema pnpm --filter @placeshub/db run db:pull`
only to inspect a database into a temporary directory; it is a verification aid,
not a replacement for reviewed migrations. Do not use `drizzle-kit push` for
hosted databases.

`packages/db/supabase/001` through `007` are retained as historical source material.
Do not run them manually or edit them. Their final state is represented by the
idempotent Drizzle baseline and its schema snapshot.

PostGIS geometry, row-level security policies, the auth trigger, and the enrichment
status constraint are custom SQL-owned objects. Add changes to them as reviewed
custom Drizzle migrations, then verify the live schema with `db:pull`.
