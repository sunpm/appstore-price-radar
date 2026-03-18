CREATE TABLE IF NOT EXISTS job_leases (
  lock_key varchar(64) PRIMARY KEY,
  run_id uuid NOT NULL,
  locked_until timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_leases_locked_until_idx
  ON job_leases (locked_until);

CREATE TABLE IF NOT EXISTS price_check_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger varchar(32) NOT NULL,
  status varchar(32) NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  scanned integer NOT NULL DEFAULT 0,
  succeeded integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  drops integer NOT NULL DEFAULT 0,
  emails_sent integer NOT NULL DEFAULT 0,
  error_summary text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS price_check_runs_started_at_idx
  ON price_check_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS price_check_runs_status_started_at_idx
  ON price_check_runs (status, started_at DESC);

CREATE INDEX IF NOT EXISTS price_check_runs_finished_at_idx
  ON price_check_runs (finished_at DESC);
