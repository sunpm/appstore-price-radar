ALTER TABLE app_snapshots
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS primary_genre_name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS average_user_rating numeric(4, 2),
  ADD COLUMN IF NOT EXISTS user_rating_count integer,
  ADD COLUMN IF NOT EXISTS bundle_id text,
  ADD COLUMN IF NOT EXISTS version text,
  ADD COLUMN IF NOT EXISTS minimum_os_version text,
  ADD COLUMN IF NOT EXISTS release_notes text;
