import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

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

const authSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

const emailSchema = z.object({
  email: z.string().trim().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(32).max(256),
  password: z.string().min(8).max(128),
});

const verifyCodeSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{6}$/),
});

const router = new Hono<AppEnv>();

const createSession = async (
  c: Pick<AppEnv['Variables'], 'config'>,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> => {
  const db = getDb(c.config);
  const token = generateSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = buildSessionExpiry(c.config.SESSION_TTL_DAYS ?? 30);

  await db.insert(userSessions).values({
    userId,
    tokenHash,
    expiresAt,
    lastUsedAt: new Date(),
  });

  return { token, expiresAt };
};

const findActiveUserByEmail = async (config: AppEnv['Variables']['config'], email: string) => {
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

const generateOtpCode = (): string => {
  const bucket = new Uint32Array(1);
  crypto.getRandomValues(bucket);
  const code = bucket[0] % 1_000_000;
  return String(code).padStart(6, '0');
};

router.post('/register', zValidator('json', authSchema), async (c) => {
  const payload = c.req.valid('json');
  const config = c.get('config');
  const db = getDb(config);
  const email = normalizeEmail(payload.email);

  const [exists] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (exists) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const now = new Date();
  const passwordHash = await hashPassword(payload.password);

  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      isActive: true,
      updatedAt: now,
    })
    .returning({
      id: users.id,
      email: users.email,
    });

  const session = await createSession({ config }, user.id);

  return c.json({
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    user,
  });
});

router.post('/login', zValidator('json', authSchema), async (c) => {
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

  return c.json({
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
    },
  });
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
  const ttlMinutes = config.RESET_PASSWORD_TTL_MINUTES ?? 30;
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
  const user = await findActiveUserByEmail(config, email);

  if (!user) {
    return c.json({ ok: true });
  }

  const code = generateOtpCode();
  const codeHash = await hashSessionToken(`${user.id}:${code}`);
  const ttlMinutes = config.LOGIN_CODE_TTL_MINUTES ?? 10;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  const db = getDb(config);

  await db.insert(loginCodes).values({
    userId: user.id,
    codeHash,
    expiresAt,
  });

  const result = await sendLoginCodeEmail(config, user.email, code, ttlMinutes);

  if (!result.sent) {
    console.error('sendLoginCodeEmail failed', result.reason);
    return c.json({ error: 'Failed to send login code email' }, 503);
  }

  return c.json({ ok: true });
});

router.post('/verify-login-code', zValidator('json', verifyCodeSchema), async (c) => {
  const payload = c.req.valid('json');
  const config = c.get('config');
  const db = getDb(config);
  const email = normalizeEmail(payload.email);
  const user = await findActiveUserByEmail(config, email);

  if (!user) {
    return c.json({ error: 'Invalid code' }, 401);
  }

  const codeHash = await hashSessionToken(`${user.id}:${payload.code}`);
  const now = new Date();

  const [match] = await db
    .select({
      id: loginCodes.id,
    })
    .from(loginCodes)
    .where(
      and(
        eq(loginCodes.userId, user.id),
        eq(loginCodes.codeHash, codeHash),
        isNull(loginCodes.usedAt),
        gt(loginCodes.expiresAt, now),
      ),
    )
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);

  if (!match) {
    return c.json({ error: 'Invalid code' }, 401);
  }

  await db
    .update(loginCodes)
    .set({
      usedAt: now,
    })
    .where(eq(loginCodes.id, match.id));

  const session = await createSession({ config }, user.id);

  return c.json({
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
    },
  });
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
