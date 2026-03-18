import type { AppPriceChangeEvent, AppSnapshot } from '../db/schema';

export type PricesHttpStatus = 200 | 400;

export type PricesServiceResponse<TBody> = {
  status: PricesHttpStatus;
  body: TBody;
};

export type GetPriceHistoryPayload = {
  appId: string;
  country: string;
  limit?: number;
};

export type PriceHistorySuccessResponse = {
  snapshot: AppSnapshot | null;
  history: AppPriceChangeEvent[];
};

export type PriceHistoryErrorResponse = {
  error: string;
};
