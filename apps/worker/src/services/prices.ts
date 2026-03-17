import { and, desc, eq } from 'drizzle-orm';

import { PRICE_HISTORY_DEFAULT_LIMIT } from '../constants/routes';
import type { EnvConfig } from '../env';
import { getDb } from '../db/client';
import { appPriceHistory, appSnapshots } from '../db/schema';
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
    .limit(payload.limit ?? PRICE_HISTORY_DEFAULT_LIMIT);

  return buildServiceResponse(200, {
    snapshot: snapshot ?? null,
    history: historyRaw.slice().reverse(),
  });
};
