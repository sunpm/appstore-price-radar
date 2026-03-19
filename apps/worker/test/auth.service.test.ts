import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authRateLimits, loginCodes, userSessions, users } from '../src/db/schema';
import type { EnvConfig } from '../src/env';
import { hashPassword, hashSessionToken } from '../src/lib/auth';
import {
  loginWithPassword,
  revokeSession,
  verifyLoginCode,
} from '../src/services/auth';

type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  updatedAt: Date;
};

type LoginCodeRow = {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

type SessionRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt: Date;
};

type AuthRateLimitRow = {
  id: string;
  scope: string;
  subjectKey: string;
  attemptCount: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
  updatedAt: Date;
};

type DbState = {
  users: UserRow[];
  loginCodes: LoginCodeRow[];
  userSessions: SessionRow[];
  authRateLimits: AuthRateLimitRow[];
  nextSessionId: number;
  nextRateLimitId: number;
};

const testHooks = vi.hoisted(() => ({
  dbRef: { current: null as unknown },
}));

vi.mock('../src/db/client', () => ({
  getDb: () => testHooks.dbRef.current,
}));

const mapSelection = (
  selection: Record<string, unknown> | undefined,
  row: Record<string, unknown>,
): Record<string, unknown> => {
  if (!selection) {
    return row;
  }

  return Object.fromEntries(
    Object.keys(selection).map(key => [key, row[key]]),
  );
};

const createDbMock = (state: DbState) => ({
  select: (selection?: Record<string, unknown>) => ({
    from: (table: unknown) => {
      const rows = table === users
        ? state.users
        : table === loginCodes
          ? state.loginCodes
          : table === authRateLimits
            ? state.authRateLimits
            : [];

      return {
        where: () => ({
          limit: async (limitValue: number) =>
            rows.slice(0, limitValue).map(row => mapSelection(selection, row)),
          orderBy: () => ({
            limit: async (limitValue: number) => {
              const sorted = [...rows].sort((a, b) => {
                const aTime = (a.createdAt as Date | undefined)?.getTime() ?? 0;
                const bTime = (b.createdAt as Date | undefined)?.getTime() ?? 0;
                return bTime - aTime;
              });

              const filtered = table === loginCodes
                ? sorted.filter(
                    row =>
                      row.usedAt === null
                      && ((row.expiresAt as Date | undefined)?.getTime() ?? 0) > Date.now(),
                  )
                : sorted;

              return filtered
                .slice(0, limitValue)
                .map(row => mapSelection(selection, row));
            },
          }),
        }),
      };
    },
  }),
  insert: (table: unknown) => ({
    values: (raw: Record<string, unknown>) => {
      if (table === userSessions) {
        const created: SessionRow = {
          id: `session-${state.nextSessionId}`,
          userId: String(raw.userId),
          tokenHash: String(raw.tokenHash),
          expiresAt: raw.expiresAt as Date,
          lastUsedAt: raw.lastUsedAt as Date,
        };
        state.nextSessionId += 1;
        state.userSessions.push(created);
        return;
      }

      if (table === authRateLimits) {
        state.authRateLimits = [{
          id: `rate-limit-${state.nextRateLimitId}`,
          scope: String(raw.scope),
          subjectKey: String(raw.subjectKey),
          attemptCount: Number(raw.attemptCount),
          windowStartedAt: raw.windowStartedAt as Date,
          blockedUntil: (raw.blockedUntil as Date | null) ?? null,
          updatedAt: raw.updatedAt as Date,
        }];
        state.nextRateLimitId += 1;
      }
    },
  }),
  update: (table: unknown) => ({
    set: (patch: Record<string, unknown>) => ({
      where: () => {
        if (table === loginCodes) {
          const row = state.loginCodes.find(
            item => item.usedAt === null && item.expiresAt.getTime() > Date.now(),
          );
          if (!row) {
            return {
              returning: async () => [],
            };
          }

          Object.assign(row, patch);
          return {
            returning: async (returningSelection?: Record<string, unknown>) => [
              mapSelection(returningSelection, row),
            ],
          };
        }

        if (table === authRateLimits) {
          const row = state.authRateLimits[0];
          if (row) {
            Object.assign(row, patch);
          }
        }

        if (table === users) {
          const row = state.users[0];
          if (row) {
            Object.assign(row, patch);
          }
        }

        return {
          returning: async () => [],
        };
      },
    }),
  }),
  delete: (table: unknown) => ({
    where: () => {
      if (table === authRateLimits) {
        state.authRateLimits = [];
        return;
      }

      if (table === userSessions) {
        state.userSessions.shift();
      }
    },
  }),
});

const createConfig = (): EnvConfig => ({
  DATABASE_URL: 'postgres://test',
  SESSION_TTL_DAYS: 30,
  RESET_PASSWORD_TTL_MINUTES: 30,
  LOGIN_CODE_TTL_MINUTES: 10,
  LOGIN_CODE_RESEND_COOLDOWN_SECONDS: 0,
  AUTH_RATE_LIMIT_WINDOW_MINUTES: 15,
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: 5,
  AUTH_RATE_LIMIT_BLOCK_MINUTES: 15,
});

describe('auth service regressions', () => {
  let dbState: DbState;
  let config: EnvConfig;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-19T00:00:00.000Z'));

    const passwordHash = await hashPassword('Correct-Password-123');
    const reusableCode = '654321';
    const codeHash = await hashSessionToken(`user-1:${reusableCode}`);

    dbState = {
      users: [{
        id: 'user-1',
        email: 'radar@example.com',
        passwordHash,
        isActive: true,
        updatedAt: new Date(),
      }],
      loginCodes: [{
        id: 'login-code-1',
        userId: 'user-1',
        codeHash,
        expiresAt: new Date('2026-03-19T00:10:00.000Z'),
        usedAt: null,
        createdAt: new Date('2026-03-19T00:00:00.000Z'),
      }],
      userSessions: [{
        id: 'session-current',
        userId: 'user-1',
        tokenHash: 'existing-token-hash',
        expiresAt: new Date('2026-03-20T00:00:00.000Z'),
        lastUsedAt: new Date('2026-03-19T00:00:00.000Z'),
      }],
      authRateLimits: [],
      nextSessionId: 1,
      nextRateLimitId: 1,
    };

    config = createConfig();
    testHooks.dbRef.current = createDbMock(dbState);
  });

  it('returns invalid credentials when loginWithPassword receives a wrong password', async () => {
    const response = await loginWithPassword(config, {
      email: 'radar@example.com',
      password: 'wrong-password',
    });

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({ error: 'Invalid credentials' });
    expect(dbState.authRateLimits[0]).toMatchObject({
      scope: 'login-password',
      subjectKey: 'radar@example.com',
      attemptCount: 1,
    });
  });

  it('rejects verifyLoginCode when the same login code is reused after consumption', async () => {
    const first = await verifyLoginCode(config, {
      email: 'radar@example.com',
      code: '654321',
    });
    const second = await verifyLoginCode(config, {
      email: 'radar@example.com',
      code: '654321',
    });

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      user: {
        id: 'user-1',
        email: 'radar@example.com',
      },
      token: expect.any(String),
      expiresAt: expect.any(String),
    });
    expect(dbState.loginCodes[0]?.usedAt).not.toBeNull();

    expect(second.status).toBe(401);
    expect(second.body).toStrictEqual({ error: 'Invalid code' });
  });

  it('revokeSession removes the current session from storage', async () => {
    const response = await revokeSession(config, 'session-current');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ ok: true });
    expect(dbState.userSessions).toStrictEqual([]);
  });
});
