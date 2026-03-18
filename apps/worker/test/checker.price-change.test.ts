import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  appDropEvents,
  appPriceChangeEvents,
  appPriceHistory,
  appSnapshots,
} from '../src/db/schema';
import type { EnvConfig } from '../src/env';
import { refreshSingleApp } from '../src/lib/checker';
import { getPriceHistory } from '../src/services/prices';

type SnapshotRow = {
  appId: string;
  country: string;
  appName: string;
  storeUrl: string | null;
  iconUrl: string | null;
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
  dropEvents: Array<Record<string, unknown>>;
  nextEventId: number;
  missingRequestIdColumn: boolean;
  missingChangeEventsTable: boolean;
};

let dbState: DbState;
let dbMock: ReturnType<typeof createDbMock>;

const testHooks = vi.hoisted(() => ({
  dbRef: { current: null as unknown },
  fetchAppStorePriceMock: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  getDb: () => testHooks.dbRef.current,
}));

vi.mock('../src/services/auth', () => ({
  countLegacyPasswordHashUsers: vi.fn(async () => 0),
}));

vi.mock('../src/lib/alerts', () => ({
  sendDropAlertEmail: vi.fn(async () => ({ sent: false })),
}));

vi.mock('../src/lib/appstore', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/appstore')>(
    '../src/lib/appstore',
  );

  return {
    ...actual,
    fetchAppStorePrice: testHooks.fetchAppStorePriceMock,
  };
});

const createEnv = (): EnvConfig =>
  ({
    DATABASE_URL: 'postgres://test',
    SESSION_TTL_DAYS: 30,
    RESET_PASSWORD_TTL_MINUTES: 30,
    LOGIN_CODE_TTL_MINUTES: 10,
    LOGIN_CODE_RESEND_COOLDOWN_SECONDS: 60,
  }) as EnvConfig;

const createDbState = (): DbState => ({
  snapshot: null,
  events: [],
  legacyHistory: [],
  dropEvents: [],
  nextEventId: 1,
  missingRequestIdColumn: false,
  missingChangeEventsTable: false,
});

const mapEventSelection = (
  selection: Record<string, unknown>,
  event: PriceChangeEventRow,
): Record<string, unknown> => {
  const row: Record<string, unknown> = {};

  for (const key of Object.keys(selection)) {
    if (key === 'price') {
      row[key] = event.newAmount;
      continue;
    }

    if (key === 'fetchedAt') {
      row[key] = event.changedAt;
      continue;
    }

    row[key] = (event as Record<string, unknown>)[key];
  }

  return row;
};

const createDbMock = (state: DbState) => {
  return {
    select: (selection?: Record<string, unknown>) => ({
      from: (table: unknown) => {
        if (table === appSnapshots) {
          return {
            where: () => ({
              limit: async (limitValue: number) => {
                if (!state.snapshot || limitValue <= 0) {
                  return [];
                }

                if (!selection) {
                  return [state.snapshot];
                }

                return [
                  Object.fromEntries(
                    Object.keys(selection).map((key) => [
                      key,
                      key === 'price'
                        ? state.snapshot?.lastPrice
                        : (state.snapshot as Record<string, unknown>)[key],
                    ]),
                  ),
                ];
              },
            }),
          };
        }

        if (table === appPriceChangeEvents) {
          return {
            where: () => ({
              orderBy: () => ({
                limit: async (limitValue: number) => {
                  if (state.missingChangeEventsTable) {
                    const error = new Error('Failed query');
                    error.cause = new Error('relation "app_price_change_events" does not exist');
                    throw error;
                  }

                  if (state.missingRequestIdColumn && selection && 'requestId' in selection) {
                    const error = new Error('Failed query');
                    error.cause = new Error('column "request_id" does not exist');
                    throw error;
                  }

                  const sorted = [...state.events].sort(
                    (a, b) => b.changedAt.getTime() - a.changedAt.getTime(),
                  );
                  const limited = sorted.slice(0, limitValue);

                  if (!selection) {
                    return limited;
                  }

                  return limited.map((event) => mapEventSelection(selection, event));
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
                  const sorted = [...state.legacyHistory].sort((a, b) => {
                    const timeDelta = a.fetchedAt.getTime() - b.fetchedAt.getTime();

                    if (timeDelta !== 0) {
                      return timeDelta;
                    }

                    return a.id - b.id;
                  });

                  if (!selection) {
                    return sorted.slice(0, limitValue);
                  }

                  return sorted.slice(0, limitValue).map((row) =>
                    Object.fromEntries(
                      Object.keys(selection).map((key) => [
                        key,
                        (row as Record<string, unknown>)[key],
                      ]),
                    ),
                  );
                },
              }),
            }),
          };
        }

        return {
          where: () => ({
            orderBy: () => ({
              limit: async () => [],
            }),
          }),
        };
      },
    }),
    insert: (table: unknown) => {
      if (table === appSnapshots) {
        return {
          values: (row: SnapshotRow) => ({
            onConflictDoUpdate: async ({
              set,
            }: {
              set: Partial<SnapshotRow>;
            }) => {
              state.snapshot = {
                ...(state.snapshot ?? row),
                ...row,
                ...set,
              };
            },
          }),
        };
      }

      if (table === appPriceChangeEvents) {
        return {
          values: (row: Omit<PriceChangeEventRow, 'id'>) => ({
            onConflictDoNothing: async () => {
              const duplicate = state.events.some(
                (item) =>
                  item.appId === row.appId &&
                  item.country === row.country &&
                  item.requestId === row.requestId,
              );

              if (!duplicate) {
                state.events.push({
                  id: state.nextEventId,
                  ...row,
                });
                state.nextEventId += 1;
              }
            },
          }),
        };
      }

      if (table === appDropEvents) {
        return {
          values: async (row: Record<string, unknown>) => {
            state.dropEvents.push(row);
          },
        };
      }

      return {
        values: async () => undefined,
      };
    },
  };
};

