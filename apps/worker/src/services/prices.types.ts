import type {
  AppSnapshotDto,
  PriceChangeEventDto,
  PriceHistoryResponseDto,
  PriceHistorySummaryDto,
} from '@appstore-price-radar/contracts';

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

export type AppSnapshotRecord = {
  appId: string;
  country: string;
  appName: string;
  storeUrl: string | null;
  iconUrl: string | null;
  currency: string;
  lastPrice: number;
  updatedAt: Date;
};

export type PriceChangeEventRecord = {
  id: number;
  appId: string;
  country: string;
  currency: string;
  oldAmount: number;
  newAmount: number;
  changedAt: Date;
  source: string;
  requestId: string;
};

export type PriceHistorySuccessResponse = PriceHistoryResponseDto;

export type PriceHistoryErrorResponse = {
  error: string;
};

export type PriceEventDto = PriceChangeEventDto;
export type SnapshotDto = AppSnapshotDto;
export type HistorySummaryDto = PriceHistorySummaryDto;
