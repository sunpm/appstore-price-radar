import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EnvConfig } from '../src/env';
import { runPriceCheck } from '../src/lib/checker';

type WatchedPair = {
  appId: string;
  country: string;
};

const testHooks = vi.hoisted(() => ({
  dbRef: { current: null as unknown },
  legacyMetricMock: vi.fn(async () => 0),
}));

vi.mock('../src/db/client', () => ({
  getDb: () => testHooks.dbRef.current,
}));

vi.mock('../src/services/auth', () => ({
  countLegacyPasswordHashUsers: testHooks.legacyMetricMock,
}));

const createEnv = (overrides: Record<string, unknown> = {}): EnvConfig =>
  ({
    DATABASE_URL: 'postgres://test',
    SESSION_TTL_DAYS: 30,
    RESET_PASSWORD_TTL_MINUTES: 30,
    LOGIN_CODE_TTL_MINUTES: 10,
    LOGIN_CODE_RESEND_COOLDOWN_SECONDS: 60,
    ...overrides,
  }) as EnvConfig;

const createDbMock = (pairs: WatchedPair[]) => ({
  selectDistinct: () => ({
    from: () => ({
      where: async () => pairs,
    }),
  }),
});

describe('scheduler safety defaults', () => {
  it('uses a conservative cron cadence at or above six-hour intervals', () => {
    const wranglerToml = readFileSync(resolve(process.cwd(), 'wrangler.toml'), 'utf8');

    expect(wranglerToml).toContain('crons = ["0 */6 * * *"]');
    expect(wranglerToml).not.toContain('*/30 * * * *');
  });
});

describe('runPriceCheck rate safety', () => {
  beforeEach(() => {
    testHooks.legacyMetricMock.mockReset();
    testHooks.legacyMetricMock.mockResolvedValue(0);
  });

  it('retries 429 and transient failures with bounded backoff instead of tight loops', async () => {
    testHooks.dbRef.current = createDbMock([{ appId: '123456789', country: 'US' }]);

    const sleepMock = vi.fn(async (_ms: number) => undefined);
    const refreshSingleAppMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('App Store request failed with status 429'))
      .mockRejectedValueOnce(new Error('App Store request failed with status 503'))
      .mockResolvedValueOnce({
        appId: '123456789',
        country: 'US',
        appName: 'Radar Pro',
        oldPrice: 9.99,
        newPrice: 7.99,
        currency: 'USD',
        priceChanged: true,
        priceDropped: true,
        alertsSent: 0,
      });

    const report = await runPriceCheck(
      createEnv({
        PRICE_CHECK_MAX_CALLS_PER_MINUTE: 12,
        PRICE_CHECK_RETRY_BASE_SECONDS: 15,
        PRICE_CHECK_RETRY_MAX_SECONDS: 60,
        PRICE_CHECK_RETRY_JITTER_SECONDS: 0,
        PRICE_CHECK_MAX_RETRIES: 3,
      }),
      {
        sleep: sleepMock,
        random: () => 0,
        refreshSingleApp: refreshSingleAppMock,
      },
    );

    expect(refreshSingleAppMock).toHaveBeenCalledTimes(3);
    expect(refreshSingleAppMock.mock.calls[0]?.[2]).toMatchObject({
      notifyDrops: true,
      source: 'scheduled',
    });
    expect(refreshSingleAppMock.mock.calls[0]?.[2]?.requestId).toMatch(/^scheduled:/);
    expect(sleepMock).toHaveBeenNthCalledWith(1, 15000);
    expect(sleepMock).toHaveBeenNthCalledWith(2, 30000);
    expect(report).toMatchObject({
      scanned: 1,
      succeeded: 1,
      skipped: 0,
      failed: 0,
    });
  });

  it('applies request pacing between watched pairs to cap per-run fetch pressure', async () => {
    testHooks.dbRef.current = createDbMock([
      { appId: '1001', country: 'US' },
      { appId: '1002', country: 'US' },
      { appId: '1003', country: 'US' },
    ]);

    const sleepMock = vi.fn(async (_ms: number) => undefined);
    const refreshSingleAppMock = vi.fn().mockResolvedValue({
      appId: '1001',
      country: 'US',
      appName: 'Radar Pro',
      oldPrice: 9.99,
      newPrice: 9.99,
      currency: 'USD',
      priceChanged: false,
      priceDropped: false,
      alertsSent: 0,
    });

    const report = await runPriceCheck(
      createEnv({
        PRICE_CHECK_MAX_CALLS_PER_MINUTE: 12,
        PRICE_CHECK_RETRY_BASE_SECONDS: 15,
        PRICE_CHECK_RETRY_MAX_SECONDS: 60,
        PRICE_CHECK_RETRY_JITTER_SECONDS: 0,
        PRICE_CHECK_MAX_RETRIES: 2,
      }),
      {
        sleep: sleepMock,
        random: () => 0,
        refreshSingleApp: refreshSingleAppMock,
      },
    );

    expect(refreshSingleAppMock).toHaveBeenCalledTimes(3);
    expect(refreshSingleAppMock.mock.calls[0]?.[2]).toMatchObject({
      notifyDrops: true,
      source: 'scheduled',
    });
    expect(refreshSingleAppMock.mock.calls[0]?.[2]?.requestId).toMatch(/^scheduled:/);
    expect(sleepMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenNthCalledWith(1, 5000);
    expect(sleepMock).toHaveBeenNthCalledWith(2, 5000);
    expect(report).toMatchObject({
      scanned: 3,
      succeeded: 3,
      skipped: 0,
      failed: 0,
    });
  });
});
