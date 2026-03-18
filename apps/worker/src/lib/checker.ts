import { and, eq, gt, gte, isNull, or } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';

import type { EnvConfig } from '../env';
import { getDb } from '../db/client';
import {
  appDropEvents,
  appPriceChangeEvents,
  appSnapshots,
  subscriptions,
  users,
} from '../db/schema';
import { LEGACY_PASSWORD_HASH_ITERATIONS } from './auth';
import { sendDropAlertEmail } from './alerts';
import { fetchAppStorePrice } from './appstore';
import { countLegacyPasswordHashUsers } from '../services/auth';
import type {
  CheckReport,
  RefreshExecutionContext,
  RefreshOptions,
  RefreshResult,
  RefreshSingleAppFn,
  RunPriceCheckOptions,
  SleepFn,
} from './checker.types';

export const buildRefreshOptions = ({
  trigger,
  requestId,
}: RefreshExecutionContext): RefreshOptions => {
  if (trigger === 'subscription-create') {
    return {
      notifyDrops: false,
      source: 'manual',
      requestId,
    };
  }

  return {
    notifyDrops: true,
    source: 'scheduled',
    requestId,
  };
};

export const refreshSingleApp = async (
  env: EnvConfig,
  appId: string,
  country: string,
  options: RefreshOptions = {},
): Promise<RefreshResult | null> => {
  const data = await fetchAppStorePrice(appId, country);

  if (!data) {
    return null;
  }

  if (data.kind === 'invalid-price') {
    console.warn('skipping invalid App Store price', {
      appId,
      country,
      reason: data.reason,
      formattedPrice: data.formattedPrice ?? null,
    });
    return null;
  }

  const notifyDrops = options.notifyDrops ?? true;
  const db = getDb(env);
  const now = new Date();

  const [previous] = await db
    .select({
      price: appSnapshots.lastPrice,
    })
    .from(appSnapshots)
    .where(
      and(
        eq(appSnapshots.appId, data.appId),
        eq(appSnapshots.country, data.country),
      ),
    )
    .limit(1);

  const oldPrice = previous?.price;
  const priceChanged = oldPrice !== undefined && oldPrice !== data.price;
  const priceDropped = oldPrice !== undefined && oldPrice > data.price;
  const source = options.source ?? (notifyDrops ? 'scheduled' : 'manual');
  const requestId =
    options.requestId ??
    `${source}:${data.appId}:${data.country}:${now.getTime()}`;
  const snapshotWrite = db
    .insert(appSnapshots)
    .values({
      appId: data.appId,
      country: data.country,
      appName: data.appName,
      storeUrl: data.storeUrl,
      iconUrl: data.iconUrl,
      sellerName: data.sellerName,
      primaryGenreName: data.primaryGenreName,
      description: data.description,
      averageUserRating: data.averageUserRating,
      userRatingCount: data.userRatingCount,
      bundleId: data.bundleId,
      version: data.version,
      minimumOsVersion: data.minimumOsVersion,
      releaseNotes: data.releaseNotes,
      currency: data.currency,
      lastPrice: data.price,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [appSnapshots.appId, appSnapshots.country],
      set: {
        appName: data.appName,
        storeUrl: data.storeUrl,
        iconUrl: data.iconUrl,
        sellerName: data.sellerName,
        primaryGenreName: data.primaryGenreName,
        description: data.description,
        averageUserRating: data.averageUserRating,
        userRatingCount: data.userRatingCount,
        bundleId: data.bundleId,
        version: data.version,
        minimumOsVersion: data.minimumOsVersion,
        releaseNotes: data.releaseNotes,
        currency: data.currency,
        lastPrice: data.price,
        updatedAt: now,
      },
    });
  const writes: [BatchItem<'pg'>, ...BatchItem<'pg'>[]] = [snapshotWrite];

  if (priceChanged && oldPrice !== undefined) {
    writes.push(
      db
        .insert(appPriceChangeEvents)
        .values({
          appId: data.appId,
          country: data.country,
          currency: data.currency,
          oldAmount: oldPrice,
          newAmount: data.price,
          changedAt: now,
          source,
          requestId,
        })
        .onConflictDoNothing({
          target: [
            appPriceChangeEvents.appId,
            appPriceChangeEvents.country,
            appPriceChangeEvents.requestId,
          ],
        }),
    );
  }

  if (priceDropped && oldPrice !== undefined) {
    const dropPercent =
      oldPrice > 0 ? Number((((oldPrice - data.price) / oldPrice) * 100).toFixed(2)) : null;

    writes.push(
      db.insert(appDropEvents).values({
        appId: data.appId,
        country: data.country,
        appName: data.appName,
        storeUrl: data.storeUrl,
        iconUrl: data.iconUrl,
        currency: data.currency,
        oldPrice,
        newPrice: data.price,
        dropPercent,
        detectedAt: now,
      }),
    );
  }

  await db.batch(writes);

  let alertsSent = 0;

  if (notifyDrops && priceDropped && oldPrice !== undefined) {
    const targets = await db
      .select({
        id: subscriptions.id,
        targetPrice: subscriptions.targetPrice,
        userEmail: users.email,
      })
      .from(subscriptions)
      .innerJoin(users, eq(subscriptions.userId, users.id))
      .where(
        and(
          eq(subscriptions.appId, data.appId),
          eq(subscriptions.country, data.country),
          eq(subscriptions.isActive, true),
          eq(users.isActive, true),
          or(isNull(subscriptions.targetPrice), gte(subscriptions.targetPrice, data.price)),
          or(
            isNull(subscriptions.lastNotifiedPrice),
            gt(subscriptions.lastNotifiedPrice, data.price),
          ),
        ),
      );

    for (const target of targets) {
      const result = await sendDropAlertEmail(env, {
        to: target.userEmail,
        appName: data.appName,
        appId: data.appId,
        country: data.country,
        oldPrice,
        newPrice: data.price,
        currency: data.currency,
        targetPrice: target.targetPrice,
        storeUrl: data.storeUrl,
      });

      if (result.sent) {
        alertsSent += 1;

        await db
          .update(subscriptions)
          .set({
            lastNotifiedPrice: data.price,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, target.id));
      }
    }
  }

  return {
    appId: data.appId,
    country: data.country,
    appName: data.appName,
    oldPrice,
    newPrice: data.price,
    currency: data.currency,
    priceChanged,
    priceDropped,
    alertsSent,
  };
};

