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

INSERT INTO app_price_change_events (
  app_id,
  country,
  currency,
  old_amount,
  new_amount,
  changed_at,
  source,
  request_id
)
SELECT
  staged.app_id,
  staged.country,
  staged.currency,
  staged.previous_price AS old_amount,
  staged.price AS new_amount,
  staged.fetched_at AS changed_at,
  'migration' AS source,
  concat('migration-', staged.app_id, '-', staged.country, '-', staged.id) AS request_id
FROM (
  SELECT
    id,
    app_id,
    country,
    currency,
    price,
    fetched_at,
    lag(price) OVER (
      PARTITION BY app_id, country
      ORDER BY fetched_at, id
    ) AS previous_price
  FROM app_price_history
) AS staged
WHERE staged.previous_price IS NOT NULL
  AND staged.previous_price <> staged.price
ON CONFLICT (app_id, country, request_id) DO NOTHING;
