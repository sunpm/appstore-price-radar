import { and, asc, desc, eq } from 'drizzle-orm';

import {
  PRICE_HISTORY_DEFAULT_LIMIT,
  PRICE_HISTORY_MAX_LIMIT,
} from '../constants/routes';
import type { EnvConfig } from '../env';
import { getDb } from '../db/client';
import {
  appPriceChangeEvents,
  appPriceHistory,
  appSnapshots,
} from '../db/schema';
import { extractAppId } from '../lib/appstore';
import type {
  GetPriceHistoryPayload,
  PriceHistoryErrorResponse,
  PriceHistorySuccessResponse,
  PricesHttpStatus,
  PricesServiceResponse,
} from './prices.types';

type PriceHistoryBody = PriceHistorySuccessResponse | PriceHistoryErrorResponse;
type PriceHistoryEvent = PriceHistorySuccessResponse['history'][number];

const LEGACY_HISTORY_FETCH_MULTIPLIER = 8;

const getErrorMessages = (error: unknown): string[] => {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);

    if ('message' in current && typeof current.message === 'string') {
      messages.push(current.message.toLowerCase());
    }

    current = 'cause' in current ? current.cause : undefined;
  }

  if (messages.length === 0 && error instanceof Error) {
    messages.push(error.message.toLowerCase());
  }

  return messages;
};

const isMissingRequestIdColumnError = (error: unknown): boolean => {
  return getErrorMessages(error).some(
    message => message.includes('does not exist') && message.includes('request_id'),
  );
};

const isMissingChangeEventsTableError = (error: unknown): boolean => {
  return getErrorMessages(error).some(
    message =>
      message.includes('does not exist') && message.includes('app_price_change_events'),
  );
};

const loadChangeEventHistory = async (
  db: ReturnType<typeof getDb>,
  appId: string,
  countryCode: string,
  limit: number,
): Promise<PriceHistoryEvent[]> => {
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
    .limit(limit);

  return historyRaw.slice().reverse();
};

const loadChangeEventHistoryWithoutRequestId = async (
  db: ReturnType<typeof getDb>,
  appId: string,
  countryCode: string,
  limit: number,
): Promise<PriceHistoryEvent[]> => {
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
    })
    .from(appPriceChangeEvents)
    .where(
      and(
        eq(appPriceChangeEvents.appId, appId),
        eq(appPriceChangeEvents.country, countryCode),
      ),
    )
    .orderBy(desc(appPriceChangeEvents.changedAt))
    .limit(limit);

  return historyRaw.slice().reverse().map(item => ({
    ...item,
    requestId: `legacy-change-event:${item.id}`,
  }));
};

const loadLegacySnapshotHistory = async (
  db: ReturnType<typeof getDb>,
  appId: string,
  countryCode: string,
  limit: number,
): Promise<PriceHistoryEvent[]> => {
  // Legacy app_price_history stores every fetch, so inspect a wider window to
  // reconstruct enough actual change events for detail pages.
  const fetchLimit = Math.min(
    Math.max(limit * LEGACY_HISTORY_FETCH_MULTIPLIER, limit + 1),
    PRICE_HISTORY_MAX_LIMIT * LEGACY_HISTORY_FETCH_MULTIPLIER,
  );

  const historyRows = await db
    .select({
      id: appPriceHistory.id,
      appId: appPriceHistory.appId,
      country: appPriceHistory.country,
      currency: appPriceHistory.currency,
      price: appPriceHistory.price,
      fetchedAt: appPriceHistory.fetchedAt,
    })
    .from(appPriceHistory)
    .where(and(eq(appPriceHistory.appId, appId), eq(appPriceHistory.country, countryCode)))
    .orderBy(asc(appPriceHistory.fetchedAt), asc(appPriceHistory.id))
    .limit(fetchLimit);

  const changeEvents: PriceHistoryEvent[] = [];

  for (let index = 1; index < historyRows.length; index += 1) {
    const previous = historyRows[index - 1];
    const current = historyRows[index];

    if (!previous || !current || previous.price === current.price) {
      continue;
    }

    changeEvents.push({
      id: current.id,
      appId: current.appId,
      country: current.country,
      currency: current.currency,
      oldAmount: previous.price,
      newAmount: current.price,
      changedAt: current.fetchedAt,
      source: 'legacy',
      requestId: `legacy-price-history:${current.id}`,
    });
  }

  return changeEvents.slice(-limit);
};

const loadPriceHistory = async (
  db: ReturnType<typeof getDb>,
  appId: string,
  countryCode: string,
  limit: number,
): Promise<PriceHistoryEvent[]> => {
  try {
    return await loadChangeEventHistory(db, appId, countryCode, limit);
  } catch (error) {
    if (isMissingRequestIdColumnError(error)) {
      return loadChangeEventHistoryWithoutRequestId(db, appId, countryCode, limit);
    }

    if (isMissingChangeEventsTableError(error)) {
      return loadLegacySnapshotHistory(db, appId, countryCode, limit);
    }

    throw error;
  }
};

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
  const historyLimit = payload.limit ?? PRICE_HISTORY_DEFAULT_LIMIT;

  const [snapshot] = await db
    .select()
    .from(appSnapshots)
    .where(and(eq(appSnapshots.appId, appId), eq(appSnapshots.country, countryCode)))
    .limit(1);

  const history = await loadPriceHistory(db, appId, countryCode, historyLimit);

  return buildServiceResponse(200, {
    snapshot: snapshot ?? null,
    history,
  });
};
