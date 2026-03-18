import { and, eq } from 'drizzle-orm';

import {
  DEFAULT_AUTH_RATE_LIMIT_BLOCK_MINUTES,
  DEFAULT_AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  DEFAULT_AUTH_RATE_LIMIT_WINDOW_MINUTES,
} from '../constants/env';
import { getDb } from '../db/client';
import { authRateLimits } from '../db/schema';
import type { EnvConfig } from '../env';

const RATE_LIMIT_SCOPES = [
  'login-password',
  'send-login-code',
  'verify-login-code',
  'forgot-password',
  'reset-password',
] as const;

export type AuthRateLimitScope = typeof RATE_LIMIT_SCOPES[number];

export type AuthRateLimitInput = {
  scope: AuthRateLimitScope;
  subjectKey: string;
};

export type AuthRateLimitAssertion = {
  limited: boolean;
  retryAfterSeconds: number;
};

const toRetryAfterSeconds = (blockedUntil: Date, now: Date): number => {
  return Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000));
};

const getRateLimitConfig = (config: EnvConfig): {
  windowMs: number;
  blockMs: number;
  maxAttempts: number;
} => {
  const windowMinutes = config.AUTH_RATE_LIMIT_WINDOW_MINUTES
    ?? DEFAULT_AUTH_RATE_LIMIT_WINDOW_MINUTES;
  const blockMinutes = config.AUTH_RATE_LIMIT_BLOCK_MINUTES
    ?? DEFAULT_AUTH_RATE_LIMIT_BLOCK_MINUTES;
  const maxAttempts = config.AUTH_RATE_LIMIT_MAX_ATTEMPTS
    ?? DEFAULT_AUTH_RATE_LIMIT_MAX_ATTEMPTS;

  return {
    windowMs: windowMinutes * 60_000,
    blockMs: blockMinutes * 60_000,
    maxAttempts,
  };
};

const findRateLimitRow = async (config: EnvConfig, input: AuthRateLimitInput) => {
  const db = getDb(config);
  const [row] = await db
    .select({
      id: authRateLimits.id,
      attemptCount: authRateLimits.attemptCount,
      windowStartedAt: authRateLimits.windowStartedAt,
      blockedUntil: authRateLimits.blockedUntil,
    })
    .from(authRateLimits)
    .where(
      and(
        eq(authRateLimits.scope, input.scope),
        eq(authRateLimits.subjectKey, input.subjectKey),
      ),
    )
    .limit(1);

  return row ?? null;
};

export const assertAuthRateLimit = async (
  config: EnvConfig,
  input: AuthRateLimitInput,
): Promise<AuthRateLimitAssertion> => {
  const row = await findRateLimitRow(config, input);

  if (!row) {
    return {
      limited: false,
      retryAfterSeconds: 0,
    };
  }

  const db = getDb(config);
  const now = new Date();
  const { windowMs } = getRateLimitConfig(config);
  const blockedUntil = row.blockedUntil;

  if (blockedUntil && blockedUntil > now) {
    return {
      limited: true,
      retryAfterSeconds: toRetryAfterSeconds(blockedUntil, now),
    };
  }

  const windowExpired = now.getTime() - row.windowStartedAt.getTime() >= windowMs;
  const blockExpired = Boolean(blockedUntil && blockedUntil <= now);

  if (windowExpired || blockExpired) {
    await db
      .update(authRateLimits)
      .set({
        attemptCount: 0,
        windowStartedAt: now,
        blockedUntil: null,
        updatedAt: now,
      })
      .where(eq(authRateLimits.id, row.id));
  }

  return {
    limited: false,
    retryAfterSeconds: 0,
  };
};

export const recordAuthRateLimitFailure = async (
  config: EnvConfig,
  input: AuthRateLimitInput,
): Promise<AuthRateLimitAssertion> => {
  const db = getDb(config);
  const now = new Date();
  const { windowMs, blockMs, maxAttempts } = getRateLimitConfig(config);
  const row = await findRateLimitRow(config, input);

  if (!row) {
    const blockedUntil = maxAttempts <= 1 ? new Date(now.getTime() + blockMs) : null;

    await db.insert(authRateLimits).values({
      scope: input.scope,
      subjectKey: input.subjectKey,
      attemptCount: 1,
      windowStartedAt: now,
      blockedUntil,
      updatedAt: now,
    });

    if (!blockedUntil) {
      return { limited: false, retryAfterSeconds: 0 };
    }

    return {
      limited: true,
      retryAfterSeconds: toRetryAfterSeconds(blockedUntil, now),
    };
  }

  const shouldResetWindow = now.getTime() - row.windowStartedAt.getTime() >= windowMs;
  const nextAttemptCount = shouldResetWindow ? 1 : row.attemptCount + 1;
  const nextWindowStartedAt = shouldResetWindow ? now : row.windowStartedAt;
  const blockedUntil = nextAttemptCount >= maxAttempts
    ? new Date(now.getTime() + blockMs)
    : null;

  await db
    .update(authRateLimits)
    .set({
      attemptCount: nextAttemptCount,
      windowStartedAt: nextWindowStartedAt,
      blockedUntil,
      updatedAt: now,
    })
    .where(eq(authRateLimits.id, row.id));

  if (!blockedUntil) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  return {
    limited: true,
    retryAfterSeconds: toRetryAfterSeconds(blockedUntil, now),
  };
};

export const clearAuthRateLimit = async (
  config: EnvConfig,
  input: AuthRateLimitInput,
): Promise<void> => {
  const db = getDb(config);

  await db
    .delete(authRateLimits)
    .where(
      and(
        eq(authRateLimits.scope, input.scope),
        eq(authRateLimits.subjectKey, input.subjectKey),
      ),
    );
};
