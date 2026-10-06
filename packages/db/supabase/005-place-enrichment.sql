CREATE TABLE place_enrichment_jobs (
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
CREATE INDEX place_enrichment_jobs_pending_idx ON place_enrichment_jobs (status, next_attempt_at);

CREATE TABLE google_request_usage (
  day date PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  next_request_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO place_enrichment_jobs (place_id)
SELECT id FROM places WHERE google_place_id LIKE 'mymaps:%' OR google_place_id LIKE 'maps:%'
ON CONFLICT (place_id) DO NOTHING;

ALTER TABLE place_enrichment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_request_usage ENABLE ROW LEVEL SECURITY;
