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

This starts the web app (port 3001) and API server (port 4000) concurrently.

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

Copy `.env.example` to `.env` in each app and configure:

- Supabase project URL and anon key
- Google Places API key
- Mapbox access token

## Deploy

- **Web**: Cloudflare Pages
- **API**: Cloudflare Workers
