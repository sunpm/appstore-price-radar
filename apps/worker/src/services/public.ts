import { and, desc, eq, or, sql } from 'drizzle-orm';

import {
  PUBLIC_DROPS_DEFAULT_LIMIT,
  PUBLIC_DROPS_FETCH_MAX_LIMIT,
  PUBLIC_DROPS_FETCH_MULTIPLIER,
} from '../constants/routes';
import type { EnvConfig } from '../env';
import { getDb } from '../db/client';
import { appDropEvents, subscriptions } from '../db/schema';
import type {
  GetPublicDropsPayload,
  PublicDropsResponse,
  PublicHttpStatus,
  PublicServiceResponse,
} from './public.types';

const buildServiceResponse = <TBody>(
  status: PublicHttpStatus,
  body: TBody,
): PublicServiceResponse<TBody> => {
  return { status, body };
};

export const getPublicDrops = async (
  config: EnvConfig,
  payload: GetPublicDropsPayload,
): Promise<PublicServiceResponse<PublicDropsResponse>> => {
  const countryCode = payload.country?.toUpperCase();
  const db = getDb(config);
  const finalLimit = payload.limit ?? PUBLIC_DROPS_DEFAULT_LIMIT;
  const useDedupe = payload.dedupe ?? true;
  const fetchLimit = useDedupe
    ? Math.min(finalLimit * PUBLIC_DROPS_FETCH_MULTIPLIER, PUBLIC_DROPS_FETCH_MAX_LIMIT)
    : finalLimit;

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

    const pairCondition = pairFilters.length === 1 ? pairFilters[0] : or(...pairFilters);

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

  return buildServiceResponse(200, {
    items: events.map((item) => ({
      ...item,
      submissionCount: countMap.get(`${item.appId}:${item.country}`) ?? 0,
    })),
  });
};
