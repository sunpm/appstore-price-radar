CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_uniq
  ON users (email);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_token_hash_uniq
  ON user_sessions (token_hash);

CREATE INDEX IF NOT EXISTS user_sessions_user_idx
  ON user_sessions (user_id);

CREATE INDEX IF NOT EXISTS user_sessions_expires_idx
  ON user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_hash_uniq
  ON password_reset_tokens (token_hash);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON password_reset_tokens (user_id);

CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_idx
  ON password_reset_tokens (expires_at);

CREATE TABLE IF NOT EXISTS login_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_codes_user_code_idx
  ON login_codes (user_id, code_hash);

CREATE INDEX IF NOT EXISTS login_codes_expires_idx
  ON login_codes (expires_at);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id varchar(32) NOT NULL,
  country char(2) NOT NULL DEFAULT 'US',
  target_price numeric(10, 2),
  last_notified_price numeric(10, 2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_app_country_uniq
  ON subscriptions (user_id, app_id, country);

CREATE INDEX IF NOT EXISTS subscriptions_email_idx
  ON subscriptions (email);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx
  ON subscriptions (user_id);

CREATE INDEX IF NOT EXISTS subscriptions_app_country_idx
  ON subscriptions (app_id, country);

CREATE TABLE IF NOT EXISTS app_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id varchar(32) NOT NULL,
  country char(2) NOT NULL,
  app_name text NOT NULL,
  store_url text,
  icon_url text,
  seller_name text,
  primary_genre_name text,
  description text,
  average_user_rating numeric(4, 2),
  user_rating_count integer,
  bundle_id text,
  version text,
  minimum_os_version text,
  release_notes text,
  currency char(3) NOT NULL,
  last_price numeric(10, 2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_snapshots_app_country_uniq
  ON app_snapshots (app_id, country);

CREATE TABLE IF NOT EXISTS app_price_history (
  id serial PRIMARY KEY,
  app_id varchar(32) NOT NULL,
  country char(2) NOT NULL,
  price numeric(10, 2) NOT NULL,
  currency char(3) NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_price_history_app_time_idx
  ON app_price_history (app_id, country, fetched_at DESC);

CREATE TABLE IF NOT EXISTS app_price_change_events (
  id serial PRIMARY KEY,
  app_id varchar(32) NOT NULL,
  country char(2) NOT NULL,
  currency char(3) NOT NULL,
  old_amount numeric(10, 2) NOT NULL,
  new_amount numeric(10, 2) NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  source varchar(32) NOT NULL DEFAULT 'scheduled',
  request_id varchar(96) NOT NULL
);

CREATE INDEX IF NOT EXISTS app_price_change_events_app_changed_idx
  ON app_price_change_events (app_id, country, changed_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS app_price_change_events_app_request_uniq
  ON app_price_change_events (app_id, country, request_id);

CREATE TABLE IF NOT EXISTS app_drop_events (
  id serial PRIMARY KEY,
  app_id varchar(32) NOT NULL,
  country char(2) NOT NULL,
  app_name text NOT NULL,
  store_url text,
  icon_url text,
  currency char(3) NOT NULL,
  old_price numeric(10, 2) NOT NULL,
  new_price numeric(10, 2) NOT NULL,
  drop_percent numeric(7, 2),
  detected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_drop_events_app_country_detected_idx
  ON app_drop_events (app_id, country, detected_at DESC);

CREATE INDEX IF NOT EXISTS app_drop_events_detected_idx
  ON app_drop_events (detected_at DESC);

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
