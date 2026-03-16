import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../types';
import { getDb } from '../db/client';
import { appDropEvents, subscriptions } from '../db/schema';

const querySchema = z.object({
  country: z.string().trim().length(2).optional(),
  dedupe: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') {
        return true;
      }

      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === '1' || normalized === 'true' || normalized === 'yes';
      }

      if (typeof value === 'boolean') {
        return value;
      }

      return true;
    }, z.boolean())
    .optional(),
  limit: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') {
        return 50;
      }

      if (typeof value === 'string') {
        return Number(value);
      }

      return value;
    }, z.number().int().min(1).max(200))
    .optional(),
});

const router = new Hono<AppEnv>();

router.get('/drops', zValidator('query', querySchema), async (c) => {
  const { country, limit, dedupe } = c.req.valid('query');
  const countryCode = country?.toUpperCase();
  const db = getDb(c.get('config'));
  const finalLimit = limit ?? 50;
  const useDedupe = dedupe ?? true;
  const fetchLimit = useDedupe ? Math.min(finalLimit * 12, 2000) : finalLimit;

  const where = countryCode ? eq(appDropEvents.country, countryCode) : undefined;

  const eventsRaw = await db
    .select({
      id: appDropEvents.id,
      appId: appDropEvents.appId,
      country: appDropEvents.country,
      appName: appDropEvents.appName,
      storeUrl: appDropEvents.storeUrl,
      iconUrl: appDropEvents.iconUrl,
      currency: appDropEvents.currency,
      oldPrice: appDropEvents.oldPrice,
      newPrice: appDropEvents.newPrice,
      dropPercent: appDropEvents.dropPercent,
      detectedAt: appDropEvents.detectedAt,
    })
    .from(appDropEvents)
    .where(where)
    .orderBy(desc(appDropEvents.detectedAt))
    .limit(fetchLimit);

  const events = useDedupe
    ? (() => {
        const seen = new Set<string>();
        const unique: typeof eventsRaw = [];

        for (const item of eventsRaw) {
          const key = `${item.appId}:${item.country}`;

          if (seen.has(key)) {
            continue;
          }

          seen.add(key);
          unique.push(item);

          if (unique.length >= finalLimit) {
            break;
          }
        }

        return unique;
      })()
    : eventsRaw.slice(0, finalLimit);

  const pairs = Array.from(new Set(events.map((item) => `${item.appId}:${item.country}`))).map(
    (item) => {
      const [appId, pairCountry] = item.split(':');
      return { appId, country: pairCountry };
    },
  );

  let countRows: Array<{ appId: string; country: string; submissionCount: number }> = [];

  if (pairs.length > 0) {
    const pairFilters = pairs.map((pair) =>
      and(eq(subscriptions.appId, pair.appId), eq(subscriptions.country, pair.country)),
    );

    const pairCondition =
      pairFilters.length === 1 ? pairFilters[0] : or(...pairFilters);

    if (pairCondition) {
      countRows = await db
        .select({
          appId: subscriptions.appId,
          country: subscriptions.country,
          submissionCount: sql<number>`count(*)::int`,
        })
        .from(subscriptions)
        .where(and(eq(subscriptions.isActive, true), pairCondition))
        .groupBy(subscriptions.appId, subscriptions.country);
    }
  }

  const countMap = new Map(
    countRows.map((row) => [`${row.appId}:${row.country}`, row.submissionCount]),
  );

  const items = events.map((item) => ({
    ...item,
    submissionCount: countMap.get(`${item.appId}:${item.country}`) ?? 0,
  }));

  return c.json({
    items,
  });
});

export default router;
