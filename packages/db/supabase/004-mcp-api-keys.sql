CREATE TABLE mcp_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX mcp_api_keys_user_idx ON mcp_api_keys(user_id);
ALTER TABLE mcp_api_keys ENABLE ROW LEVEL SECURITY;
-- Only the authenticated Worker can issue, look up, and revoke MCP keys.
