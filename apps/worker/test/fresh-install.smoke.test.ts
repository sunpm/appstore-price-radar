import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  appDropEvents,
  appPriceChangeEvents,
  appSnapshots,
  jobLeases,
  priceCheckRuns,
  subscriptions,
  userSessions,
  users,
} from '../src/db/schema';
import { hashSessionToken } from '../src/lib/auth';
import worker from '../src/index';
import type { WorkerBindings } from '../src/types';

type UserRow = {
  id: string;
  email: string;
  isActive: boolean;
};

type SessionRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt: Date;
};

type SubscriptionRow = {
  id: string;
  email: string;
  userId: string;
  appId: string;
  country: string;
  targetPrice: number | null;
  lastNotifiedPrice: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

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

type JobLeaseRow = {
  lockKey: string;
  runId: string;
  lockedUntil: Date;
  updatedAt: Date;
};

type PriceCheckRunRow = {
  id: string;
  trigger: string;
  status: string;
  startedAt: Date;
  finishedAt?: Date;
  scanned: number;
  succeeded: number;
  skipped: number;
  failed: number;
  updated: number;
  drops: number;
  emailsSent: number;
  errorSummary: string;
};

type DbState = {
  users: UserRow[];
  sessions: SessionRow[];
  subscriptions: SubscriptionRow[];
  snapshot: SnapshotRow | null;
  events: PriceChangeEventRow[];
  dropEvents: Array<Record<string, unknown>>;
  lease: JobLeaseRow | null;
  runs: PriceCheckRunRow[];
  nextSubscriptionId: number;
  nextEventId: number;
};

type BatchOperation = {
  apply: () => Promise<void> | void;
};

const testHooks = vi.hoisted(() => ({
  dbRef: { current: null as unknown },
  fetchAppStorePriceMock: vi.fn(),
  sendDropAlertEmailMock: vi.fn(async () => ({ sent: false })),
  countLegacyPasswordHashUsersMock: vi.fn(async () => 0),
}));

vi.mock('../src/db/client', () => ({
  getDb: () => testHooks.dbRef.current,
}));

vi.mock('../src/lib/alerts', () => ({
  sendDropAlertEmail: testHooks.sendDropAlertEmailMock,
}));

vi.mock('../src/services/auth', () => ({
  countLegacyPasswordHashUsers: testHooks.countLegacyPasswordHashUsersMock,
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

const AUTH_TOKEN = 'session-token-for-smoke-test';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const SESSION_ID = '10000000-0000-4000-8000-000000000001';

const createBindings = (): WorkerBindings => ({
  DATABASE_URL: 'postgres://test',
  CRON_SECRET: 'cron-secret-123',
  MANUAL_PRICE_CHECKS_ENABLED: 'true',
  APP_BASE_URL: 'https://app.example.com',
  CORS_ORIGIN: 'https://app.example.com',
  SESSION_TTL_DAYS: '30',
  RESET_PASSWORD_TTL_MINUTES: '30',
  LOGIN_CODE_TTL_MINUTES: '10',
  LOGIN_CODE_RESEND_COOLDOWN_SECONDS: '60',
});

const createExecutionContext = (): ExecutionContext =>
  ({
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  }) as unknown as ExecutionContext;

const createDbState = (tokenHash: string): DbState => ({
  users: [
    {
      id: USER_ID,
      email: 'smoke@example.com',
      isActive: true,
    },
  ],
  sessions: [
    {
      id: SESSION_ID,
      userId: USER_ID,
      tokenHash,
      expiresAt: new Date('2026-03-19T00:00:00.000Z'),
      lastUsedAt: new Date('2026-03-17T00:00:00.000Z'),
    },
  ],
  subscriptions: [],
  snapshot: null,
  events: [],
  dropEvents: [],
  lease: null,
  runs: [],
  nextSubscriptionId: 1,
  nextEventId: 1,
});

const mapRowSelection = (
  selection: Record<string, unknown> | undefined,
  row: Record<string, unknown>,
): Record<string, unknown> => {
  if (!selection) {
    return row;
  }

  return Object.fromEntries(
    Object.keys(selection).map((key) => [key, row[key]]),
  );
};

const mapSnapshotSelection = (
  selection: Record<string, unknown>,
  snapshot: SnapshotRow,
): Record<string, unknown> => {
  return Object.fromEntries(
    Object.keys(selection).map((key) => [
      key,
      key === 'price'
        ? snapshot.lastPrice
        : (snapshot as Record<string, unknown>)[key],
    ]),
  );
};

const mapEventSelection = (
  selection: Record<string, unknown>,
  event: PriceChangeEventRow,
): Record<string, unknown> => {
  return Object.fromEntries(
    Object.keys(selection).map((key) => [key, (event as Record<string, unknown>)[key]]),
  );
};

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

              return [mapSnapshotSelection(selection, state.snapshot)];
            },
          }),
        };
      }

      if (table === appPriceChangeEvents) {
        return {
          where: () => ({
            orderBy: () => ({
              limit: async (limitValue: number) => {
                const limited = [...state.events]
                  .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())
                  .slice(0, limitValue);

                if (!selection) {
                  return limited;
                }

                return limited.map((event) => mapEventSelection(selection, event));
              },
            }),
          }),
        };
      }

      if (table === userSessions) {
        return {
          innerJoin: () => ({
            where: () => ({
              limit: async (limitValue: number) => {
                if (limitValue <= 0) {
                  return [];
                }

                const session = state.sessions[0];
                const user = session
                  ? state.users.find(item => item.id === session.userId && item.isActive)
                  : null;

                if (!session || !user) {
                  return [];
                }

                return [
                  {
                    sessionId: session.id,
                    userId: user.id,
                    email: user.email,
                  },
                ];
              },
            }),
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
                    state.users.find(user => user.id === item.userId)?.email ?? item.email,
                }));
            },
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
        innerJoin: () => ({
          where: async () => [],
        }),
      };
    },
  }),
  selectDistinct: () => ({
    from: () => ({
      where: async () => {
        const seen = new Set<string>();

        return state.subscriptions
          .filter(item => item.isActive)
          .filter((item) => {
            const key = `${item.appId}:${item.country}`;

            if (seen.has(key)) {
              return false;
            }

            seen.add(key);
            return true;
          })
          .map(item => ({
            appId: item.appId,
            country: item.country,
        }));
      },
    }),
  }),
  batch: async (writes: unknown[]) => {
    for (const write of writes) {
      if (isBatchOperation(write)) {
        await write.apply();
        continue;
      }

      await write;
    }
  },
  insert: (table: unknown) => {
    if (table === jobLeases) {
      return {
        values: (row: JobLeaseRow) => ({
          onConflictDoNothing: () => ({
            returning: async (selection?: Record<string, unknown>) => {
              if (state.lease) {
                return [];
              }

              state.lease = { ...row };
              return [mapRowSelection(selection, state.lease)];
            },
          }),
        }),
      };
    }

    if (table === priceCheckRuns) {
      return {
        values: async (row: PriceCheckRunRow) => {
          state.runs.push({ ...row });
        },
      };
    }

    if (table === subscriptions) {
      return {
        values: (row: Omit<SubscriptionRow, 'id' | 'createdAt'>) => ({
          onConflictDoUpdate: ({
            set,
          }: {
            set: Partial<SubscriptionRow>;
          }) => ({
            returning: async () => {
              const existing = state.subscriptions.find(
                item =>
                  item.userId === row.userId &&
                  item.appId === row.appId &&
                  item.country === row.country,
              );

              if (existing) {
                Object.assign(existing, row, set);
                return [existing];
              }

              const created: SubscriptionRow = {
                id: `20000000-0000-4000-8000-${String(state.nextSubscriptionId).padStart(12, '0')}`,
                createdAt: row.updatedAt,
                ...row,
              };

              state.nextSubscriptionId += 1;
              state.subscriptions.push(created);
              return [created];
            },
          }),
        }),
      };
    }

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
              const duplicate = state.events.some(
                item =>
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
    if (table === jobLeases) {
      return {
        set: (patch: Partial<JobLeaseRow> & Pick<JobLeaseRow, 'updatedAt' | 'lockedUntil'>) => ({
          where: () => ({
            returning: async (selection?: Record<string, unknown>) => {
              if (!state.lease || state.lease.lockedUntil > patch.updatedAt) {
                return [];
              }

              state.lease = {
                ...state.lease,
                ...patch,
              };
              return [mapRowSelection(selection, state.lease)];
            },
          }),
        }),
      };
    }

    if (table === priceCheckRuns) {
      return {
        set: (patch: Partial<PriceCheckRunRow>) => ({
          where: async () => {
            const current = state.runs[state.runs.length - 1];

            if (current) {
              Object.assign(current, patch);
            }
          },
        }),
      };
    }

    if (table === userSessions) {
      return {
        set: (patch: Partial<SessionRow>) => ({
          where: async () => {
            const session = state.sessions[0];

            if (session) {
              Object.assign(session, patch);
            }
          },
        }),
      };
    }

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
  delete: (table: unknown) => {
    if (table === jobLeases) {
      return {
        where: async () => {
          state.lease = null;
        },
      };
    }

    return {
      where: async () => undefined,
    };
  },
});

