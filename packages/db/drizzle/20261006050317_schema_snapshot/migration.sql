-- The preceding idempotent baseline owns the full legacy schema.
-- This no-op migration records the Drizzle schema snapshot so future changes are incremental.
SELECT 1;
