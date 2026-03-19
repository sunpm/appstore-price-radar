import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

import pricesRouter from '../src/routes/prices';
import {
  appPriceChangeEvents,
  appPriceHistory,
  appSnapshots,
} from '../src/db/schema';
import type { EnvConfig } from '../src/env';
import type { AppEnv } from '../src/types';

type SnapshotRow = {
  appId: string;
  country: string;
  appName: string;
  storeUrl: string | null;
  iconUrl: string | null;
  sellerName?: string | null;
  primaryGenreName?: string | null;
  description?: string | null;
  averageUserRating?: number | null;
  userRatingCount?: number | null;
  bundleId?: string | null;
  version?: string | null;
  minimumOsVersion?: string | null;
  releaseNotes?: string | null;
  currency: string;
  lastPrice: number;
  updatedAt: Date;
};

type PriceChangeEventRow = {
  id: number;
  appId: string;
  country: string;
  currency: string;
  oldAmount: number;
  newAmount: number;
  changedAt: Date;
  source: string;
  requestId: string;
};

type LegacyPriceHistoryRow = {
  id: number;
  appId: string;
  country: string;
  currency: string;
  price: number;
  fetchedAt: Date;
};

type DbState = {
  snapshot: SnapshotRow | null;
  events: PriceChangeEventRow[];
  legacyHistory: LegacyPriceHistoryRow[];
};

const testHooks = vi.hoisted(() => ({
  dbRef: { current: null as unknown },
}));

const EMPTY_SNAPSHOT_METADATA = {
  sellerName: null,
  primaryGenreName: null,
  description: null,
  averageUserRating: null,
  userRatingCount: null,
  bundleId: null,
  version: null,
  minimumOsVersion: null,
  releaseNotes: null,
};

const fetchMock = vi.fn();
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

vi.mock('../src/db/client', () => ({
  getDb: () => testHooks.dbRef.current,
}));

const createEnv = (): EnvConfig =>
  ({
    DATABASE_URL: 'postgres://test',
  }) as EnvConfig;

const createDbState = (): DbState => ({
  snapshot: null,
  events: [],
  legacyHistory: [],
});

const mapSelection = (
  selection: Record<string, unknown> | undefined,
  row: Record<string, unknown>,
): Record<string, unknown> => {
  if (!selection) {
    return row;
  }

  return Object.fromEntries(
    Object.keys(selection).map((key) => [
      key,
      row[key],
    ]),
  );
};

const createDbMock = (state: DbState) => ({
  select: (selection?: Record<string, unknown>) => ({
    from: (table: unknown) => {
      if (table === appSnapshots) {
        return {
          where: () => ({
            limit: async (limitValue: number) => {
              if (!state.snapshot || limitValue <= 0) {
                return [];
              }

              return [mapSelection(selection, state.snapshot as Record<string, unknown>)];
            },
          }),
        };
      }

      if (table === appPriceChangeEvents) {
        return {
          where: () => ({
            orderBy: () => ({
              limit: async (limitValue: number) => {
                const sorted = [...state.events].sort((left, right) => {
                  const timeDelta = right.changedAt.getTime() - left.changedAt.getTime();

                  if (timeDelta !== 0) {
                    return timeDelta;
                  }

                  return right.id - left.id;
                });

                return sorted
                  .slice(0, limitValue)
                  .map((row) => mapSelection(selection, row as Record<string, unknown>));
              },
            }),
          }),
        };
      }

      if (table === appPriceHistory) {
        return {
          where: () => ({
            orderBy: () => ({
              limit: async (limitValue: number) => {
                const sorted = [...state.legacyHistory].sort((left, right) => {
                  const timeDelta = left.fetchedAt.getTime() - right.fetchedAt.getTime();

                  if (timeDelta !== 0) {
                    return timeDelta;
                  }

                  return left.id - right.id;
                });

                return sorted
                  .slice(0, limitValue)
                  .map((row) => mapSelection(selection, row as Record<string, unknown>));
              },
            }),
          }),
        };
      }

      return {
        where: () => ({
          limit: async () => [],
          orderBy: () => ({
            limit: async () => [],
          }),
        }),
      };
    },
  }),
});

const createApp = (): Hono<AppEnv> => {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('config', createEnv());
    await next();
  });

  app.route('/api/prices', pricesRouter);
  return app;
};

