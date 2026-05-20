-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table mirrors Supabase auth.users
CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text,
  display_name text,
  avatar_url  text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Places cache (deduplicated by google_place_id)
CREATE TABLE IF NOT EXISTS places (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id   text UNIQUE NOT NULL,
  name              text NOT NULL,
  lat               double precision,
  lng               double precision,
  address           text,
  google_maps_uri   text,
  types             text[],
  phone             text,
  website           text,
  rating            real,
  metadata          jsonb,
  cached_at         timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now()
);

-- Add PostGIS geometry column
SELECT AddGeometryColumn('public', 'places', 'geom', 4326, 'POINT', 2);
CREATE INDEX IF NOT EXISTS places_geom_idx ON places USING GIST (geom);

ALTER TABLE places ENABLE ROW LEVEL SECURITY;

-- User's saved places
CREATE TABLE IF NOT EXISTS saved_places (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id    uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  notes       text,
  tags        text[] DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, place_id)
);

CREATE INDEX IF NOT EXISTS saved_places_user_id_idx ON saved_places(user_id);
ALTER TABLE saved_places ENABLE ROW LEVEL SECURITY;

-- Collections
CREATE TABLE IF NOT EXISTS collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  slug        text UNIQUE NOT NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collections_user_id_idx ON collections(user_id);
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Collection <-> Place junction
CREATE TABLE IF NOT EXISTS collection_places (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  place_id        uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collection_places_collection_id_idx ON collection_places(collection_id);
ALTER TABLE collection_places ENABLE ROW LEVEL SECURITY;

-- Shares (snapshot-based)
CREATE TABLE IF NOT EXISTS shares (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id     uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  slug              text UNIQUE NOT NULL,
  include_notes     boolean NOT NULL DEFAULT false,
  places_snapshot   jsonb NOT NULL,
  created_at        timestamptz DEFAULT now(),
  expires_at        timestamptz
);

CREATE INDEX IF NOT EXISTS shares_slug_idx ON shares(slug);
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read/write their own data
CREATE POLICY "Users can read own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own data" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);

-- Places are readable by authenticated users (cache), insertable by all
CREATE POLICY "Places readable by authenticated" ON places FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Places insertable by authenticated" ON places FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Saved places are user-scoped
CREATE POLICY "Saved places user access" ON saved_places FOR ALL USING (auth.uid() = user_id);

-- Collections are user-scoped
CREATE POLICY "Collections user access" ON collections FOR ALL USING (auth.uid() = user_id);

-- Collection places inherit from collection
CREATE POLICY "Collection places user access" ON collection_places FOR ALL USING (
  EXISTS (SELECT 1 FROM collections WHERE id = collection_places.collection_id AND user_id = auth.uid())
);

-- Shares: collection owner can manage, anyone can read by slug
CREATE POLICY "Shares owner manage" ON shares FOR ALL USING (
  EXISTS (SELECT 1 FROM collections WHERE id = shares.collection_id AND user_id = auth.uid())
);
CREATE POLICY "Shares public read" ON shares FOR SELECT USING (true);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
