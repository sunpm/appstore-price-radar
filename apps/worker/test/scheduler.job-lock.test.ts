import { beforeEach, describe, expect, it, vi } from 'vitest';

import { jobLeases, priceCheckRuns } from '../src/db/schema';
import type { EnvConfig } from '../src/env';
import type { CheckReport } from '../src/lib/checker.types';
import { runProtectedPriceCheck } from '../src/services/jobs';

type LeaseRow = {
  lockKey: string;
  runId: string;
  lockedUntil: Date;
  updatedAt: Date;
};

type RunRow = {
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
  lease: LeaseRow | null;
  runs: RunRow[];
};

const testHooks = vi.hoisted(() => ({
  dbRef: { current: null as unknown },
  runPriceCheckMock: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  getDb: () => testHooks.dbRef.current,
}));

vi.mock('../src/lib/checker', () => ({
  runPriceCheck: testHooks.runPriceCheckMock,
}));

const createEnv = (overrides: Record<string, unknown> = {}): EnvConfig =>
  ({
    DATABASE_URL: 'postgres://test',
    SESSION_TTL_DAYS: 30,
    RESET_PASSWORD_TTL_MINUTES: 30,
    LOGIN_CODE_TTL_MINUTES: 10,
    LOGIN_CODE_RESEND_COOLDOWN_SECONDS: 60,
    PRICE_CHECK_LOCK_TTL_SECONDS: 900,
    ...overrides,
  }) as EnvConfig;

const mapSelection = (
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

const createDbMock = (state: DbState) => ({
  select: (selection?: Record<string, unknown>) => ({
    from: (table: unknown) => {
      if (table === jobLeases) {
        return {
          where: () => ({
            limit: async (limitValue: number) => {
              if (!state.lease || limitValue <= 0) {
                return [];
              }

              return [mapSelection(selection, state.lease)];
            },
          }),
        };
      }

      return {
        where: () => ({
          limit: async () => [],
        }),
      };
    },
  }),
  insert: (table: unknown) => {
    if (table === jobLeases) {
      return {
        values: (row: LeaseRow) => ({
          onConflictDoNothing: () => ({
            returning: async (selection?: Record<string, unknown>) => {
              if (state.lease) {
                return [];
              }

              state.lease = { ...row };
              return [mapSelection(selection, state.lease)];
            },
          }),
        }),
      };
    }

    if (table === priceCheckRuns) {
      return {
        values: async (row: RunRow) => {
          state.runs.push({ ...row });
        },
      };
    }

    return {
      values: async () => undefined,
    };
  },
  update: (table: unknown) => {
    if (table === jobLeases) {
      return {
        set: (patch: Partial<LeaseRow> & Pick<LeaseRow, 'updatedAt' | 'lockedUntil'>) => ({
          where: () => ({
            returning: async (selection?: Record<string, unknown>) => {
              if (!state.lease || state.lease.lockedUntil > patch.updatedAt) {
                return [];
              }

              state.lease = {
                ...state.lease,
                ...patch,
              };
              return [mapSelection(selection, state.lease)];
            },
          }),
        }),
      };
    }

    if (table === priceCheckRuns) {
      return {
        set: (patch: Partial<RunRow>) => ({
          where: async () => {
            const run = state.runs[state.runs.length - 1];
            if (run) {
              Object.assign(run, patch);
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

describe('runProtectedPriceCheck job lease', () => {
  let dbState: DbState;

  beforeEach(() => {
    testHooks.runPriceCheckMock.mockReset();
    dbState = {
      lease: null,
      runs: [],
    };
    testHooks.dbRef.current = createDbMock(dbState);
  });

  it('persists a completed run summary and releases lease', async () => {
    testHooks.runPriceCheckMock.mockResolvedValueOnce({
      startedAt: '2026-03-18T00:00:00.000Z',
      finishedAt: '2026-03-18T00:05:00.000Z',
      scanned: 3,
      succeeded: 2,
      skipped: 1,
      failed: 0,
      updated: 2,
      drops: 1,
      emailsSent: 1,
      errors: ['app not found in App Store: 1002 (US)'],
    } satisfies CheckReport);

    const result = await runProtectedPriceCheck(createEnv(), { trigger: 'scheduled' });

    expect(result.kind).toBe('completed');
    if (result.kind === 'completed') {
      expect(result.report).toMatchObject({
        scanned: 3,
        succeeded: 2,
        skipped: 1,
        failed: 0,
      });
    }
    expect(dbState.lease).toBeNull();
    expect(dbState.runs).toHaveLength(1);
    expect(dbState.runs[0]).toMatchObject({
      trigger: 'scheduled',
      status: 'completed',
      scanned: 3,
      succeeded: 2,
      skipped: 1,
      failed: 0,
      updated: 2,
      drops: 1,
      emailsSent: 1,
      errorSummary: 'app not found in App Store: 1002 (US)',
    });
  });

  it('skips duplicate price-check runs while a lease is active', async () => {
    let resolveRun: ((report: CheckReport) => void) | null = null;
    const runPromise = new Promise<CheckReport>((resolve) => {
      resolveRun = resolve;
    });
    testHooks.runPriceCheckMock.mockReturnValueOnce(runPromise);

    const firstRun = runProtectedPriceCheck(createEnv(), { trigger: 'scheduled' });
    await vi.waitFor(() => {
      expect(testHooks.runPriceCheckMock).toHaveBeenCalledTimes(1);
    });

    const duplicateRun = await runProtectedPriceCheck(createEnv(), { trigger: 'scheduled' });
    expect(duplicateRun).toEqual({
      kind: 'skipped',
      reason: 'price-check-already-running',
    });

    resolveRun?.({
      startedAt: '2026-03-18T00:00:00.000Z',
      finishedAt: '2026-03-18T00:10:00.000Z',
      scanned: 1,
      succeeded: 1,
      skipped: 0,
      failed: 0,
      updated: 1,
      drops: 0,
      emailsSent: 0,
      errors: [],
    });

    const firstResult = await firstRun;
    expect(firstResult.kind).toBe('completed');
    expect(testHooks.runPriceCheckMock).toHaveBeenCalledTimes(1);
  });
});
