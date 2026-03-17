import type { Subscription } from '../db/schema';
import type { RefreshResult } from '../lib/checker.types';

export type SubscriptionsHttpStatus = 200 | 400 | 404;

export type SubscriptionsServiceResponse<TBody> = {
  status: SubscriptionsHttpStatus;
  body: TBody;
};

export type SubscriptionsAuthUser = {
  id: string;
  email: string;
};

export type CreateSubscriptionPayload = {
  appId: string;
  country: string;
  targetPrice?: number | null;
};

export type SubscriptionErrorResponse = {
  error: string;
};

export type CreateSubscriptionResponse = {
  subscription: Subscription;
  latest: RefreshResult | null;
};

export type SubscriptionListItem = {
  id: string;
  appId: string;
  country: string;
  targetPrice: number | null;
  lastNotifiedPrice: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  appName: string | null;
  storeUrl: string | null;
  iconUrl: string | null;
  currentPrice: number | null;
  currency: string | null;
};

export type ListSubscriptionsResponse = {
  items: SubscriptionListItem[];
};

export type DeleteSubscriptionPayload = {
  id: string;
};

export type DeleteSubscriptionResponse = {
  ok: true;
  id: string;
};