describe('prices history route', () => {
  let dbState: DbState;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T00:00:00.000Z'));
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error('network unavailable'));
    vi.stubGlobal('fetch', fetchMock);
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    dbState = createDbState();
    testHooks.dbRef.current = createDbMock(dbState);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns default window and excludes stale events outside 90d', async () => {
    dbState.snapshot = {
      appId: '123456789',
      country: 'US',
      appName: 'Radar Pro',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      iconUrl: null,
      sellerName: 'Sunset Studio',
      primaryGenreName: 'Productivity',
      description: 'Track prices with confidence.',
      averageUserRating: 4.7,
      userRatingCount: 1820,
      bundleId: 'com.example.radarpro',
      version: '3.2.1',
      minimumOsVersion: '15.0',
      releaseNotes: 'Bug fixes and chart refinements.',
      currency: 'USD',
      lastPrice: 8.99,
      updatedAt: new Date('2026-03-18T00:00:00.000Z'),
    };
    dbState.events.push(
      {
        id: 1,
        appId: '123456789',
        country: 'US',
        currency: 'USD',
        oldAmount: 19.99,
        newAmount: 17.99,
        changedAt: new Date('2025-11-01T00:00:00.000Z'),
        source: 'scheduled',
        requestId: 'req-1',
      },
      {
        id: 2,
        appId: '123456789',
        country: 'US',
        currency: 'USD',
        oldAmount: 17.99,
        newAmount: 12.99,
        changedAt: new Date('2026-01-20T00:00:00.000Z'),
        source: 'scheduled',
        requestId: 'req-2',
      },
    );

    const app = createApp();
    const response = await app.request('https://example.com/api/prices/123456789?country=US');
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.page).toMatchObject({
      window: '90d',
      pageSize: 60,
      hasMore: false,
      nextCursor: null,
    });
    expect(payload.history).toHaveLength(1);
    expect(payload.summary).toMatchObject({
      totalChanges: 1,
      latestChangeAt: '2026-01-20T00:00:00.000Z',
      earliestChangeAt: '2026-01-20T00:00:00.000Z',
    });
    expect(payload.metadata).toMatchObject({
      sellerName: 'Sunset Studio',
      primaryGenreName: 'Productivity',
      averageUserRating: 4.7,
      userRatingCount: 1820,
      bundleId: 'com.example.radarpro',
      version: '3.2.1',
      minimumOsVersion: '15.0',
    });
  });

  it('returns hasMore and nextCursor when page is truncated', async () => {
    dbState.snapshot = {
      appId: '123456789',
      country: 'US',
      appName: 'Radar Pro',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      iconUrl: null,
      ...EMPTY_SNAPSHOT_METADATA,
      currency: 'USD',
      lastPrice: 7.99,
      updatedAt: new Date('2026-03-18T00:00:00.000Z'),
    };
    dbState.events.push(
      {
        id: 1,
        appId: '123456789',
        country: 'US',
        currency: 'USD',
        oldAmount: 12.99,
        newAmount: 10.99,
        changedAt: new Date('2026-03-15T00:00:00.000Z'),
        source: 'scheduled',
        requestId: 'req-1',
      },
      {
        id: 2,
        appId: '123456789',
        country: 'US',
        currency: 'USD',
        oldAmount: 10.99,
        newAmount: 8.99,
        changedAt: new Date('2026-03-12T00:00:00.000Z'),
        source: 'scheduled',
        requestId: 'req-2',
      },
      {
        id: 3,
        appId: '123456789',
        country: 'US',
        currency: 'USD',
        oldAmount: 8.99,
        newAmount: 7.99,
        changedAt: new Date('2026-03-10T00:00:00.000Z'),
        source: 'scheduled',
        requestId: 'req-3',
      },
    );

    const app = createApp();
    const response = await app.request(
      'https://example.com/api/prices/123456789?country=US&window=all&pageSize=2',
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.page.hasMore).toBe(true);
    expect(payload.page.nextCursor).toBe('2026-03-12T00:00:00.000Z__2');
    expect(payload.history).toHaveLength(2);
  });

  it('rejects invalid cursor values', async () => {
    const app = createApp();
    const response = await app.request(
      'https://example.com/api/prices/123456789?country=US&window=all&pageSize=2&cursor=not-a-valid-cursor',
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: 'Invalid cursor',
    });
  });
});
