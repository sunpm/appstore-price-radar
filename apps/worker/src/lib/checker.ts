import { and, eq, gt, gte, isNull, or } from 'drizzle-orm';

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
import type { CheckReport, RefreshOptions, RefreshResult } from './checker.types';

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
  const source = options.source ?? (notifyDrops ? 'scheduled' : 'manual');
  const requestId =
    options.requestId ??
    `${source}:${data.appId}:${data.country}:${now.getTime()}`;

  await db
    .insert(appSnapshots)
    .values({
      appId: data.appId,
      country: data.country,
      appName: data.appName,
      storeUrl: data.storeUrl,
      iconUrl: data.iconUrl,
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
        currency: data.currency,
        lastPrice: data.price,
        updatedAt: now,
      },
    });

  const priceDropped = oldPrice !== undefined && oldPrice > data.price;

  if (priceChanged && oldPrice !== undefined) {
    await db
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
      });
  }

  let alertsSent = 0;

  if (priceDropped && oldPrice !== undefined) {
    const dropPercent =
      oldPrice > 0 ? Number((((oldPrice - data.price) / oldPrice) * 100).toFixed(2)) : null;

    await db.insert(appDropEvents).values({
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
    });
  }

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

export const runPriceCheck = async (env: EnvConfig): Promise<CheckReport> => {
  const startedAt = new Date();
  const db = getDb(env);

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
    updated: 0,
    drops: 0,
    emailsSent: 0,
    errors: [],
  };

  for (const [index, pair] of watchedPairs.entries()) {
    try {
      const result = await refreshSingleApp(env, pair.appId, pair.country, {
        notifyDrops: true,
        source: 'scheduled',
        requestId: `scheduled:${startedAt.getTime()}:${index}:${pair.appId}:${pair.country}`,
      });

      if (!result) {
        report.errors.push(`app not found in App Store: ${pair.appId} (${pair.country})`);
        continue;
      }

      report.updated += 1;
      report.emailsSent += result.alertsSent;

      if (result.priceDropped) {
        report.drops += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      report.errors.push(`${pair.appId} (${pair.country}): ${message}`);
    }
  }

  report.finishedAt = new Date().toISOString();
  return report;
};
