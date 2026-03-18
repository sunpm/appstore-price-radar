import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  appDropEvents,
  appPriceChangeEvents,
  appSnapshots,
  subscriptions,
  users,
} from '../src/db/schema';
import type { EnvConfig } from '../src/env';
import { refreshSingleApp } from '../src/lib/checker';

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

type SubscriptionRow = {
  id: string;
  userId: string;
  email: string;
  appId: string;
  country: string;
  targetPrice: number | null;
  lastNotifiedPrice: number | null;
  isActive: boolean;
  updatedAt: Date;
};

type UserRow = {
  id: string;
  email: string;
  isActive: boolean;
};

type DbState = {
  snapshot: SnapshotRow | null;
  events: PriceChangeEventRow[];
  dropEvents: Array<Record<string, unknown>>;
  subscriptions: SubscriptionRow[];
  users: UserRow[];
  nextEventId: number;
  failBatch: boolean;
};

type BatchOperation = {
  apply: () => Promise<void> | void;
};

const testHooks = vi.hoisted(() => ({
  dbRef: { current: null as unknown },
  fetchAppStorePriceMock: vi.fn(),
  sendDropAlertEmailMock: vi.fn(),
}));

const EMPTY_LOOKUP_METADATA = {
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

vi.mock('../src/db/client', () => ({
  getDb: () => testHooks.dbRef.current,
}));

vi.mock('../src/services/auth', () => ({
  countLegacyPasswordHashUsers: vi.fn(async () => 0),
}));

vi.mock('../src/lib/alerts', () => ({
  sendDropAlertEmail: (...args: unknown[]) => testHooks.sendDropAlertEmailMock(...args),
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
  dropEvents: [],
  subscriptions: [],
  users: [],
  nextEventId: 1,
  failBatch: false,
});

const isBatchOperation = (value: unknown): value is BatchOperation => {
  return typeof value === 'object'
    && value !== null
    && 'apply' in value
    && typeof (value as { apply?: unknown }).apply === 'function';
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

      if (table === subscriptions) {
        return {
          innerJoin: () => ({
            where: async () => {
              return state.subscriptions
                .filter(item => item.isActive)
                .map((item) => ({
                  id: item.id,
                  targetPrice: item.targetPrice,
                  userEmail:
                    state.users.find(user => user.id === item.userId && user.isActive)?.email
                    ?? item.email,
                }));
            },
          }),
        };
      }

      return {
        where: () => ({
          limit: async () => [],
        }),
        innerJoin: () => ({
          where: async () => [],
        }),
      };
    },
  }),
  batch: async (writes: unknown[]) => {
    if (state.failBatch) {
      throw new Error('batched writes failed');
    }

    for (const write of writes) {
      if (isBatchOperation(write)) {
        await write.apply();
        continue;
      }

      await write;
    }
  },
  insert: (table: unknown) => {
    if (table === appSnapshots) {
      return {
        values: (row: SnapshotRow) => ({
          onConflictDoUpdate: ({
            set,
          }: {
            set: Partial<SnapshotRow>;
          }): BatchOperation => ({
            apply: () => {
              state.snapshot = {
                ...(state.snapshot ?? row),
                ...row,
                ...set,
              };
            },
          }),
        }),
      };
    }

    if (table === appPriceChangeEvents) {
      return {
        values: (row: Omit<PriceChangeEventRow, 'id'>) => ({
          onConflictDoNothing: (): BatchOperation => ({
            apply: () => {
              state.events.push({
                id: state.nextEventId,
                ...row,
              });
              state.nextEventId += 1;
            },
          }),
        }),
      };
    }

    if (table === appDropEvents) {
      return {
        values: (row: Record<string, unknown>): BatchOperation => ({
          apply: () => {
            state.dropEvents.push(row);
          },
        }),
      };
    }

    return {
      values: async () => undefined,
    };
  },
  update: (table: unknown) => {
    if (table === subscriptions) {
      return {
        set: (patch: Partial<SubscriptionRow>) => ({
          where: async () => {
            const subscription = state.subscriptions[0];

            if (subscription) {
              Object.assign(subscription, patch);
            }
          },
        }),
      };
    }

    return {
      set: () => ({
        where: async () => undefined,
      }),
    };
  },
});

describe('refreshSingleApp atomicity', () => {
  let dbState: DbState;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T00:00:00.000Z'));

    dbState = createDbState();
    testHooks.dbRef.current = createDbMock(dbState);
    testHooks.fetchAppStorePriceMock.mockReset();
    testHooks.sendDropAlertEmailMock.mockReset();
    testHooks.sendDropAlertEmailMock.mockResolvedValue({ sent: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not persist snapshot or events when batched writes fail', async () => {
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
      requestId: 'seed-atomicity',
    });
    dbState.failBatch = true;

    testHooks.fetchAppStorePriceMock.mockResolvedValueOnce({
      kind: 'found',
      appId: '123456789',
      country: 'US',
      appName: 'Radar Pro',
      price: 7.99,
      currency: 'USD',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      iconUrl: null,
      formattedPrice: '$7.99',
      ...EMPTY_LOOKUP_METADATA,
    });

    await expect(
      refreshSingleApp(createEnv(), '123456789', 'US', {
        notifyDrops: true,
        source: 'scheduled',
        requestId: 'req-batch-failure',
      }),
    ).rejects.toThrow('batched writes failed');

    expect(dbState.snapshot?.lastPrice).toBe(9.99);
    expect(dbState.events).toHaveLength(1);
    expect(dbState.dropEvents).toHaveLength(0);
  });

  it('does not change lastNotifiedPrice when alert delivery is not sent', async () => {
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
    dbState.subscriptions.push({
      id: 'sub-1',
      userId: 'user-1',
      email: 'radar@example.com',
      appId: '123456789',
      country: 'US',
      targetPrice: null,
      lastNotifiedPrice: 8.99,
      isActive: true,
      updatedAt: new Date('2026-03-17T00:00:00.000Z'),
    });
    dbState.users.push({
      id: 'user-1',
      email: 'radar@example.com',
      isActive: true,
    });

    testHooks.fetchAppStorePriceMock.mockResolvedValueOnce({
      kind: 'found',
      appId: '123456789',
      country: 'US',
      appName: 'Radar Pro',
      price: 7.99,
      currency: 'USD',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      iconUrl: null,
      formattedPrice: '$7.99',
      ...EMPTY_LOOKUP_METADATA,
    });

    const result = await refreshSingleApp(createEnv(), '123456789', 'US', {
      notifyDrops: true,
      source: 'scheduled',
      requestId: 'req-alert-unsent',
    });

    expect(result).not.toBeNull();
    expect(result?.alertsSent).toBe(0);
    expect(dbState.snapshot?.lastPrice).toBe(7.99);
    expect(dbState.events).toHaveLength(1);
    expect(dbState.dropEvents).toHaveLength(1);
    expect(dbState.subscriptions[0]?.lastNotifiedPrice).toBe(8.99);
  });
});
