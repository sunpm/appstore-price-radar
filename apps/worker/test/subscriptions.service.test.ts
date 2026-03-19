import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appSnapshots, subscriptions } from '../src/db/schema';
import type { EnvConfig } from '../src/env';
import {
  createUserSubscription,
  deleteUserSubscription,
  listUserSubscriptions,
  toSubscriptionItemDto,
} from '../src/services/subscriptions';

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
  appName: string | null;
  storeUrl: string | null;
  iconUrl: string | null;
  lastPrice: number | null;
  currency: string | null;
};

type DbState = {
  subscriptions: SubscriptionRow[];
  snapshots: SnapshotRow[];
  nextSubscriptionId: number;
};

const testHooks = vi.hoisted(() => ({
  dbRef: { current: null as unknown },
  refreshSingleAppMock: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  getDb: () => testHooks.dbRef.current,
}));

vi.mock('../src/lib/checker', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/checker')>(
    '../src/lib/checker',
  );

  return {
    ...actual,
    refreshSingleApp: testHooks.refreshSingleAppMock,
  };
});

const createConfig = (): EnvConfig => ({
  DATABASE_URL: 'postgres://test',
  SESSION_TTL_DAYS: 30,
  RESET_PASSWORD_TTL_MINUTES: 30,
  LOGIN_CODE_TTL_MINUTES: 10,
  LOGIN_CODE_RESEND_COOLDOWN_SECONDS: 60,
});

const createDbMock = (state: DbState) => ({
  insert: (table: unknown) => ({
    values: (raw: Record<string, unknown>) => ({
      onConflictDoUpdate: ({
        set,
      }: {
        set: Partial<SubscriptionRow>;
      }) => ({
        returning: async () => {
          const created: SubscriptionRow = {
            id: `sub-${state.nextSubscriptionId}`,
            email: String(raw.email),
            userId: String(raw.userId),
            appId: String(raw.appId),
            country: String(raw.country),
            targetPrice: (raw.targetPrice as number | null) ?? null,
            lastNotifiedPrice: null,
            isActive: Boolean(raw.isActive),
            createdAt: raw.updatedAt as Date,
            updatedAt: raw.updatedAt as Date,
            ...set,
          };

          state.nextSubscriptionId += 1;
          state.subscriptions = [created];
          return [created];
        },
      }),
    }),
  }),
  select: (selection?: Record<string, unknown>) => ({
    from: (table: unknown) => {
      if (table === subscriptions) {
        return {
          leftJoin: () => ({
            where: () => ({
              orderBy: async () => {
                const rows = [...state.subscriptions]
                  .filter(item => item.isActive)
                  .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                  .map((item) => {
                    const snapshot = state.snapshots.find(
                      entry => entry.appId === item.appId && entry.country === item.country,
                    );

                    const row = {
                      id: item.id,
                      appId: item.appId,
                      country: item.country,
                      targetPrice: item.targetPrice,
                      lastNotifiedPrice: item.lastNotifiedPrice,
                      isActive: item.isActive,
                      createdAt: item.createdAt,
                      updatedAt: item.updatedAt,
                      appName: snapshot?.appName ?? null,
                      storeUrl: snapshot?.storeUrl ?? null,
                      iconUrl: snapshot?.iconUrl ?? null,
                      currentPrice: snapshot?.lastPrice ?? null,
                      currency: snapshot?.currency ?? null,
                    };

                    if (!selection) {
                      return row;
                    }

                    return Object.fromEntries(
                      Object.keys(selection).map(key => [key, row[key as keyof typeof row]]),
                    );
                  });

                return rows;
              },
            }),
          }),
        };
      }

      return {
        leftJoin: () => ({
          where: () => ({
            orderBy: async () => [],
          }),
        }),
      };
    },
  }),
  update: (table: unknown) => ({
    set: (patch: Record<string, unknown>) => ({
      where: () => {
        if (table !== subscriptions || state.subscriptions.length === 0) {
          return {
            returning: async () => [],
          };
        }

        const row = state.subscriptions[0];
        Object.assign(row, patch);

        return {
          returning: async () => [{ id: row.id }],
        };
      },
    }),
  }),
});

