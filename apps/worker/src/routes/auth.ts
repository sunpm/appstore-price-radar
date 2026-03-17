import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  OTP_CODE_LENGTH,
  OTP_CODE_MODULO,
  OTP_CODE_PATTERN,
  OTP_ONLY_PASSWORD_PREFIX,
} from '../constants/auth';
import {
  DEFAULT_LOGIN_CODE_RESEND_COOLDOWN_SECONDS,
  DEFAULT_LOGIN_CODE_TTL_MINUTES,
  DEFAULT_RESET_PASSWORD_TTL_MINUTES,
  DEFAULT_SESSION_TTL_DAYS,
} from '../constants/env';
import type { AppEnv } from '../types';
import { getDb } from '../db/client';
import { loginCodes, passwordResetTokens, userSessions, users } from '../db/schema';
import {
  buildSessionExpiry,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  verifyPassword,
} from '../lib/auth';
import { sendLoginCodeEmail, sendPasswordResetEmail } from '../lib/auth-emails';
import { requireAuth } from '../middleware/auth';
import type { AuthResponsePayload, AuthSession, AuthUserRow } from './auth/types';

const passwordAuthSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  code: z.string().trim().regex(OTP_CODE_PATTERN),
});

const emailSchema = z.object({
  email: z.string().trim().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(32).max(256),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});

const verifyCodeSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(OTP_CODE_PATTERN),
});

const buildOtpOnlyPasswordHash = (): string => {
  return `${OTP_ONLY_PASSWORD_PREFIX}$${generateSessionToken()}`;
};

const isOtpOnlyPasswordHash = (value: string): boolean => {
  return value.startsWith(`${OTP_ONLY_PASSWORD_PREFIX}$`);
};

const router = new Hono<AppEnv>();

const createSession = async (
  c: Pick<AppEnv['Variables'], 'config'>,
  userId: string,
): Promise<AuthSession> => {
  const db = getDb(c.config);
  const token = generateSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = buildSessionExpiry(c.config.SESSION_TTL_DAYS ?? DEFAULT_SESSION_TTL_DAYS);

  await db.insert(userSessions).values({
    userId,
    tokenHash,
    expiresAt,
    lastUsedAt: new Date(),
  });

  return { token, expiresAt };
};

const findActiveUserByEmail = async (
  config: AppEnv['Variables']['config'],
  email: string,
): Promise<AuthUserRow | null> => {
  const db = getDb(config);

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(and(eq(users.email, email), eq(users.isActive, true)))
    .limit(1);

  return user ?? null;
};

const ensureLoginCodeUserByEmail = async (
  config: AppEnv['Variables']['config'],
  email: string,
): Promise<AuthUserRow> => {
  const db = getDb(config);
  const now = new Date();

  const [existing] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    if (!existing.isActive) {
      await db
        .update(users)
        .set({
          isActive: true,
          updatedAt: now,
        })
        .where(eq(users.id, existing.id));

      return { ...existing, isActive: true };
    }

    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash: buildOtpOnlyPasswordHash(),
      isActive: true,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: users.email,
    })
    .returning({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    });

  if (created) {
    return created;
  }

  const [raced] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!raced) {
    throw new Error('Failed to create login-code user');
  }

  if (!raced.isActive) {
    await db
      .update(users)
      .set({
        isActive: true,
        updatedAt: now,
      })
      .where(eq(users.id, raced.id));

    return { ...raced, isActive: true };
  }

  return raced;
};

const consumeLoginCode = async (
  config: AppEnv['Variables']['config'],
  userId: string,
  code: string,
): Promise<boolean> => {
  const db = getDb(config);
  const codeHash = await hashSessionToken(`${userId}:${code}`);
  const now = new Date();

  const [match] = await db
    .select({
      id: loginCodes.id,
    })
    .from(loginCodes)
    .where(
      and(
        eq(loginCodes.userId, userId),
        eq(loginCodes.codeHash, codeHash),
        isNull(loginCodes.usedAt),
        gt(loginCodes.expiresAt, now),
      ),
    )
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);

  if (!match) {
    return false;
  }

  const [consumed] = await db
    .update(loginCodes)
    .set({
      usedAt: now,
    })
    .where(and(eq(loginCodes.id, match.id), isNull(loginCodes.usedAt)))
    .returning({
      id: loginCodes.id,
    });

  return Boolean(consumed);
};

