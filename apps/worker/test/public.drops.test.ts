import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appDropEvents } from '../src/db/schema';
import type { EnvConfig } from '../src/env';
import { getPublicDrops } from '../src/services/public';

type DropEventRow = {
  id: number;
  appId: string;
  country: string;
  appName: string;
  storeUrl: string | null;
  iconUrl: string | null;
  currency: string;
  oldPrice: number;
  newPrice: number;
  dropPercent: number | null;
  detectedAt: Date;
};

type SubscriptionRow = {
  appId: string;
  country: string;
  isActive: boolean;
};

type DbState = {
  events: DropEventRow[];
  subscriptions: SubscriptionRow[];
};

type LatestDropsSubquery = {
  __kind: 'latestDrops';
  rows: Array<DropEventRow & { submissionCount: number }>;
  detectedAt: typeof appDropEvents.detectedAt;
  id: typeof appDropEvents.id;
};

const testHooks = vi.hoisted(() => ({
  dbRef: { current: null as unknown },
}));

vi.mock('../src/db/client', () => ({
  getDb: () => testHooks.dbRef.current,
}));

const createEnv = (): EnvConfig =>
  ({
    DATABASE_URL: 'postgres://test',
  }) as EnvConfig;

const createDbState = (): DbState => ({
  events: [],
  subscriptions: [],
});

