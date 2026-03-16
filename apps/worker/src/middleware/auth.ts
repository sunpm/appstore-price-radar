import { and, eq, gt } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';

import type { AppEnv } from '../types';
import { getDb } from '../db/client';
import { userSessions, users } from '../db/schema';
import { hashSessionToken, parseBearerToken } from '../lib/auth';

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = parseBearerToken(c.req.header('authorization'));

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const tokenHash = await hashSessionToken(token);
  const db = getDb(c.get('config'));
  const now = new Date();

  const [session] = await db
    .select({
      sessionId: userSessions.id,
      userId: users.id,
      email: users.email,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(
      and(
        eq(userSessions.tokenHash, tokenHash),
        gt(userSessions.expiresAt, now),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await db
    .update(userSessions)
    .set({
      lastUsedAt: now,
    })
    .where(eq(userSessions.id, session.sessionId));

  c.set('authUser', {
    id: session.userId,
    email: session.email,
  });
  c.set('sessionId', session.sessionId);

  await next();
});