const generateOtpCode = (): string => {
  const bucket = new Uint32Array(1);
  crypto.getRandomValues(bucket);
  const code = bucket[0] % OTP_CODE_MODULO;
  return String(code).padStart(OTP_CODE_LENGTH, '0');
};

const buildAuthResponse = (user: Pick<AuthUserRow, 'id' | 'email'>, session: AuthSession): AuthResponsePayload => {
  return {
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
    },
  };
};

router.post('/register', zValidator('json', registerSchema), async (c) => {
  const payload = c.req.valid('json');
  const config = c.get('config');
  const db = getDb(config);
  const email = normalizeEmail(payload.email);

  const [exists] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!exists) {
    return c.json({ error: 'Please request a login code first' }, 400);
  }

  if (!isOtpOnlyPasswordHash(exists.passwordHash)) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const codeMatched = await consumeLoginCode(config, exists.id, payload.code);

  if (!codeMatched) {
    return c.json({ error: 'Invalid code' }, 401);
  }

  const now = new Date();
  const passwordHash = await hashPassword(payload.password);

  await db
    .update(users)
    .set({
      passwordHash,
      isActive: true,
      updatedAt: now,
    })
    .where(eq(users.id, exists.id));

  const session = await createSession({ config }, exists.id);

  return c.json(buildAuthResponse(exists, session));
});

router.post('/login', zValidator('json', passwordAuthSchema), async (c) => {
  const payload = c.req.valid('json');
  const config = c.get('config');
  const email = normalizeEmail(payload.email);
  const user = await findActiveUserByEmail(config, email);

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const valid = await verifyPassword(payload.password, user.passwordHash);

  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const session = await createSession({ config }, user.id);

  return c.json(buildAuthResponse(user, session));
});

router.post('/forgot-password', zValidator('json', emailSchema), async (c) => {
  const payload = c.req.valid('json');
  const config = c.get('config');

  if (!config.RESEND_API_KEY || !config.RESEND_FROM_EMAIL) {
    return c.json({ error: 'Email service is not configured' }, 503);
  }

  const email = normalizeEmail(payload.email);
  const user = await findActiveUserByEmail(config, email);

  if (!user) {
    return c.json({ ok: true });
  }

  const resetToken = generateSessionToken();
  const tokenHash = await hashSessionToken(resetToken);
  const ttlMinutes = config.RESET_PASSWORD_TTL_MINUTES ?? DEFAULT_RESET_PASSWORD_TTL_MINUTES;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  const db = getDb(config);

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const result = await sendPasswordResetEmail(config, user.email, resetToken, ttlMinutes);

  if (!result.sent) {
    console.error('sendPasswordResetEmail failed', result.reason);
    return c.json({ error: 'Failed to send reset email' }, 503);
  }

  return c.json({ ok: true });
});

router.post('/reset-password', zValidator('json', resetPasswordSchema), async (c) => {
  const payload = c.req.valid('json');
  const config = c.get('config');
  const db = getDb(config);
  const tokenHash = await hashSessionToken(payload.token);
  const now = new Date();

  const [tokenRow] = await db
    .select({
      id: passwordResetTokens.id,
      userId: users.id,
    })
    .from(passwordResetTokens)
    .innerJoin(users, eq(passwordResetTokens.userId, users.id))
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  if (!tokenRow) {
    return c.json({ error: 'Invalid or expired reset token' }, 400);
  }

  const passwordHash = await hashPassword(payload.password);

  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: now,
    })
    .where(eq(users.id, tokenRow.userId));

  await db
    .update(passwordResetTokens)
    .set({
      usedAt: now,
    })
    .where(eq(passwordResetTokens.id, tokenRow.id));

  await db.delete(userSessions).where(eq(userSessions.userId, tokenRow.userId));

  return c.json({ ok: true });
});

