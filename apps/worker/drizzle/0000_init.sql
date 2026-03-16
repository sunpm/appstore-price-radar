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