describe('fresh install smoke', () => {
  let dbState: DbState;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T00:00:00.000Z'));

    testHooks.fetchAppStorePriceMock.mockReset();
    testHooks.sendDropAlertEmailMock.mockClear();
    testHooks.countLegacyPasswordHashUsersMock.mockReset();
    testHooks.countLegacyPasswordHashUsersMock.mockResolvedValue(0);

    const tokenHash = await hashSessionToken(AUTH_TOKEN);
    dbState = createDbState(tokenHash);
    testHooks.dbRef.current = createDbMock(dbState);
    testHooks.fetchAppStorePriceMock
      .mockResolvedValueOnce({
        appId: '123456789',
        country: 'US',
        appName: 'Radar Pro',
        price: 9.99,
        currency: 'USD',
        storeUrl: 'https://apps.apple.com/us/app/id123456789',
        iconUrl: null,
        formattedPrice: '$9.99',
      })
      .mockResolvedValueOnce({
        appId: '123456789',
        country: 'US',
        appName: 'Radar Pro',
        price: 8.99,
        currency: 'USD',
        storeUrl: 'https://apps.apple.com/us/app/id123456789',
        iconUrl: null,
        formattedPrice: '$8.99',
      });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('covers health, subscription creation, cron check, and price history fetch', async () => {
    const env = createBindings();
    const ctx = createExecutionContext();

    const healthResponse = await worker.fetch(
      new Request('https://example.com/api/health'),
      env,
      ctx,
    );
    const healthPayload = await healthResponse.json();

    expect(healthResponse.status).toBe(200);
    expect(healthPayload).toMatchObject({ ok: true });

    const subscriptionResponse = await worker.fetch(
      new Request('https://example.com/api/subscriptions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${AUTH_TOKEN}`,
        },
        body: JSON.stringify({
          appId: '123456789',
          country: 'US',
        }),
      }),
      env,
      ctx,
    );
    const subscriptionPayload = await subscriptionResponse.json();

    expect(subscriptionResponse.status).toBe(200);
    expect(subscriptionPayload.subscription).toMatchObject({
      appId: '123456789',
      country: 'US',
      isActive: true,
    });
    expect(Object.keys(subscriptionPayload)).toStrictEqual(['subscription']);

    const cronResponse = await worker.fetch(
      new Request('https://example.com/api/jobs/check', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'cron-secret-123',
        },
      }),
      env,
      ctx,
    );
    const cronPayload = await cronResponse.json();

    expect(cronResponse.status).toBe(200);
    expect(cronPayload).toMatchObject({
      scanned: 1,
      succeeded: 1,
      skipped: 0,
      failed: 0,
      updated: 1,
      drops: 1,
      emailsSent: 0,
      errors: [],
    });

    const pricesResponse = await worker.fetch(
      new Request('https://example.com/api/prices/123456789?country=US'),
      env,
      ctx,
    );
    const pricesPayload = await pricesResponse.json();

    expect(pricesResponse.status).toBe(200);
    expect(pricesPayload.snapshot).toMatchObject({
      appId: '123456789',
      country: 'US',
      lastPrice: 8.99,
    });
    expect(pricesPayload.history).toHaveLength(1);
    expect(pricesPayload.history[0]).toMatchObject({
      appId: '123456789',
      country: 'US',
      oldAmount: 9.99,
      newAmount: 8.99,
      source: 'scheduled',
    });
  });

  it('returns 401 for manual check when missing secret header', async () => {
    const env = createBindings();
    const ctx = createExecutionContext();

    const response = await worker.fetch(
      new Request('https://example.com/api/jobs/check', {
        method: 'POST',
      }),
      env,
      ctx,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });
});
