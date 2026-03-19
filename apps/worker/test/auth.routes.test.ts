import { beforeEach, describe, expect, it, vi } from 'vitest';

const testHooks = vi.hoisted(() => ({
  parseEnvMock: vi.fn(() => ({
    DATABASE_URL: 'postgres://test',
    CORS_ORIGIN: 'http://localhost:5173',
    MANUAL_PRICE_CHECKS_ENABLED: false,
  })),
  loginWithPasswordMock: vi.fn(),
  revokeSessionMock: vi.fn(),
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

vi.mock('../src/services/auth', async () => {
  const actual = await vi.importActual<typeof import('../src/services/auth')>(
    '../src/services/auth',
  );

  return {
    ...actual,
    loginWithPassword: testHooks.loginWithPasswordMock,
    revokeSession: testHooks.revokeSessionMock,
  };
});

import { app } from '../src/index';

describe('/api/auth routes', () => {
  beforeEach(() => {
    testHooks.parseEnvMock.mockClear();
    testHooks.loginWithPasswordMock.mockReset();
    testHooks.revokeSessionMock.mockReset();
    testHooks.revokeSessionMock.mockResolvedValue({
      status: 200,
      body: { ok: true },
    });
  });

  it('returns 401 Unauthorized for /api/auth/me without auth context', async () => {
    const response = await app.request('https://example.com/api/auth/me');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('rejects invalid payload for /api/auth/login before hitting the service', async () => {
    const response = await app.request('https://example.com/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'invalid-email',
        password: '123',
      }),
    });

    expect(response.status).toBe(400);
    expect(testHooks.loginWithPasswordMock).not.toHaveBeenCalled();
  });

  it('returns AuthMeResponseDto shape for /api/auth/me with auth context', async () => {
    const response = await app.request('https://example.com/api/auth/me', {
      headers: {
        authorization: 'Bearer test-session',
      },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toStrictEqual({
      user: {
        id: 'user-1',
        email: 'radar@example.com',
      },
    });
    expect(Object.keys(payload.user)).toStrictEqual(['id', 'email']);
  });

  it('returns logout response shape for /api/auth/logout', async () => {
    const response = await app.request('https://example.com/api/auth/logout', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-session',
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ ok: true });
    expect(testHooks.revokeSessionMock).toHaveBeenCalledWith(
      expect.any(Object),
      'session-1',
    );
  });
});
