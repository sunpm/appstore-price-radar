import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../types';
import { getDb } from '../db/client';
import { appSnapshots, subscriptions } from '../db/schema';
import { refreshSingleApp } from '../lib/checker';
import { extractAppId } from '../lib/appstore';
import { requireAuth } from '../middleware/auth';

const createSubscriptionSchema = z.object({
  appId: z.string().trim().min(1),
  country: z.string().trim().length(2).optional().default('US'),
  targetPrice: z
    .preprocess((value) => {
      if (value === '' || value === undefined || value === null) {
        return null;
      }

      if (typeof value === 'string') {
        return Number(value);
      }

      return value;
    }, z.number().positive().nullable())
    .optional(),
});

const deleteParamsSchema = z.object({
  id: z.string().uuid(),
});

const router = new Hono<AppEnv>();
router.use('*', requireAuth);

router.post('/', zValidator('json', createSubscriptionSchema), async (c) => {
  const body = c.req.valid('json');
  const authUser = c.get('authUser');
  const config = c.get('config');
  const db = getDb(config);

  const appId = extractAppId(body.appId);

  if (!appId) {
    return c.json(
      {
        error: 'Invalid appId. Please provide numeric app id or App Store URL',
      },
      400,
    );
  }

  const country = body.country.toUpperCase();
  const now = new Date();

  const [subscription] = await db
    .insert(subscriptions)
    .values({
      email: authUser.email,
      userId: authUser.id,
      appId,
      country,
      targetPrice: body.targetPrice ?? null,
      isActive: true,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [subscriptions.userId, subscriptions.appId, subscriptions.country],
      set: {
        email: authUser.email,
        targetPrice: body.targetPrice ?? null,
        isActive: true,
        updatedAt: now,
      },
    })
    .returning();

  let latest = null;

  try {
    latest = await refreshSingleApp(config, appId, country, {
      notifyDrops: false,
    });
  } catch (error) {
    console.error('refreshSingleApp failed after subscription created', error);
  }

  return c.json({
    subscription,
    latest,
  });
});

router.get('/', async (c) => {
  const authUser = c.get('authUser');
  const config = c.get('config');
  const db = getDb(config);

  const items = await db
    .select({
      id: subscriptions.id,
      appId: subscriptions.appId,
      country: subscriptions.country,
      targetPrice: subscriptions.targetPrice,
      lastNotifiedPrice: subscriptions.lastNotifiedPrice,
      isActive: subscriptions.isActive,
      createdAt: subscriptions.createdAt,
      updatedAt: subscriptions.updatedAt,
      appName: appSnapshots.appName,
      storeUrl: appSnapshots.storeUrl,
      iconUrl: appSnapshots.iconUrl,
      currentPrice: appSnapshots.lastPrice,
      currency: appSnapshots.currency,
    })
    .from(subscriptions)
    .leftJoin(
      appSnapshots,
      and(
        eq(subscriptions.appId, appSnapshots.appId),
        eq(subscriptions.country, appSnapshots.country),
      ),
    )
    .where(and(eq(subscriptions.userId, authUser.id), eq(subscriptions.isActive, true)))
    .orderBy(desc(subscriptions.createdAt));

  return c.json({
    items,
  });
});

router.delete(
  '/:id',
  zValidator('param', deleteParamsSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const authUser = c.get('authUser');
    const config = c.get('config');
    const db = getDb(config);

    const [removed] = await db
      .update(subscriptions)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, authUser.id)))
      .returning({ id: subscriptions.id });

    if (!removed) {
      return c.json({ error: 'Subscription not found' }, 404);
    }

    return c.json({ ok: true, id: removed.id });
  },
);

export default router;
