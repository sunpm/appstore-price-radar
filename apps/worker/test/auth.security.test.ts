import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authRateLimits, loginCodes, passwordResetTokens, users } from '../src/db/schema';
import type { EnvConfig } from '../src/env';
import { hashPassword } from '../src/lib/auth';
import {
  loginWithPassword,
  requestPasswordReset,
  sendLoginCode,
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

type PasswordResetTokenRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
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
  passwordResetTokens: PasswordResetTokenRow[];
  authRateLimits: AuthRateLimitRow[];
  nextLoginCodeId: number;
  nextPasswordResetTokenId: number;
  nextRateLimitId: number;
};

const testHooks = vi.hoisted(() => ({
  dbRef: { current: null as unknown },
  sendLoginCodeEmailMock: vi.fn(async () => ({ sent: true })),
  sendPasswordResetEmailMock: vi.fn(async () => ({ sent: true })),
}));

vi.mock('../src/db/client', () => ({
  getDb: () => testHooks.dbRef.current,
}));

vi.mock('../src/lib/auth-emails', () => ({
  sendLoginCodeEmail: testHooks.sendLoginCodeEmailMock,
  sendPasswordResetEmail: testHooks.sendPasswordResetEmailMock,
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
      const buildRows = (): Array<Record<string, unknown>> => {
        if (table === users) {
          return state.users;
        }

        if (table === loginCodes) {
          return state.loginCodes;
        }

        if (table === authRateLimits) {
          return state.authRateLimits;
        }

        if (table === passwordResetTokens) {
          return state.passwordResetTokens;
        }

        return [];
      };

      const rows = buildRows();

      return {
        where: () => ({
          limit: async (limitValue: number) => {
            return rows
              .slice(0, limitValue)
              .map(row => mapSelection(selection, row));
          },
          orderBy: () => ({
            limit: async (limitValue: number) => {
              const sorted = [...rows].sort((a, b) => {
                const aTime = (a.createdAt as Date | undefined)?.getTime() ?? 0;
                const bTime = (b.createdAt as Date | undefined)?.getTime() ?? 0;
                return bTime - aTime;
              });

              return sorted
                .slice(0, limitValue)
                .map(row => mapSelection(selection, row));
            },
          }),
        }),
      };
    },
  }),
  insert: (table: unknown) => ({
    values: (raw: Record<string, unknown> | Record<string, unknown>[]) => {
      const rows = Array.isArray(raw) ? raw : [raw];
      const inserted: Array<Record<string, unknown>> = [];

      if (table === loginCodes) {
        for (const row of rows) {
          const created: LoginCodeRow = {
            id: `login-code-${state.nextLoginCodeId}`,
            userId: String(row.userId),
            codeHash: String(row.codeHash),
            expiresAt: row.expiresAt as Date,
            usedAt: null,
            createdAt: new Date(),
          };
          state.nextLoginCodeId += 1;
          state.loginCodes.push(created);
          inserted.push(created);
        }
      } else if (table === passwordResetTokens) {
        for (const row of rows) {
          const created: PasswordResetTokenRow = {
            id: `reset-token-${state.nextPasswordResetTokenId}`,
            userId: String(row.userId),
            tokenHash: String(row.tokenHash),
            expiresAt: row.expiresAt as Date,
            usedAt: null,
            createdAt: new Date(),
          };
          state.nextPasswordResetTokenId += 1;
          state.passwordResetTokens.push(created);
          inserted.push(created);
        }
      } else if (table === authRateLimits) {
        for (const row of rows) {
          const created: AuthRateLimitRow = {
            id: `rate-limit-${state.nextRateLimitId}`,
            scope: String(row.scope),
            subjectKey: String(row.subjectKey),
            attemptCount: Number(row.attemptCount),
            windowStartedAt: row.windowStartedAt as Date,
            blockedUntil: (row.blockedUntil as Date | null) ?? null,
            updatedAt: row.updatedAt as Date,
          };
          state.nextRateLimitId += 1;
          state.authRateLimits = [created];
          inserted.push(created);
        }
      }

      const insertResult = {
        onConflictDoNothing: () => insertResult,
        returning: async (returningSelection?: Record<string, unknown>) => {
          return inserted.map(row => mapSelection(returningSelection, row));
        },
      };

      return insertResult;
    },
  }),
  update: (table: unknown) => ({
    set: (patch: Record<string, unknown>) => ({
      where: () => {
        let updated: Array<Record<string, unknown>> = [];

        if (table === loginCodes) {
          updated = state.loginCodes
            .filter(row => row.usedAt === null)
            .map((row) => {
              Object.assign(row, patch);
              return row;
            });
        } else if (table === passwordResetTokens) {
          updated = state.passwordResetTokens
            .filter(row => row.usedAt === null)
            .map((row) => {
              Object.assign(row, patch);
              return row;
            });
        } else if (table === authRateLimits) {
          const row = state.authRateLimits[0];
          if (row) {
            Object.assign(row, patch);
            updated = [row];
          }
        } else if (table === users) {
          const row = state.users[0];
          if (row) {
            Object.assign(row, patch);
            updated = [row];
          }
        }

        return {
          returning: async (returningSelection?: Record<string, unknown>) => {
            return updated.map(row => mapSelection(returningSelection, row));
          },
        };
      },
    }),
  }),
  delete: (table: unknown) => ({
    where: () => {
      if (table === authRateLimits) {
        state.authRateLimits = [];
      } else if (table === loginCodes) {
        state.loginCodes.pop();
      }
    },
  }),
});

