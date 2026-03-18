import { and, desc, eq } from 'drizzle-orm';

import type { EnvConfig } from '../env';
import { getDb } from '../db/client';
import { appSnapshots, subscriptions } from '../db/schema';
import { extractAppId } from '../lib/appstore';
import { buildRefreshOptions, refreshSingleApp } from '../lib/checker';
import type {
  CreateSubscriptionPayload,
  CreateSubscriptionResponse,
  DeleteSubscriptionPayload,
  DeleteSubscriptionResponse,
  ListSubscriptionsResponse,
  SubscriptionCoreRecord,
  SubscriptionDto,
  SubscriptionErrorResponse,
  SubscriptionMapperInput,
  SubscriptionsAuthUser,
  SubscriptionsHttpStatus,
  SubscriptionsServiceResponse,
} from './subscriptions.types';

type CreateOrErrorBody = CreateSubscriptionResponse | SubscriptionErrorResponse;
type DeleteOrErrorBody = DeleteSubscriptionResponse | SubscriptionErrorResponse;

const buildServiceResponse = <TBody>(
  status: SubscriptionsHttpStatus,
  body: TBody,
): SubscriptionsServiceResponse<TBody> => {
  return { status, body };
};

export const toSubscriptionItemDto = (
  item: SubscriptionMapperInput,
): SubscriptionDto => {
  return {
    id: item.id,
    appId: item.appId,
    country: item.country,
    targetPrice: item.targetPrice,
    lastNotifiedPrice: item.lastNotifiedPrice ?? null,
    isActive: item.isActive,
    appName: item.appName ?? null,
    storeUrl: item.storeUrl ?? null,
    iconUrl: item.iconUrl ?? null,
    currentPrice: item.currentPrice ?? null,
    currency: item.currency ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
};

export const createUserSubscription = async (
  config: EnvConfig,
  authUser: SubscriptionsAuthUser,
  payload: CreateSubscriptionPayload,
): Promise<SubscriptionsServiceResponse<CreateOrErrorBody>> => {
  const db = getDb(config);
  const appId = extractAppId(payload.appId);

  if (!appId) {
    return buildServiceResponse(400, {
      error: 'Invalid appId. Please provide numeric app id or App Store URL',
    });
  }

  const country = payload.country.toUpperCase();
  const now = new Date();

  const [subscription] = await db
    .insert(subscriptions)
    .values({
      email: authUser.email,
      userId: authUser.id,
      appId,
      country,
      targetPrice: payload.targetPrice ?? null,
      isActive: true,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [subscriptions.userId, subscriptions.appId, subscriptions.country],
      set: {
        email: authUser.email,
        targetPrice: payload.targetPrice ?? null,
        isActive: true,
        updatedAt: now,
      },
    })
    .returning();

  try {
    await refreshSingleApp(
      config,
      appId,
      country,
      buildRefreshOptions({
        trigger: 'subscription-create',
        requestId: `subscription-create:${subscription.id}`,
      }),
    );
  } catch (error) {
    console.error('refreshSingleApp failed after subscription created', error);
  }

  const subscriptionDto = toSubscriptionItemDto({
    ...(subscription as SubscriptionCoreRecord),
    appName: null,
    storeUrl: null,
    iconUrl: null,
    currentPrice: null,
    currency: null,
  });

  return buildServiceResponse(200, {
    subscription: subscriptionDto,
  });
};

export const listUserSubscriptions = async (
  config: EnvConfig,
  userId: string,
): Promise<SubscriptionsServiceResponse<ListSubscriptionsResponse>> => {
  const db = getDb(config);
  const rows = await db
    .select({
      id: subscriptions.id,
      appId: subscriptions.appId,
      country: subscriptions.country,
      targetPrice: subscriptions.targetPrice,
      lastNotifiedPrice: subscriptions.lastNotifiedPrice,
      isActive: subscriptions.isActive,
      createdAt: subscriptions.createdAt,
      updatedAt: subscriptions.updatedAt,
      appName: appSnapshots.appName,
      storeUrl: appSnapshots.storeUrl,
      iconUrl: appSnapshots.iconUrl,
      currentPrice: appSnapshots.lastPrice,
      currency: appSnapshots.currency,
    })
    .from(subscriptions)
    .leftJoin(
      appSnapshots,
      and(
        eq(subscriptions.appId, appSnapshots.appId),
        eq(subscriptions.country, appSnapshots.country),
      ),
    )
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.isActive, true)))
    .orderBy(desc(subscriptions.createdAt));

  const items = rows.map(toSubscriptionItemDto);

  return buildServiceResponse(200, { items });
};

export const deleteUserSubscription = async (
  config: EnvConfig,
  userId: string,
  payload: DeleteSubscriptionPayload,
): Promise<SubscriptionsServiceResponse<DeleteOrErrorBody>> => {
  const db = getDb(config);
  const [removed] = await db
    .update(subscriptions)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(and(eq(subscriptions.id, payload.id), eq(subscriptions.userId, userId)))
    .returning({ id: subscriptions.id });

  if (!removed) {
    return buildServiceResponse(404, { error: 'Subscription not found' });
  }

  return buildServiceResponse(200, { ok: true, id: removed.id });
};
