import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('schema bootstrap contract', () => {
  const baselineSql = readFileSync(resolve(process.cwd(), 'drizzle/0000_init.sql'), 'utf8');
  const followupSql = readFileSync(
    resolve(process.cwd(), 'drizzle/0001_price_change_events.sql'),
    'utf8',
  );

  it('keeps app_price_change_events in the baseline sql asset', () => {
    expect(baselineSql).toContain('CREATE TABLE IF NOT EXISTS app_price_change_events');
    expect(baselineSql).toContain('request_id varchar(96) NOT NULL');
    expect(baselineSql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS app_price_change_events_app_request_uniq',
    );
  });

  it('keeps later worker tables and snapshot metadata in the baseline sql asset', () => {
    expect(baselineSql).toContain('CREATE TABLE IF NOT EXISTS job_leases');
    expect(baselineSql).toContain('CREATE TABLE IF NOT EXISTS price_check_runs');
    expect(baselineSql).toContain('CREATE TABLE IF NOT EXISTS auth_rate_limits');
    expect(baselineSql).toContain('seller_name text');
    expect(baselineSql).toContain('primary_genre_name text');
    expect(baselineSql).toContain('average_user_rating numeric(4, 2)');
    expect(baselineSql).toContain('release_notes text');
  });

  it('guards legacy backfill while preserving idempotent replay semantics', () => {
    expect(followupSql).toContain("to_regclass('app_price_history') IS NOT NULL");
    expect(followupSql).toContain('ON CONFLICT (app_id, country, request_id) DO NOTHING');
  });
});
