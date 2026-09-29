-- A direct save survives the removal of its last imported list membership.
ALTER TABLE saved_places ADD COLUMN directly_saved boolean NOT NULL DEFAULT true;
ALTER TABLE collection_places ADD COLUMN notes text;
DELETE FROM collection_places a USING collection_places b
WHERE a.collection_id = b.collection_id AND a.place_id = b.place_id AND a.id > b.id;
CREATE UNIQUE INDEX collection_place_unique ON collection_places(collection_id, place_id);

CREATE TABLE sync_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX sync_connections_user_idx ON sync_connections(user_id);

CREATE TABLE synced_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_list_id text NOT NULL,
  collection_id uuid NOT NULL UNIQUE REFERENCES collections(id) ON DELETE CASCADE,
  last_synced_at timestamptz,
  UNIQUE (user_id, source_list_id)
);

ALTER TABLE sync_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE synced_lists ENABLE ROW LEVEL SECURITY;
-- The Worker authenticates every operation; these tables have no client-side access.
