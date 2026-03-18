import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EnvConfig } from '../src/env';
import { createUserSubscription } from '../src/services/subscriptions';

type SubscriptionRow = {
  id: string;
  email: string;
  userId: string;
  appId: string;
  country: string;
  targetPrice: number | null;
  isActive: boolean;
  updatedAt: Date;
  createdAt: Date;
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

const createEnv = (): EnvConfig =>
  ({
    DATABASE_URL: 'postgres://test',
    SESSION_TTL_DAYS: 30,
    RESET_PASSWORD_TTL_MINUTES: 30,
    LOGIN_CODE_TTL_MINUTES: 10,
    LOGIN_CODE_RESEND_COOLDOWN_SECONDS: 60,
  }) as EnvConfig;

const createDbMock = () => ({
  insert: () => ({
    values: (row: Omit<SubscriptionRow, 'id' | 'createdAt'>) => ({
      onConflictDoUpdate: ({
        set,
      }: {
        set: Partial<SubscriptionRow>;
      }) => ({
        returning: async () => {
          const created: SubscriptionRow = {
            id: 'sub-1',
            createdAt: row.updatedAt,
            ...row,
            ...set,
          };

          return [created];
        },
      }),
    }),
  }),
});

describe('createUserSubscription refresh contract', () => {
  beforeEach(() => {
    testHooks.dbRef.current = createDbMock();
    testHooks.refreshSingleAppMock.mockReset();
    testHooks.refreshSingleAppMock.mockResolvedValue(null);
  });

  it('passes the shared manual refresh contract after subscription upsert', async () => {
    const env = createEnv();

    await createUserSubscription(
      env,
      {
        id: 'user-1',
        email: 'radar@example.com',
      },
      {
        appId: '123456789',
        country: 'us',
      },
    );

    expect(testHooks.refreshSingleAppMock).toHaveBeenCalledWith(
      env,
      '123456789',
      'US',
      {
        notifyDrops: false,
        source: 'manual',
        requestId: 'subscription-create:sub-1',
      },
    );
  });
});