describe('refreshSingleApp change-event persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T00:00:00.000Z'));

    dbState = createDbState();
    dbMock = createDbMock(dbState);
    testHooks.dbRef.current = dbMock;
    testHooks.fetchAppStorePriceMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not insert history event when observed price does not change', async () => {
    dbState.snapshot = {
      appId: '123456789',
      country: 'US',
      appName: 'Radar Pro',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      iconUrl: null,
      currency: 'USD',
      lastPrice: 9.99,
      updatedAt: new Date('2026-03-17T00:00:00.000Z'),
    };

    dbState.events.push({
      id: 1,
      appId: '123456789',
      country: 'US',
      currency: 'USD',
      oldAmount: 12.99,
      newAmount: 9.99,
      changedAt: new Date('2026-03-17T00:00:00.000Z'),
      source: 'scheduled',
      requestId: 'seed-1',
    });

    testHooks.fetchAppStorePriceMock.mockResolvedValueOnce({
      appId: '123456789',
      country: 'US',
      appName: 'Radar Pro',
      price: 9.99,
      currency: 'USD',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      iconUrl: null,
      formattedPrice: '$9.99',
    });

    await refreshSingleApp(createEnv(), '123456789', 'US', {
      notifyDrops: false,
      source: 'scheduled',
      requestId: 'req-same',
    });

    expect(dbState.events).toHaveLength(1);
  });

  it('inserts one provenance-rich event when observed price changes', async () => {
    dbState.snapshot = {
      appId: '123456789',
      country: 'US',
      appName: 'Radar Pro',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      iconUrl: null,
      currency: 'USD',
      lastPrice: 9.99,
      updatedAt: new Date('2026-03-16T00:00:00.000Z'),
    };

    dbState.events.push({
      id: 1,
      appId: '123456789',
      country: 'US',
      currency: 'USD',
      oldAmount: 12.99,
      newAmount: 9.99,
      changedAt: new Date('2026-03-16T00:00:00.000Z'),
      source: 'scheduled',
      requestId: 'seed-2',
    });

    testHooks.fetchAppStorePriceMock.mockResolvedValueOnce({
      appId: '123456789',
      country: 'US',
      appName: 'Radar Pro',
      price: 7.99,
      currency: 'USD',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      iconUrl: null,
      formattedPrice: '$7.99',
    });

    await refreshSingleApp(createEnv(), '123456789', 'US', {
      notifyDrops: false,
      source: 'scheduled',
      requestId: 'req-change-1',
    });

    expect(dbState.events).toHaveLength(2);
    expect(dbState.events[1]).toMatchObject({
      appId: '123456789',
      country: 'US',
      currency: 'USD',
      oldAmount: 9.99,
      newAmount: 7.99,
      source: 'scheduled',
      requestId: 'req-change-1',
    });
    expect(dbState.events[1]?.changedAt.toISOString()).toBe('2026-03-18T00:00:00.000Z');
  });
});

