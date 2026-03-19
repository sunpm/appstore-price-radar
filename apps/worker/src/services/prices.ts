import { and, asc, desc, eq } from 'drizzle-orm';

import {
  PRICE_HISTORY_PAGE_SIZE_DEFAULT,
  PRICE_HISTORY_PAGE_SIZE_MAX,
} from '../constants/routes';
import type { EnvConfig } from '../env';
import { getDb } from '../db/client';
import {
  appPriceChangeEvents,
  appPriceHistory,
  appSnapshots,
} from '../db/schema';
import { extractAppId, fetchAppStorePrice } from '../lib/appstore';
import type {
  AppSnapshotRecord,
  GetPriceHistoryPayload,
  HistorySummaryDto,
  MetadataDto,
  PriceChangeEventRecord,
  PriceEventDto,
  PriceHistoryErrorResponse,
  PriceHistorySuccessResponse,
  PricesHttpStatus,
  PricesServiceResponse,
  SnapshotDto,
} from './prices.types';

type PriceHistoryBody = PriceHistorySuccessResponse | PriceHistoryErrorResponse;
type PriceHistoryEvent = PriceChangeEventRecord;

const LEGACY_HISTORY_FETCH_MULTIPLIER = 8;
const PRICE_HISTORY_FETCH_CAP = PRICE_HISTORY_PAGE_SIZE_MAX * 40;
const WINDOW_TO_DAYS = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
  all: null,
} as const;

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

  return historyRaw;
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

  return historyRaw.map(item => ({
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
    PRICE_HISTORY_FETCH_CAP * LEGACY_HISTORY_FETCH_MULTIPLIER,
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

  return changeEvents
    .slice()
    .sort((a, b) => {
      const timeDelta = b.changedAt.getTime() - a.changedAt.getTime();

      if (timeDelta !== 0) {
        return timeDelta;
      }

      return b.id - a.id;
    })
    .slice(0, limit);
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

const getWindowStart = (
  window: GetPriceHistoryPayload['window'],
  now: Date,
): Date | null => {
  const days = WINDOW_TO_DAYS[window];

  if (days === null) {
    return null;
  }

  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - days);
  return start;
};

const parseCursor = (
  cursor: string | undefined,
): { changedAt: Date; id: number } | null => {
  if (!cursor) {
    return null;
  }

  const [changedAtText, idText] = cursor.split('__');
  const changedAt = changedAtText ? new Date(changedAtText) : null;
  const id = idText ? Number(idText) : NaN;

  if (!changedAt || Number.isNaN(changedAt.getTime()) || !Number.isInteger(id) || id <= 0) {
    return null;
  }

  return { changedAt, id };
};

const buildCursor = (event: PriceHistoryEvent): string => {
  return `${event.changedAt.toISOString()}__${event.id}`;
};

const isWithinWindow = (event: PriceHistoryEvent, windowStart: Date | null): boolean => {
  if (!windowStart) {
    return true;
  }

  return event.changedAt.getTime() >= windowStart.getTime();
};

const isAfterCursor = (
  event: PriceHistoryEvent,
  cursor: { changedAt: Date; id: number } | null,
): boolean => {
  if (!cursor) {
    return true;
  }

  const eventTime = event.changedAt.getTime();
  const cursorTime = cursor.changedAt.getTime();

  if (eventTime < cursorTime) {
    return true;
  }

  if (eventTime > cursorTime) {
    return false;
  }

  return event.id < cursor.id;
};

const sortEventsDescending = (events: PriceHistoryEvent[]): PriceHistoryEvent[] => {
  return events
    .slice()
    .sort((left, right) => {
      const timeDelta = right.changedAt.getTime() - left.changedAt.getTime();

      if (timeDelta !== 0) {
        return timeDelta;
      }

      return right.id - left.id;
    });
};

const toPriceHistorySummaryDto = (
  history: PriceHistoryEvent[],
): HistorySummaryDto => {
  const sorted = sortEventsDescending(history);
  const latest = sorted[0] ?? null;
  const earliest = sorted.at(-1) ?? null;

  return {
    totalChanges: sorted.length,
    latestChangeAt: latest ? latest.changedAt.toISOString() : null,
    earliestChangeAt: earliest ? earliest.changedAt.toISOString() : null,
  };
};

export const toAppSnapshotDto = (snapshot: AppSnapshotRecord): SnapshotDto => {
  return {
    appId: snapshot.appId,
    country: snapshot.country,
    appName: snapshot.appName,
    storeUrl: snapshot.storeUrl,
    iconUrl: snapshot.iconUrl,
    currency: snapshot.currency,
    lastPrice: snapshot.lastPrice,
    updatedAt: snapshot.updatedAt.toISOString(),
  };
};

export const toAppDecisionMetadataDto = (
  snapshot: AppSnapshotRecord,
): MetadataDto => {
  return {
    sellerName: snapshot.sellerName ?? null,
    primaryGenreName: snapshot.primaryGenreName ?? null,
    genres: snapshot.primaryGenreName ? [snapshot.primaryGenreName] : [],
    description: snapshot.description ?? null,
    averageUserRating: snapshot.averageUserRating ?? null,
    averageUserRatingForCurrentVersion: null,
    userRatingCount: snapshot.userRatingCount ?? null,
    userRatingCountForCurrentVersion: null,
    bundleId: snapshot.bundleId ?? null,
    version: snapshot.version ?? null,
    minimumOsVersion: snapshot.minimumOsVersion ?? null,
    releaseNotes: snapshot.releaseNotes ?? null,
    fileSizeBytes: null,
    contentAdvisoryRating: null,
    trackContentRating: null,
    releaseDate: null,
    currentVersionReleaseDate: null,
    sellerUrl: null,
    artistViewUrl: null,
    supportedDevices: [],
    languageCodesISO2A: [],
    advisories: [],
    features: [],
    screenshotUrls: [],
    ipadScreenshotUrls: [],
  };
};

const mergeMetadata = (
  base: MetadataDto | null,
  override: MetadataDto | null,
): MetadataDto | null => {
  if (!base) {
    return override;
  }

  if (!override) {
    return base;
  }

  return {
    sellerName: override.sellerName ?? base.sellerName,
    primaryGenreName: override.primaryGenreName ?? base.primaryGenreName,
    genres: override.genres.length > 0 ? override.genres : base.genres,
    description: override.description ?? base.description,
    averageUserRating: override.averageUserRating ?? base.averageUserRating,
    averageUserRatingForCurrentVersion:
      override.averageUserRatingForCurrentVersion ?? base.averageUserRatingForCurrentVersion,
    userRatingCount: override.userRatingCount ?? base.userRatingCount,
    userRatingCountForCurrentVersion:
      override.userRatingCountForCurrentVersion ?? base.userRatingCountForCurrentVersion,
    bundleId: override.bundleId ?? base.bundleId,
    version: override.version ?? base.version,
    minimumOsVersion: override.minimumOsVersion ?? base.minimumOsVersion,
    releaseNotes: override.releaseNotes ?? base.releaseNotes,
    fileSizeBytes: override.fileSizeBytes ?? base.fileSizeBytes,
    contentAdvisoryRating: override.contentAdvisoryRating ?? base.contentAdvisoryRating,
    trackContentRating: override.trackContentRating ?? base.trackContentRating,
    releaseDate: override.releaseDate ?? base.releaseDate,
    currentVersionReleaseDate:
      override.currentVersionReleaseDate ?? base.currentVersionReleaseDate,
    sellerUrl: override.sellerUrl ?? base.sellerUrl,
    artistViewUrl: override.artistViewUrl ?? base.artistViewUrl,
    supportedDevices:
      override.supportedDevices.length > 0 ? override.supportedDevices : base.supportedDevices,
    languageCodesISO2A:
      override.languageCodesISO2A.length > 0
        ? override.languageCodesISO2A
        : base.languageCodesISO2A,
    advisories: override.advisories.length > 0 ? override.advisories : base.advisories,
    features: override.features.length > 0 ? override.features : base.features,
    screenshotUrls:
      override.screenshotUrls.length > 0 ? override.screenshotUrls : base.screenshotUrls,
    ipadScreenshotUrls:
      override.ipadScreenshotUrls.length > 0
        ? override.ipadScreenshotUrls
        : base.ipadScreenshotUrls,
  };
};

const getLiveMetadata = async (
  appId: string,
  countryCode: string,
): Promise<MetadataDto | null> => {
  try {
    const liveLookup = await fetchAppStorePrice(appId, countryCode);

    if (!liveLookup) {
      return null;
    }

    return {
      sellerName: liveLookup.sellerName ?? null,
      primaryGenreName: liveLookup.primaryGenreName ?? null,
      genres: liveLookup.genres,
      description: liveLookup.description ?? null,
      averageUserRating: liveLookup.averageUserRating ?? null,
      averageUserRatingForCurrentVersion:
        liveLookup.averageUserRatingForCurrentVersion ?? null,
      userRatingCount: liveLookup.userRatingCount ?? null,
      userRatingCountForCurrentVersion:
        liveLookup.userRatingCountForCurrentVersion ?? null,
      bundleId: liveLookup.bundleId ?? null,
      version: liveLookup.version ?? null,
      minimumOsVersion: liveLookup.minimumOsVersion ?? null,
      releaseNotes: liveLookup.releaseNotes ?? null,
      fileSizeBytes: liveLookup.fileSizeBytes ?? null,
      contentAdvisoryRating: liveLookup.contentAdvisoryRating ?? null,
      trackContentRating: liveLookup.trackContentRating ?? null,
      releaseDate: liveLookup.releaseDate ?? null,
      currentVersionReleaseDate: liveLookup.currentVersionReleaseDate ?? null,
      sellerUrl: liveLookup.sellerUrl ?? null,
      artistViewUrl: liveLookup.artistViewUrl ?? null,
      supportedDevices: liveLookup.supportedDevices,
      languageCodesISO2A: liveLookup.languageCodesISO2A,
      advisories: liveLookup.advisories,
      features: liveLookup.features,
      screenshotUrls: liveLookup.screenshotUrls,
      ipadScreenshotUrls: liveLookup.ipadScreenshotUrls,
    };
  }
  catch (error) {
    console.warn('failed to enrich app metadata from App Store lookup', {
      appId,
      countryCode,
      error,
    });
    return null;
  }
};

export const toPriceChangeEventDto = (
  event: PriceChangeEventRecord,
): PriceEventDto => {
  return {
    id: event.id,
    appId: event.appId,
    country: event.country,
    currency: event.currency,
    oldAmount: event.oldAmount,
    newAmount: event.newAmount,
    changedAt: event.changedAt.toISOString(),
    source: event.source,
    requestId: event.requestId,
  };
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
  const cursor = parseCursor(payload.cursor);

  if (payload.cursor && !cursor) {
    return buildServiceResponse(400, { error: 'Invalid cursor' });
  }

  const db = getDb(config);
  const pageSize = Math.min(
    Math.max(payload.pageSize ?? PRICE_HISTORY_PAGE_SIZE_DEFAULT, 1),
    PRICE_HISTORY_PAGE_SIZE_MAX,
  );
  const fetchLimit = Math.max(PRICE_HISTORY_FETCH_CAP, pageSize + 1);
  const windowStart = getWindowStart(payload.window, new Date());

  const [snapshot] = await db
    .select()
    .from(appSnapshots)
    .where(and(eq(appSnapshots.appId, appId), eq(appSnapshots.country, countryCode)))
    .limit(1);

  const historyRecords = await loadPriceHistory(db, appId, countryCode, fetchLimit);
  const windowedHistory = sortEventsDescending(historyRecords).filter(event => {
    return isWithinWindow(event, windowStart);
  });
  const pagedHistoryDesc = windowedHistory.filter(event => isAfterCursor(event, cursor));
  const pageItemsDesc = pagedHistoryDesc.slice(0, pageSize);
  const hasMore = pagedHistoryDesc.length > pageSize;
  const nextCursor = hasMore && pageItemsDesc.length > 0
    ? buildCursor(pageItemsDesc[pageItemsDesc.length - 1] as PriceHistoryEvent)
    : null;
  const history = pageItemsDesc
    .slice()
    .reverse()
    .map(toPriceChangeEventDto);
  const snapshotDto = snapshot ? toAppSnapshotDto(snapshot) : null;
  const metadataDto = mergeMetadata(
    snapshot ? toAppDecisionMetadataDto(snapshot) : null,
    await getLiveMetadata(appId, countryCode),
  );

  return buildServiceResponse(200, {
    snapshot: snapshotDto,
    history,
    page: {
      window: payload.window,
      pageSize,
      nextCursor,
      hasMore,
    },
    summary: toPriceHistorySummaryDto(windowedHistory),
    metadata: metadataDto,
  });
};
