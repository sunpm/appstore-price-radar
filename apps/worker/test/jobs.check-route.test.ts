import { beforeEach, describe, expect, it, vi } from 'vitest';

import worker from '../src/index';
import type { CheckReport } from '../src/lib/checker.types';
import type { WorkerBindings } from '../src/types';

const testHooks = vi.hoisted(() => ({
  runProtectedPriceCheckMock: vi.fn(),
}));

vi.mock('../src/services/jobs', () => ({
  runProtectedPriceCheck: testHooks.runProtectedPriceCheckMock,
}));

const createBindings = (overrides: Partial<WorkerBindings> = {}): WorkerBindings => ({
  DATABASE_URL: 'postgres://test',
  CRON_SECRET: 'cron-secret-123',
  MANUAL_PRICE_CHECKS_ENABLED: 'false',
  APP_BASE_URL: 'https://app.example.com',
  CORS_ORIGIN: 'https://app.example.com',
  SESSION_TTL_DAYS: '30',
  RESET_PASSWORD_TTL_MINUTES: '30',
  LOGIN_CODE_TTL_MINUTES: '10',
  LOGIN_CODE_RESEND_COOLDOWN_SECONDS: '60',
  ...overrides,
});

const createExecutionContext = (): ExecutionContext =>
  ({
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  }) as unknown as ExecutionContext;

const createReport = (): CheckReport => ({
  startedAt: '2026-03-18T00:00:00.000Z',
  finishedAt: '2026-03-18T00:05:00.000Z',
  scanned: 1,
  succeeded: 1,
  skipped: 0,
  failed: 0,
  updated: 1,
  drops: 0,
  emailsSent: 0,
  errors: [],
});

describe('POST /api/jobs/check route guard', () => {
  beforeEach(() => {
    testHooks.runProtectedPriceCheckMock.mockReset();
  });

  it('returns 404 when manual price checks are disabled', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/jobs/check', {
        method: 'POST',
      }),
      createBindings({ MANUAL_PRICE_CHECKS_ENABLED: 'false' }),
      createExecutionContext(),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not Found' });
    expect(testHooks.runProtectedPriceCheckMock).not.toHaveBeenCalled();
  });

  it('returns 503 when manual checks are enabled without CRON_SECRET', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/jobs/check', {
        method: 'POST',
      }),
      createBindings({
        MANUAL_PRICE_CHECKS_ENABLED: 'true',
        CRON_SECRET: undefined,
      }),
      createExecutionContext(),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'CRON_SECRET is required when manual price checks are enabled',
    });
    expect(testHooks.runProtectedPriceCheckMock).not.toHaveBeenCalled();
  });

  it('returns 401 when x-cron-secret is invalid', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/jobs/check', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'wrong-secret',
        },
      }),
      createBindings({ MANUAL_PRICE_CHECKS_ENABLED: 'true' }),
      createExecutionContext(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(testHooks.runProtectedPriceCheckMock).not.toHaveBeenCalled();
  });

  it('returns report when manual route is enabled with a valid secret', async () => {
    const report = createReport();
    testHooks.runProtectedPriceCheckMock.mockResolvedValueOnce({
      kind: 'completed',
      runId: 'run-1',
      report,
    });

    const response = await worker.fetch(
      new Request('https://example.com/api/jobs/check', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'cron-secret-123',
        },
      }),
      createBindings({ MANUAL_PRICE_CHECKS_ENABLED: 'true' }),
      createExecutionContext(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(report);
    expect(testHooks.runProtectedPriceCheckMock).toHaveBeenCalledTimes(1);
    expect(testHooks.runProtectedPriceCheckMock).toHaveBeenCalledWith(
      expect.objectContaining({
        MANUAL_PRICE_CHECKS_ENABLED: true,
        CRON_SECRET: 'cron-secret-123',
      }),
      { trigger: 'manual' },
    );
  });

  it('returns 202 when duplicate run is skipped', async () => {
    testHooks.runProtectedPriceCheckMock.mockResolvedValueOnce({
      kind: 'skipped',
      reason: 'price-check-already-running',
    });

    const response = await worker.fetch(
      new Request('https://example.com/api/jobs/check', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'cron-secret-123',
        },
      }),
      createBindings({ MANUAL_PRICE_CHECKS_ENABLED: 'true' }),
      createExecutionContext(),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      kind: 'skipped',
      reason: 'price-check-already-running',
    });
  });
});