const RETRYABLE_STATUS_CODE_RE = /status\s+(\d{3})/i;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

const defaultSleep: SleepFn = async (ms) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const isRetryableError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : '';
  const match = message.match(RETRYABLE_STATUS_CODE_RE);

  if (!match) {
    return false;
  }

  const statusCode = Number(match[1]);
  return RETRYABLE_STATUS_CODES.has(statusCode);
};

const resolveRetryDelayMs = (
  env: EnvConfig,
  attempt: number,
  random: () => number,
): number => {
  const baseMs = (env.PRICE_CHECK_RETRY_BASE_SECONDS ?? 15) * 1000;
  const maxMs = (env.PRICE_CHECK_RETRY_MAX_SECONDS ?? 90) * 1000;
  const jitterMs = (env.PRICE_CHECK_RETRY_JITTER_SECONDS ?? 5) * 1000;
  const exponentialMs = Math.min(baseMs * 2 ** attempt, maxMs);
  return Math.round(exponentialMs + random() * jitterMs);
};

const refreshWithRetry = async (
  env: EnvConfig,
  appId: string,
  country: string,
  requestId: string,
  runOptions: {
    random: () => number;
    sleep: SleepFn;
    refreshSingleApp: RefreshSingleAppFn;
  },
): Promise<RefreshResult | null> => {
  let attempt = 0;
  const maxRetries = env.PRICE_CHECK_MAX_RETRIES ?? 2;

  while (true) {
    try {
      return await runOptions.refreshSingleApp(
        appId,
        country,
        buildRefreshOptions({
          trigger: 'scheduled',
          requestId,
        }),
      );
    } catch (error) {
      if (!isRetryableError(error) || attempt >= maxRetries) {
        throw error;
      }

      const delayMs = resolveRetryDelayMs(env, attempt, runOptions.random);
      await runOptions.sleep(delayMs);
      attempt += 1;
    }
  }
};

const resolvePacingDelayMs = (env: EnvConfig): number => {
  const callsPerMinute = Math.max(1, env.PRICE_CHECK_MAX_CALLS_PER_MINUTE ?? 12);
  return Math.ceil(60_000 / callsPerMinute);
};

export const runPriceCheck = async (
  env: EnvConfig,
  options: RunPriceCheckOptions = {},
): Promise<CheckReport> => {
  const startedAt = new Date();
  const db = getDb(env);
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const refreshSingleAppFn: RefreshSingleAppFn = options.refreshSingleApp
    ? options.refreshSingleApp
    : (appId, country, refreshOptions) =>
        refreshSingleApp(env, appId, country, refreshOptions);

  try {
    const legacyPasswordUsers = await countLegacyPasswordHashUsers(env);
    console.log('auth.legacy_password_hash_users', {
      activeUsers: legacyPasswordUsers,
      iterations: LEGACY_PASSWORD_HASH_ITERATIONS,
    });
  } catch (error) {
    console.error('failed to collect auth legacy password metric', error);
  }

  const watchedPairs = await db
    .selectDistinct({
      appId: subscriptions.appId,
      country: subscriptions.country,
    })
    .from(subscriptions)
    .where(eq(subscriptions.isActive, true));

  const report: CheckReport = {
    startedAt: startedAt.toISOString(),
    finishedAt: startedAt.toISOString(),
    scanned: watchedPairs.length,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    updated: 0,
    drops: 0,
    emailsSent: 0,
    errors: [],
  };
  const pacingDelayMs = resolvePacingDelayMs(env);

  for (const [index, pair] of watchedPairs.entries()) {
    try {
      if (index > 0) {
        await sleep(pacingDelayMs);
      }

      const requestId = `scheduled:${startedAt.getTime()}:${index}:${pair.appId}:${pair.country}`;
      const result = await refreshWithRetry(env, pair.appId, pair.country, requestId, {
        random,
        sleep,
        refreshSingleApp: refreshSingleAppFn,
      });

      if (!result) {
        report.skipped += 1;
        report.errors.push(`app not found in App Store: ${pair.appId} (${pair.country})`);
        continue;
      }

      report.succeeded += 1;
      report.updated += 1;
      report.emailsSent += result.alertsSent;

      if (result.priceDropped) {
        report.drops += 1;
      }
    } catch (error) {
      report.failed += 1;
      const message = error instanceof Error ? error.message : 'unknown error';
      report.errors.push(`${pair.appId} (${pair.country}): ${message}`);
    }
  }

  report.finishedAt = new Date().toISOString();
  return report;
};
