import type {
  CreateSubscriptionResponseDto,
  DeleteSubscriptionResponseDto,
  ListSubscriptionsResponseDto,
  SubscriptionErrorDto,
  SubscriptionItemDto,
} from '@appstore-price-radar/contracts';
import type { Subscription } from '../db/schema';

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

export type SubscriptionErrorResponse = SubscriptionErrorDto;

export type CreateSubscriptionResponse = CreateSubscriptionResponseDto;

export type SubscriptionCoreRecord = Pick<
  Subscription,
  | 'id'
  | 'appId'
  | 'country'
  | 'targetPrice'
  | 'lastNotifiedPrice'
  | 'isActive'
  | 'createdAt'
  | 'updatedAt'
>;

export type SubscriptionListItemRecord = SubscriptionCoreRecord & {
  appName: string | null;
  storeUrl: string | null;
  iconUrl: string | null;
  currentPrice: number | null;
  currency: string | null;
};

export type SubscriptionMapperInput = SubscriptionListItemRecord;

export type ListSubscriptionsResponse = ListSubscriptionsResponseDto;

export type DeleteSubscriptionPayload = {
  id: string;
};

export type DeleteSubscriptionResponse = DeleteSubscriptionResponseDto;

export type SubscriptionDto = SubscriptionItemDto;
