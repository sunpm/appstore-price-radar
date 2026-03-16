import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../types';
import { getDb } from '../db/client';
import { appPriceHistory, appSnapshots } from '../db/schema';
import { extractAppId } from '../lib/appstore';

const paramsSchema = z.object({
  appId: z.string().trim().min(1),
});

const querySchema = z.object({
  country: z.string().trim().length(2).optional().default('US'),
  limit: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') {
        return 30;
      }

      if (typeof value === 'string') {
        return Number(value);
      }

      return value;
    }, z.number().int().min(1).max(3650))
    .optional(),
});

const router = new Hono<AppEnv>();

router.get(
  '/:appId',
  zValidator('param', paramsSchema),
  zValidator('query', querySchema),
  async (c) => {
    const { appId: rawAppId } = c.req.valid('param');
    const { country, limit } = c.req.valid('query');

    const appId = extractAppId(rawAppId);

    if (!appId) {
      return c.json({ error: 'Invalid appId' }, 400);
    }

    const countryCode = country.toUpperCase();
    const config = c.get('config');
    const db = getDb(config);

    const [snapshot] = await db
      .select()
      .from(appSnapshots)
      .where(
        and(eq(appSnapshots.appId, appId), eq(appSnapshots.country, countryCode)),
      )
      .limit(1);

    const historyRaw = await db
      .select({
        id: appPriceHistory.id,
        appId: appPriceHistory.appId,
        country: appPriceHistory.country,
        price: appPriceHistory.price,
        currency: appPriceHistory.currency,
        fetchedAt: appPriceHistory.fetchedAt,
      })
      .from(appPriceHistory)
      .where(
        and(
          eq(appPriceHistory.appId, appId),
          eq(appPriceHistory.country, countryCode),
        ),
      )
      .orderBy(desc(appPriceHistory.fetchedAt))
      .limit(limit ?? 30);

    const history = historyRaw.slice().reverse();

    return c.json({
      snapshot: snapshot ?? null,
      history,
    });
  },
);

export default router;