describe('subscriptions service regressions', () => {
  let dbState: DbState;
  let config: EnvConfig;

  beforeEach(() => {
    testHooks.refreshSingleAppMock.mockReset();
    testHooks.refreshSingleAppMock.mockResolvedValue(null);

    dbState = {
      subscriptions: [],
      snapshots: [],
      nextSubscriptionId: 1,
    };
    config = createConfig();
    testHooks.dbRef.current = createDbMock(dbState);
  });

  it('createUserSubscription returns the upserted DTO shape and refresh contract', async () => {
    const response = await createUserSubscription(
      config,
      {
        id: 'user-1',
        email: 'radar@example.com',
      },
      {
        appId: '123456789',
        country: 'us',
        targetPrice: 6.66,
      },
    );

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      subscription: {
        id: 'sub-1',
        appId: '123456789',
        country: 'US',
        targetPrice: 6.66,
        lastNotifiedPrice: null,
        isActive: true,
        appName: null,
        storeUrl: null,
        iconUrl: null,
        currentPrice: null,
        currency: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
    expect(testHooks.refreshSingleAppMock).toHaveBeenCalledWith(
      config,
      '123456789',
      'US',
      {
        notifyDrops: false,
        source: 'manual',
        requestId: 'subscription-create:sub-1',
      },
    );
  });

  it('listUserSubscriptions preserves createdAt desc ordering and maps rows through toSubscriptionItemDto', async () => {
    dbState.subscriptions = [
      {
        id: 'sub-older',
        email: 'radar@example.com',
        userId: 'user-1',
        appId: '123456789',
        country: 'US',
        targetPrice: 9.99,
        lastNotifiedPrice: 8.99,
        isActive: true,
        createdAt: new Date('2026-03-18T10:00:00.000Z'),
        updatedAt: new Date('2026-03-18T10:05:00.000Z'),
      },
      {
        id: 'sub-latest',
        email: 'radar@example.com',
        userId: 'user-1',
        appId: '555666777',
        country: 'CN',
        targetPrice: null,
        lastNotifiedPrice: null,
        isActive: true,
        createdAt: new Date('2026-03-19T10:00:00.000Z'),
        updatedAt: new Date('2026-03-19T10:05:00.000Z'),
      },
    ];
    dbState.snapshots = [
      {
        appId: '123456789',
        country: 'US',
        appName: 'Radar Pro',
        storeUrl: 'https://apps.apple.com/us/app/id123456789',
        iconUrl: 'https://example.com/radar-pro.png',
        lastPrice: 7.99,
        currency: 'USD',
      },
      {
        appId: '555666777',
        country: 'CN',
        appName: 'Radar Lite',
        storeUrl: 'https://apps.apple.com/cn/app/id555666777',
        iconUrl: 'https://example.com/radar-lite.png',
        lastPrice: 0,
        currency: 'CNY',
      },
    ];

    const response = await listUserSubscriptions(config, 'user-1');

    expect(response.status).toBe(200);
    expect(response.body.items).toStrictEqual([
      toSubscriptionItemDto({
        id: 'sub-latest',
        appId: '555666777',
        country: 'CN',
        targetPrice: null,
        lastNotifiedPrice: null,
        isActive: true,
        createdAt: new Date('2026-03-19T10:00:00.000Z'),
        updatedAt: new Date('2026-03-19T10:05:00.000Z'),
        appName: 'Radar Lite',
        storeUrl: 'https://apps.apple.com/cn/app/id555666777',
        iconUrl: 'https://example.com/radar-lite.png',
        currentPrice: 0,
        currency: 'CNY',
      }),
      toSubscriptionItemDto({
        id: 'sub-older',
        appId: '123456789',
        country: 'US',
        targetPrice: 9.99,
        lastNotifiedPrice: 8.99,
        isActive: true,
        createdAt: new Date('2026-03-18T10:00:00.000Z'),
        updatedAt: new Date('2026-03-18T10:05:00.000Z'),
        appName: 'Radar Pro',
        storeUrl: 'https://apps.apple.com/us/app/id123456789',
        iconUrl: 'https://example.com/radar-pro.png',
        currentPrice: 7.99,
        currency: 'USD',
      }),
    ]);
  });

  it('deleteUserSubscription returns ok for an active subscription', async () => {
    dbState.subscriptions = [{
      id: 'sub-1',
      email: 'radar@example.com',
      userId: 'user-1',
      appId: '123456789',
      country: 'US',
      targetPrice: null,
      lastNotifiedPrice: null,
      isActive: true,
      createdAt: new Date('2026-03-19T10:00:00.000Z'),
      updatedAt: new Date('2026-03-19T10:00:00.000Z'),
    }];

    const response = await deleteUserSubscription(config, 'user-1', { id: 'sub-1' });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ ok: true, id: 'sub-1' });
    expect(dbState.subscriptions[0]?.isActive).toBe(false);
  });

  it('deleteUserSubscription returns 404 for a missing subscription', async () => {
    const response = await deleteUserSubscription(config, 'user-1', { id: 'sub-missing' });

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({ error: 'Subscription not found' });
  });
});
