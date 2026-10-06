DO $$
BEGIN
  IF to_regclass('public.google_request_usage') IS NOT NULL THEN
    ALTER TABLE google_request_usage RENAME TO api_request_usage;
    ALTER TABLE api_request_usage DROP CONSTRAINT google_request_usage_pkey;
    ALTER TABLE api_request_usage ADD COLUMN service text NOT NULL DEFAULT 'google_places';
    ALTER TABLE api_request_usage ADD PRIMARY KEY (service, day);
  END IF;
END $$;
