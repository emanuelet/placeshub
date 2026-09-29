-- Keep a stable mapping from a Maps-list identifier to the canonical place cache row.
CREATE TABLE place_source_keys (
  source_key text PRIMARY KEY,
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE
);
CREATE INDEX place_source_keys_place_id_idx ON place_source_keys(place_id);

INSERT INTO place_source_keys (source_key, place_id)
SELECT google_place_id, id FROM places WHERE google_place_id LIKE 'maps:%'
ON CONFLICT (source_key) DO NOTHING;

ALTER TABLE place_source_keys ENABLE ROW LEVEL SECURITY;
-- The authenticated Worker manages this mapping; clients cannot read or write it directly.
