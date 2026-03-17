import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { DEFAULT_COUNTRY_CODE, PRICE_HISTORY_DEFAULT_LIMIT, PRICE_HISTORY_MAX_LIMIT } from '../constants/routes';
import type { AppEnv } from '../types';
import { getDb } from '../db/client';
import { appPriceHistory, appSnapshots } from '../db/schema';
import { extractAppId } from '../lib/appstore';
import { createOptionalIntWithDefault } from '../lib/zod';

const paramsSchema = z.object({
  appId: z.string().trim().min(1),
});

const querySchema = z.object({
  country: z.string().trim().length(2).optional().default(DEFAULT_COUNTRY_CODE),
  limit: createOptionalIntWithDefault({
    defaultValue: PRICE_HISTORY_DEFAULT_LIMIT,
    min: 1,
    max: PRICE_HISTORY_MAX_LIMIT,
  }),
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
      .limit(limit ?? PRICE_HISTORY_DEFAULT_LIMIT);

    const history = historyRaw.slice().reverse();

    return c.json({
      snapshot: snapshot ?? null,
      history,
    });
  },
);

export default router;
