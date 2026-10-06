CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  timezone text NOT NULL DEFAULT 'UTC'
);

CREATE TABLE IF NOT EXISTS places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id text UNIQUE NOT NULL,
  name text NOT NULL,
  lat double precision,
  lng double precision,
  address text,
  google_maps_uri text,
  types text[],
  phone text,
  website text,
  rating real,
  metadata jsonb,
  cached_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'places' AND column_name = 'geom'
  ) THEN
    PERFORM AddGeometryColumn('public', 'places', 'geom', 4326, 'POINT', 2);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS saved_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  notes text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  directly_saved boolean NOT NULL DEFAULT true,
  UNIQUE(user_id, place_id)
);

CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collection_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  notes text
);

CREATE TABLE IF NOT EXISTS shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  include_notes boolean NOT NULL DEFAULT false,
  places_snapshot jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE TABLE IF NOT EXISTS sync_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS synced_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_list_id text NOT NULL,
  collection_id uuid NOT NULL UNIQUE REFERENCES collections(id) ON DELETE CASCADE,
  last_synced_at timestamptz,
  UNIQUE(user_id, source_list_id)
);

CREATE TABLE IF NOT EXISTS place_source_keys (
  source_key text PRIMARY KEY,
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mcp_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS place_enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL UNIQUE REFERENCES places(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolving', 'details', 'ambiguous', 'unmatched', 'failed', 'skipped', 'completed')),
  resolved_google_place_id text,
  candidates jsonb,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_request_usage (
  service text NOT NULL,
  day date NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_request_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service, day)
);

DO $$
BEGIN
  IF to_regclass('public.google_request_usage') IS NOT NULL THEN
    INSERT INTO api_request_usage (service, day, attempts, next_request_at, updated_at)
    SELECT 'google_places', day, attempts, next_request_at, updated_at
    FROM google_request_usage
    ON CONFLICT (service, day) DO UPDATE SET
      attempts = GREATEST(api_request_usage.attempts, EXCLUDED.attempts),
      next_request_at = GREATEST(api_request_usage.next_request_at, EXCLUDED.next_request_at),
      updated_at = GREATEST(api_request_usage.updated_at, EXCLUDED.updated_at);
    DROP TABLE google_request_usage;
  END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone text;
UPDATE users SET timezone = 'UTC' WHERE timezone IS NULL;
ALTER TABLE users ALTER COLUMN timezone SET DEFAULT 'UTC';
ALTER TABLE users ALTER COLUMN timezone SET NOT NULL;
ALTER TABLE saved_places ADD COLUMN IF NOT EXISTS directly_saved boolean NOT NULL DEFAULT true;
ALTER TABLE collection_places ADD COLUMN IF NOT EXISTS notes text;

DELETE FROM collection_places a USING collection_places b
WHERE a.collection_id = b.collection_id AND a.place_id = b.place_id AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS collection_place_unique ON collection_places(collection_id, place_id);
CREATE INDEX IF NOT EXISTS places_geom_idx ON places USING GIST (geom);
CREATE INDEX IF NOT EXISTS saved_places_user_id_idx ON saved_places(user_id);
CREATE INDEX IF NOT EXISTS collections_user_id_idx ON collections(user_id);
CREATE INDEX IF NOT EXISTS collection_places_collection_id_idx ON collection_places(collection_id);
CREATE INDEX IF NOT EXISTS shares_slug_idx ON shares(slug);
CREATE INDEX IF NOT EXISTS sync_connections_user_idx ON sync_connections(user_id);
CREATE INDEX IF NOT EXISTS place_source_keys_place_id_idx ON place_source_keys(place_id);
CREATE INDEX IF NOT EXISTS mcp_api_keys_user_idx ON mcp_api_keys(user_id);
CREATE INDEX IF NOT EXISTS place_enrichment_jobs_pending_idx ON place_enrichment_jobs(status, next_attempt_at);

INSERT INTO place_source_keys (source_key, place_id)
SELECT google_place_id, id FROM places WHERE google_place_id LIKE 'maps:%'
ON CONFLICT (source_key) DO NOTHING;

INSERT INTO place_enrichment_jobs (place_id)
SELECT id FROM places WHERE google_place_id LIKE 'mymaps:%' OR google_place_id LIKE 'maps:%'
ON CONFLICT (place_id) DO NOTHING;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE synced_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_source_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_enrichment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_usage ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Users can read own data') THEN
    CREATE POLICY "Users can read own data" ON users FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Users can insert own data') THEN
    CREATE POLICY "Users can insert own data" ON users FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Users can update own data') THEN
    CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'places' AND policyname = 'Places readable by authenticated') THEN
    CREATE POLICY "Places readable by authenticated" ON places FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'places' AND policyname = 'Places insertable by authenticated') THEN
    CREATE POLICY "Places insertable by authenticated" ON places FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'saved_places' AND policyname = 'Saved places user access') THEN
    CREATE POLICY "Saved places user access" ON saved_places FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'collections' AND policyname = 'Collections user access') THEN
    CREATE POLICY "Collections user access" ON collections FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'collection_places' AND policyname = 'Collection places user access') THEN
    CREATE POLICY "Collection places user access" ON collection_places FOR ALL USING (EXISTS (SELECT 1 FROM collections WHERE id = collection_places.collection_id AND user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shares' AND policyname = 'Shares owner manage') THEN
    CREATE POLICY "Shares owner manage" ON shares FOR ALL USING (EXISTS (SELECT 1 FROM collections WHERE id = shares.collection_id AND user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shares' AND policyname = 'Shares public read') THEN
    CREATE POLICY "Shares public read" ON shares FOR SELECT USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email), NEW.raw_user_meta_data ->> 'avatar_url');
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;
