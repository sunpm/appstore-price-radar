CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope varchar(64) NOT NULL,
  subject_key varchar(320) NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_rate_limits_scope_subject_uniq
  ON auth_rate_limits (scope, subject_key);

CREATE INDEX IF NOT EXISTS auth_rate_limits_blocked_until_idx
  ON auth_rate_limits (blocked_until);