const extractParamValues = (value: unknown): unknown[] => {
  if (!value || typeof value !== 'object') {
    return [];
  }

  if ('queryChunks' in value && Array.isArray(value.queryChunks)) {
    return value.queryChunks.flatMap(chunk => extractParamValues(chunk));
  }

  if ('value' in value && !Array.isArray(value.value)) {
    return [value.value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(chunk => extractParamValues(chunk));
  }

  return [];
};

const resolveCountryFilter = (where: unknown): string | undefined => {
  const param = extractParamValues(where).find(
    value => typeof value === 'string' && value.length === 2,
  );

  return typeof param === 'string' ? param : undefined;
};

const compareByLatestDetection = (left: DropEventRow, right: DropEventRow): number => {
  const timeDelta = right.detectedAt.getTime() - left.detectedAt.getTime();

  if (timeDelta !== 0) {
    return timeDelta;
  }

  return right.id - left.id;
};

const applyCountryFilter = (rows: DropEventRow[], where: unknown): DropEventRow[] => {
  const country = resolveCountryFilter(where);

  if (!country) {
    return [...rows];
  }

  return rows.filter(row => row.country === country);
};

const countActiveSubscriptions = (
  rows: DropEventRow[],
  subscriptions: SubscriptionRow[],
): Array<DropEventRow & { submissionCount: number }> => {
  return rows.map((row) => ({
    ...row,
    submissionCount: subscriptions.filter(subscription =>
      subscription.isActive
      && subscription.appId === row.appId
      && subscription.country === row.country,
    ).length,
  }));
};

const createLatestDropsSubquery = (state: DbState, where: unknown): LatestDropsSubquery => {
  const latestByPair = new Map<string, DropEventRow>();

  for (const row of applyCountryFilter(state.events, where).sort(compareByLatestDetection)) {
    const key = `${row.appId}:${row.country}`;

    if (!latestByPair.has(key)) {
      latestByPair.set(key, row);
    }
  }

  return {
    __kind: 'latestDrops',
    rows: countActiveSubscriptions(
      Array.from(latestByPair.values()).sort(compareByLatestDetection),
      state.subscriptions,
    ),
    detectedAt: appDropEvents.detectedAt,
    id: appDropEvents.id,
  };
};

const isLatestDropsSubquery = (value: unknown): value is LatestDropsSubquery => {
  return typeof value === 'object'
    && value !== null
    && '__kind' in value
    && value.__kind === 'latestDrops';
};

const createDbMock = (state: DbState) => ({
  selectDistinctOn: () => ({
    from: (table: unknown) => {
      if (table !== appDropEvents) {
        throw new Error('Unexpected table in selectDistinctOn');
      }

      return {
        where: (where: unknown) => ({
          orderBy: () => ({
            as: () => createLatestDropsSubquery(state, where),
          }),
        }),
      };
    },
  }),
  select: () => ({
    from: (table: unknown) => {
      if (table === appDropEvents) {
        return {
          where: (where: unknown) => ({
            orderBy: () => ({
              limit: async (limitValue: number) =>
                countActiveSubscriptions(
                  applyCountryFilter(state.events, where)
                    .sort(compareByLatestDetection)
                    .slice(0, limitValue),
                  state.subscriptions,
                ),
            }),
          }),
        };
      }

      if (isLatestDropsSubquery(table)) {
        return {
          orderBy: () => ({
            limit: async (limitValue: number) =>
              [...table.rows]
                .sort(compareByLatestDetection)
                .slice(0, limitValue),
          }),
        };
      }

      throw new Error('Unexpected table in select');
    },
  }),
});

describe('getPublicDrops', () => {
  let dbState: DbState;

  beforeEach(() => {
    dbState = createDbState();
    testHooks.dbRef.current = createDbMock(dbState);
  });

  it('returns newest-per-pair dedupe in descending order with active submissionCount only', async () => {
    dbState.events.push(
      {
        id: 41,
        appId: 'app-b',
        country: 'US',
        appName: 'Beta Radar',
        storeUrl: 'https://apps.apple.com/us/app/id41',
        iconUrl: null,
        currency: 'USD',
        oldPrice: 9.99,
        newPrice: 4.99,
        dropPercent: 50,
        detectedAt: new Date('2026-03-19T12:00:00.000Z'),
      },
      {
        id: 19,
        appId: 'app-a',
        country: 'US',
        appName: 'Alpha Radar',
        storeUrl: 'https://apps.apple.com/us/app/id19',
        iconUrl: null,
        currency: 'USD',
        oldPrice: 19.99,
        newPrice: 14.99,
        dropPercent: 25,
        detectedAt: new Date('2026-03-19T10:30:00.000Z'),
      },
      {
        id: 18,
        appId: 'app-a',
        country: 'US',
        appName: 'Alpha Radar',
        storeUrl: 'https://apps.apple.com/us/app/id18',
        iconUrl: null,
        currency: 'USD',
        oldPrice: 19.99,
        newPrice: 15.99,
        dropPercent: 20,
        detectedAt: new Date('2026-03-19T10:30:00.000Z'),
      },
      {
        id: 7,
        appId: 'app-c',
        country: 'CA',
        appName: 'Gamma Radar',
        storeUrl: 'https://apps.apple.com/ca/app/id7',
        iconUrl: null,
        currency: 'CAD',
        oldPrice: 6.99,
        newPrice: 3.99,
        dropPercent: 42.92,
        detectedAt: new Date('2026-03-18T08:00:00.000Z'),
      },
    );
    dbState.subscriptions.push(
      { appId: 'app-a', country: 'US', isActive: true },
      { appId: 'app-a', country: 'US', isActive: true },
      { appId: 'app-a', country: 'US', isActive: false },
      { appId: 'app-b', country: 'US', isActive: true },
      { appId: 'app-c', country: 'CA', isActive: false },
    );

    const result = await getPublicDrops(createEnv(), {
      dedupe: true,
      limit: 3,
    });

    expect(result.status).toBe(200);
    expect(result.body.items.map(item => item.id)).toEqual([41, 19, 7]);
    expect(result.body.items.map(item => `${item.appId}:${item.country}`)).toEqual([
      'app-b:US',
      'app-a:US',
      'app-c:CA',
    ]);
    expect(result.body.items.map(item => item.submissionCount)).toEqual([1, 2, 0]);
  });

  it('applies country filter before dedupe and uppercases the provided country filter', async () => {
    dbState.events.push(
      {
        id: 12,
        appId: 'app-a',
        country: 'US',
        appName: 'Alpha Radar',
        storeUrl: 'https://apps.apple.com/us/app/id12',
        iconUrl: null,
        currency: 'USD',
        oldPrice: 12.99,
        newPrice: 8.99,
        dropPercent: 30.79,
        detectedAt: new Date('2026-03-19T09:00:00.000Z'),
      },
      {
        id: 11,
        appId: 'app-b',
        country: 'CA',
        appName: 'Beta Radar',
        storeUrl: 'https://apps.apple.com/ca/app/id11',
        iconUrl: null,
        currency: 'CAD',
        oldPrice: 10.99,
        newPrice: 6.99,
        dropPercent: 36.4,
        detectedAt: new Date('2026-03-19T08:00:00.000Z'),
      },
    );
    dbState.subscriptions.push(
      { appId: 'app-a', country: 'US', isActive: true },
      { appId: 'app-b', country: 'CA', isActive: true },
    );

    const result = await getPublicDrops(createEnv(), {
      country: 'us',
      dedupe: true,
      limit: 10,
    });

    expect(result.status).toBe(200);
    expect(result.body.items).toHaveLength(1);
    expect(result.body.items[0]).toMatchObject({
      appId: 'app-a',
      country: 'US',
      submissionCount: 1,
    });
  });
});