const createConfig = (): EnvConfig => ({
  DATABASE_URL: 'postgres://test',
  RESEND_API_KEY: 'resend-api-key',
  RESEND_FROM_EMAIL: 'noreply@example.com',
  SESSION_TTL_DAYS: 30,
  RESET_PASSWORD_TTL_MINUTES: 30,
  LOGIN_CODE_TTL_MINUTES: 10,
  LOGIN_CODE_RESEND_COOLDOWN_SECONDS: 0,
  AUTH_RATE_LIMIT_WINDOW_MINUTES: 15,
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: 5,
  AUTH_RATE_LIMIT_BLOCK_MINUTES: 15,
  PRICE_CHECK_MAX_CALLS_PER_MINUTE: 12,
  PRICE_CHECK_RETRY_BASE_SECONDS: 15,
  PRICE_CHECK_RETRY_MAX_SECONDS: 90,
  PRICE_CHECK_RETRY_JITTER_SECONDS: 5,
  PRICE_CHECK_MAX_RETRIES: 2,
  PRICE_CHECK_LOCK_TTL_SECONDS: 900,
});

describe('auth security guardrails', () => {
  let dbState: DbState;
  let config: EnvConfig;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T00:00:00.000Z'));

    testHooks.sendLoginCodeEmailMock.mockClear();
    testHooks.sendPasswordResetEmailMock.mockClear();

    const passwordHash = await hashPassword('Correct-Password-123');
    dbState = {
      users: [{
        id: '00000000-0000-4000-8000-000000000001',
        email: 'security@example.com',
        passwordHash,
        isActive: true,
        updatedAt: new Date(),
      }],
      loginCodes: [],
      passwordResetTokens: [],
      authRateLimits: [],
      nextLoginCodeId: 1,
      nextPasswordResetTokenId: 1,
      nextRateLimitId: 1,
    };

    config = createConfig();
    testHooks.dbRef.current = createDbMock(dbState);
  });

  it('blocks password login after repeated invalid credentials', async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await loginWithPassword(config, {
        email: 'security@example.com',
        password: 'wrong-password',
      });

      expect(response.status).toBe(401);
    }

    const blocked = await loginWithPassword(config, {
      email: 'security@example.com',
      password: 'wrong-password',
    });

    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({
      retryAfterSeconds: expect.any(Number),
    });
    expect(dbState.authRateLimits[0]).toMatchObject({
      scope: 'login-password',
      subjectKey: 'security@example.com',
      attemptCount: 5,
    });
  });

  it('revokes older login codes when issuing a new code', async () => {
    const first = await sendLoginCode(config, { email: 'security@example.com' });
    const second = await sendLoginCode(config, { email: 'security@example.com' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const activeCodes = dbState.loginCodes.filter(code => code.usedAt === null);
    expect(dbState.loginCodes).toHaveLength(2);
    expect(activeCodes).toHaveLength(1);
    expect(dbState.loginCodes[0].usedAt).not.toBeNull();
    expect(activeCodes[0]?.id).toBe(dbState.loginCodes[1]?.id);
  });

  it('revokes older password reset tokens when issuing a new token', async () => {
    const first = await requestPasswordReset(config, { email: 'security@example.com' });
    const second = await requestPasswordReset(config, { email: 'security@example.com' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const activeTokens = dbState.passwordResetTokens.filter(token => token.usedAt === null);
    expect(dbState.passwordResetTokens).toHaveLength(2);
    expect(activeTokens).toHaveLength(1);
    expect(dbState.passwordResetTokens[0].usedAt).not.toBeNull();
    expect(activeTokens[0]?.id).toBe(dbState.passwordResetTokens[1]?.id);
  });

  it('blocks repeated invalid code verification attempts', async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await verifyLoginCode(config, {
        email: 'security@example.com',
        code: '000000',
      });

      expect(response.status).toBe(401);
    }

    const blocked = await verifyLoginCode(config, {
      email: 'security@example.com',
      code: '000000',
    });

    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({
      retryAfterSeconds: expect.any(Number),
    });
    expect(dbState.authRateLimits[0]).toMatchObject({
      scope: 'verify-login-code',
      subjectKey: 'security@example.com',
      attemptCount: 5,
    });
  });
});