describe('getPriceHistory', () => {
  beforeEach(() => {
    dbState = createDbState();
    dbMock = createDbMock(dbState);
    testHooks.dbRef.current = dbMock;
  });

  it('returns latest snapshot and chronological change events', async () => {
    dbState.snapshot = {
      appId: '123456789',
      country: 'US',
      appName: 'Radar Pro',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      iconUrl: null,
      currency: 'USD',
      lastPrice: 7.99,
      updatedAt: new Date('2026-03-18T00:00:00.000Z'),
    };

    dbState.events.push(
      {
        id: 3,
        appId: '123456789',
        country: 'US',
        currency: 'USD',
        oldAmount: 9.99,
        newAmount: 7.99,
        changedAt: new Date('2026-03-18T00:00:00.000Z'),
        source: 'scheduled',
        requestId: 'req-3',
      },
      {
        id: 1,
        appId: '123456789',
        country: 'US',
        currency: 'USD',
        oldAmount: 12.99,
        newAmount: 9.99,
        changedAt: new Date('2026-01-15T00:00:00.000Z'),
        source: 'scheduled',
        requestId: 'req-1',
      },
      {
        id: 2,
        appId: '123456789',
        country: 'US',
        currency: 'USD',
        oldAmount: 9.99,
        newAmount: 8.99,
        changedAt: new Date('2026-02-10T00:00:00.000Z'),
        source: 'scheduled',
        requestId: 'req-2',
      },
    );

    const result = await getPriceHistory(createEnv(), {
      appId: '123456789',
      country: 'us',
      limit: 10,
    });

    expect(result.status).toBe(200);

    if ('error' in result.body) {
      throw new Error(result.body.error);
    }

    expect(result.body.snapshot?.lastPrice).toBe(7.99);
    expect(result.body.history.map((event) => event.changedAt.toISOString())).toEqual([
      '2026-01-15T00:00:00.000Z',
      '2026-02-10T00:00:00.000Z',
      '2026-03-18T00:00:00.000Z',
    ]);
  });

  it('falls back when request_id column is missing from change events table', async () => {
    dbState.snapshot = {
      appId: '123456789',
      country: 'US',
      appName: 'Radar Pro',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      iconUrl: null,
      currency: 'USD',
      lastPrice: 7.99,
      updatedAt: new Date('2026-03-18T00:00:00.000Z'),
    };
    dbState.missingRequestIdColumn = true;
    dbState.events.push({
      id: 7,
      appId: '123456789',
      country: 'US',
      currency: 'USD',
      oldAmount: 9.99,
      newAmount: 7.99,
      changedAt: new Date('2026-03-18T00:00:00.000Z'),
      source: 'scheduled',
      requestId: 'ignored-in-fallback',
    });

    const result = await getPriceHistory(createEnv(), {
      appId: '123456789',
      country: 'us',
      limit: 10,
    });

    expect(result.status).toBe(200);

    if ('error' in result.body) {
      throw new Error(result.body.error);
    }

    expect(result.body.history).toHaveLength(1);
    expect(result.body.history[0]).toMatchObject({
      id: 7,
      requestId: 'legacy-change-event:7',
      source: 'scheduled',
    });
  });

  it('falls back to legacy snapshot history when change events table is unavailable', async () => {
    dbState.snapshot = {
      appId: '123456789',
      country: 'US',
      appName: 'Radar Pro',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      iconUrl: null,
      currency: 'USD',
      lastPrice: 7.99,
      updatedAt: new Date('2026-03-18T00:00:00.000Z'),
    };
    dbState.missingChangeEventsTable = true;
    dbState.legacyHistory.push(
      {
        id: 1,
        appId: '123456789',
        country: 'US',
        currency: 'USD',
        price: 12.99,
        fetchedAt: new Date('2026-01-15T00:00:00.000Z'),
      },
      {
        id: 2,
        appId: '123456789',
        country: 'US',
        currency: 'USD',
        price: 12.99,
        fetchedAt: new Date('2026-01-16T00:00:00.000Z'),
      },
      {
        id: 3,
        appId: '123456789',
        country: 'US',
        currency: 'USD',
        price: 9.99,
        fetchedAt: new Date('2026-02-10T00:00:00.000Z'),
      },
      {
        id: 4,
        appId: '123456789',
        country: 'US',
        currency: 'USD',
        price: 7.99,
        fetchedAt: new Date('2026-03-18T00:00:00.000Z'),
      },
    );

    const result = await getPriceHistory(createEnv(), {
      appId: '123456789',
      country: 'us',
      limit: 10,
    });

    expect(result.status).toBe(200);

    if ('error' in result.body) {
      throw new Error(result.body.error);
    }

    expect(result.body.history.map((event) => ({
      id: event.id,
      oldAmount: event.oldAmount,
      newAmount: event.newAmount,
      source: event.source,
      requestId: event.requestId,
    }))).toEqual([
      {
        id: 3,
        oldAmount: 12.99,
        newAmount: 9.99,
        source: 'legacy',
        requestId: 'legacy-price-history:3',
      },
      {
        id: 4,
        oldAmount: 9.99,
        newAmount: 7.99,
        source: 'legacy',
        requestId: 'legacy-price-history:4',
      },
    ]);
  });
});
