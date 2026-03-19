import { desc, eq, sql } from 'drizzle-orm';

import { PUBLIC_DROPS_DEFAULT_LIMIT } from '../constants/routes';
import { getDb } from '../db/client';
import { appDropEvents, subscriptions } from '../db/schema';
import type { EnvConfig } from '../env';
import type {
  GetPublicDropsPayload,
  PublicDropItem,
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

const publicDropSelection = {
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
  submissionCount: sql<number>`(
    select count(*)::int
    from ${subscriptions}
    where ${subscriptions.appId} = ${appDropEvents.appId}
      and ${subscriptions.country} = ${appDropEvents.country}
      and ${subscriptions.isActive} = true
  )`.as('submissionCount'),
};

export const buildPublicDropsQuery = (
  db: ReturnType<typeof getDb>,
  payload: GetPublicDropsPayload,
) => {
  const countryCode = payload.country?.toUpperCase();
  const finalLimit = payload.limit ?? PUBLIC_DROPS_DEFAULT_LIMIT;
  const useDedupe = payload.dedupe ?? true;
  const where = countryCode ? eq(appDropEvents.country, countryCode) : undefined;

  if (!useDedupe) {
    return db
      .select(publicDropSelection)
      .from(appDropEvents)
      .where(where)
      .orderBy(desc(appDropEvents.detectedAt), desc(appDropEvents.id))
      .limit(finalLimit);
  }

  const latestDrops = db
    .selectDistinctOn(
      [appDropEvents.appId, appDropEvents.country],
      publicDropSelection,
    )
    .from(appDropEvents)
    .where(where)
    .orderBy(
      appDropEvents.appId,
      appDropEvents.country,
      desc(appDropEvents.detectedAt),
      desc(appDropEvents.id),
    )
    .as('latest_public_drops');

  return db
    .select()
    .from(latestDrops)
    .orderBy(desc(latestDrops.detectedAt), desc(latestDrops.id))
    .limit(finalLimit);
};

export const getPublicDrops = async (
  config: EnvConfig,
  payload: GetPublicDropsPayload,
): Promise<PublicServiceResponse<PublicDropsResponse>> => {
  const db = getDb(config);
  const items = await buildPublicDropsQuery(db, payload) as PublicDropItem[];

  return buildServiceResponse(200, { items });
};