router.post('/send-login-code', zValidator('json', emailSchema), async (c) => {
  const payload = c.req.valid('json');
  const config = c.get('config');

  if (!config.RESEND_API_KEY || !config.RESEND_FROM_EMAIL) {
    return c.json({ error: 'Email service is not configured' }, 503);
  }

  const email = normalizeEmail(payload.email);
  const loginCodeCooldownSeconds
    = config.LOGIN_CODE_RESEND_COOLDOWN_SECONDS ?? DEFAULT_LOGIN_CODE_RESEND_COOLDOWN_SECONDS;
  let user: Awaited<ReturnType<typeof ensureLoginCodeUserByEmail>>;

  try {
    user = await ensureLoginCodeUserByEmail(config, email);
  } catch (error) {
    console.error('ensureLoginCodeUserByEmail failed', error);
    return c.json({ error: 'Failed to prepare login code user' }, 500);
  }

  const db = getDb(config);
  const [latestCode] = await db
    .select({
      createdAt: loginCodes.createdAt,
    })
    .from(loginCodes)
    .where(eq(loginCodes.userId, user.id))
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);

  if (latestCode?.createdAt) {
    const elapsedSeconds = Math.floor((Date.now() - latestCode.createdAt.getTime()) / 1000);
    const retryAfterSeconds = loginCodeCooldownSeconds - elapsedSeconds;

    if (retryAfterSeconds > 0) {
      return c.json(
        {
          error: `Please wait ${retryAfterSeconds}s before requesting another code`,
          retryAfterSeconds,
        },
        429,
      );
    }
  }

  const code = generateOtpCode();
  const codeHash = await hashSessionToken(`${user.id}:${code}`);
  const ttlMinutes = config.LOGIN_CODE_TTL_MINUTES ?? DEFAULT_LOGIN_CODE_TTL_MINUTES;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  const [createdCode] = await db
    .insert(loginCodes)
    .values({
      userId: user.id,
      codeHash,
      expiresAt,
    })
    .returning({
      id: loginCodes.id,
    });

  const result = await sendLoginCodeEmail(config, user.email, code, ttlMinutes);

  if (!result.sent) {
    if (createdCode?.id) {
      try {
        await db.delete(loginCodes).where(eq(loginCodes.id, createdCode.id));
      } catch (cleanupError) {
        console.error('login code rollback failed', cleanupError);
      }
    }

    console.error('sendLoginCodeEmail failed', result.reason);
    return c.json({ error: 'Failed to send login code email' }, 503);
  }

  return c.json({ ok: true, cooldownSeconds: loginCodeCooldownSeconds });
});

router.post('/verify-login-code', zValidator('json', verifyCodeSchema), async (c) => {
  const payload = c.req.valid('json');
  const config = c.get('config');
  const email = normalizeEmail(payload.email);
  const user = await findActiveUserByEmail(config, email);

  if (!user) {
    return c.json({ error: 'Invalid code' }, 401);
  }

  const codeMatched = await consumeLoginCode(config, user.id, payload.code);

  if (!codeMatched) {
    return c.json({ error: 'Invalid code' }, 401);
  }

  const session = await createSession({ config }, user.id);

  return c.json(buildAuthResponse(user, session));
});

router.get('/me', requireAuth, async (c) => {
  return c.json({
    user: c.get('authUser'),
  });
});

router.post('/logout', requireAuth, async (c) => {
  const db = getDb(c.get('config'));
  const sessionId = c.get('sessionId');

  await db.delete(userSessions).where(eq(userSessions.id, sessionId));

  return c.json({ ok: true });
});

export default router;
