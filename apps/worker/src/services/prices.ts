import { and, desc, eq } from 'drizzle-orm';

import { PRICE_HISTORY_DEFAULT_LIMIT } from '../constants/routes';
import type { EnvConfig } from '../env';
import { getDb } from '../db/client';
import { appPriceChangeEvents, appSnapshots } from '../db/schema';
import { extractAppId } from '../lib/appstore';
import type {
  GetPriceHistoryPayload,
  PriceHistoryErrorResponse,
  PriceHistorySuccessResponse,
  PricesHttpStatus,
  PricesServiceResponse,
} from './prices.types';

type PriceHistoryBody = PriceHistorySuccessResponse | PriceHistoryErrorResponse;

const buildServiceResponse = <TBody>(
  status: PricesHttpStatus,
  body: TBody,
): PricesServiceResponse<TBody> => {
  return { status, body };
};

export const getPriceHistory = async (
  config: EnvConfig,
  payload: GetPriceHistoryPayload,
): Promise<PricesServiceResponse<PriceHistoryBody>> => {
  const appId = extractAppId(payload.appId);

  if (!appId) {
    return buildServiceResponse(400, { error: 'Invalid appId' });
  }

  const countryCode = payload.country.toUpperCase();
  const db = getDb(config);

  const [snapshot] = await db
    .select()
    .from(appSnapshots)
    .where(and(eq(appSnapshots.appId, appId), eq(appSnapshots.country, countryCode)))
    .limit(1);

  const historyRaw = await db
    .select({
      id: appPriceChangeEvents.id,
      appId: appPriceChangeEvents.appId,
      country: appPriceChangeEvents.country,
      currency: appPriceChangeEvents.currency,
      oldAmount: appPriceChangeEvents.oldAmount,
      newAmount: appPriceChangeEvents.newAmount,
      changedAt: appPriceChangeEvents.changedAt,
      source: appPriceChangeEvents.source,
      requestId: appPriceChangeEvents.requestId,
    })
    .from(appPriceChangeEvents)
    .where(
      and(
        eq(appPriceChangeEvents.appId, appId),
        eq(appPriceChangeEvents.country, countryCode),
      ),
    )
    .orderBy(desc(appPriceChangeEvents.changedAt))
    .limit(payload.limit ?? PRICE_HISTORY_DEFAULT_LIMIT);

  return buildServiceResponse(200, {
    snapshot: snapshot ?? null,
    history: historyRaw.slice().reverse(),
  });
};
