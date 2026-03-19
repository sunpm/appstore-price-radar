import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_COUNTRY_CODE } from '../src/constants/routes';

const testHooks = vi.hoisted(() => ({
  parseEnvMock: vi.fn(() => ({
    DATABASE_URL: 'postgres://test',
    CORS_ORIGIN: 'http://localhost:5173',
    MANUAL_PRICE_CHECKS_ENABLED: false,
  })),
  createUserSubscriptionMock: vi.fn(),
  listUserSubscriptionsMock: vi.fn(),
  deleteUserSubscriptionMock: vi.fn(),
}));

vi.mock('../src/env', () => ({
  parseEnv: testHooks.parseEnvMock,
}));

vi.mock('../src/middleware/auth', async () => {
  const { createMiddleware } = await import('hono/factory');

  return {
    requireAuth: createMiddleware(async (c, next) => {
      if (c.req.header('authorization') !== 'Bearer test-session') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      c.set('authUser', {
        id: 'user-1',
        email: 'radar@example.com',
      });
      c.set('sessionId', 'session-1');

      await next();
    }),
  };
});

vi.mock('../src/services/subscriptions', async () => {
  const actual = await vi.importActual<typeof import('../src/services/subscriptions')>(
    '../src/services/subscriptions',
  );

  return {
    ...actual,
    createUserSubscription: testHooks.createUserSubscriptionMock,
    listUserSubscriptions: testHooks.listUserSubscriptionsMock,
    deleteUserSubscription: testHooks.deleteUserSubscriptionMock,
  };
});

import { app } from '../src/index';

const createSubscriptionDto = () => ({
  id: '6b0da7ee-6fd2-4c9b-a936-c7ad7134a431',
  appId: '123456789',
  country: 'US',
  targetPrice: 6.66,
  lastNotifiedPrice: null,
  isActive: true,
  appName: 'Radar Pro',
  storeUrl: 'https://apps.apple.com/us/app/id123456789',
  iconUrl: 'https://example.com/icon.png',
  currentPrice: 9.99,
  currency: 'USD',
  createdAt: '2026-03-19T12:00:00.000Z',
  updatedAt: '2026-03-19T12:05:00.000Z',
});

describe('/api/subscriptions routes', () => {
  beforeEach(() => {
    testHooks.parseEnvMock.mockClear();
    testHooks.createUserSubscriptionMock.mockReset();
    testHooks.listUserSubscriptionsMock.mockReset();
    testHooks.deleteUserSubscriptionMock.mockReset();
    testHooks.createUserSubscriptionMock.mockResolvedValue({
      status: 200,
      body: {
        subscription: createSubscriptionDto(),
      },
    });
    testHooks.listUserSubscriptionsMock.mockResolvedValue({
      status: 200,
      body: {
        items: [createSubscriptionDto()],
      },
    });
    testHooks.deleteUserSubscriptionMock.mockResolvedValue({
      status: 200,
      body: {
        ok: true,
        id: '6b0da7ee-6fd2-4c9b-a936-c7ad7134a431',
      },
    });
  });

  it('returns 401 Unauthorized for /api/subscriptions without auth context', async () => {
    const response = await app.request('https://example.com/api/subscriptions');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(testHooks.listUserSubscriptionsMock).not.toHaveBeenCalled();
  });

  it('returns list JSON shape for GET /api/subscriptions', async () => {
    const response = await app.request('https://example.com/api/subscriptions', {
      headers: {
        authorization: 'Bearer test-session',
      },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(testHooks.listUserSubscriptionsMock).toHaveBeenCalledWith(
      expect.any(Object),
      'user-1',
    );
    expect(payload).toStrictEqual({
      items: [createSubscriptionDto()],
    });
  });

  it('returns create JSON shape and default country for POST /api/subscriptions', async () => {
    const response = await app.request('https://example.com/api/subscriptions', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-session',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        appId: '123456789',
        targetPrice: 6.66,
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(testHooks.createUserSubscriptionMock).toHaveBeenCalledWith(
      expect.any(Object),
      {
        id: 'user-1',
        email: 'radar@example.com',
      },
      {
        appId: '123456789',
        country: DEFAULT_COUNTRY_CODE,
        targetPrice: 6.66,
      },
    );
    expect(payload).toStrictEqual({
      subscription: createSubscriptionDto(),
    });
  });

  it('returns delete JSON shape for DELETE /api/subscriptions/:id', async () => {
    const id = '6b0da7ee-6fd2-4c9b-a936-c7ad7134a431';
    const response = await app.request(`https://example.com/api/subscriptions/${id}`, {
      method: 'DELETE',
      headers: {
        authorization: 'Bearer test-session',
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ ok: true, id });
    expect(testHooks.deleteUserSubscriptionMock).toHaveBeenCalledWith(
      expect.any(Object),
      'user-1',
      { id },
    );
  });

  it('returns not-found delete behavior when subscription is already removed', async () => {
    const id = '6b0da7ee-6fd2-4c9b-a936-c7ad7134a431';
    testHooks.deleteUserSubscriptionMock.mockResolvedValueOnce({
      status: 404,
      body: {
        error: 'Subscription not found',
      },
    });

    const response = await app.request(`https://example.com/api/subscriptions/${id}`, {
      method: 'DELETE',
      headers: {
        authorization: 'Bearer test-session',
      },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toStrictEqual({
      error: 'Subscription not found',
    });
  });
});
