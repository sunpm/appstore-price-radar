import type { AppDropEvent } from '../db/schema';

export type PublicHttpStatus = 200;

export type PublicServiceResponse<TBody> = {
  status: PublicHttpStatus;
  body: TBody;
};

export type GetPublicDropsPayload = {
  country?: string;
  dedupe?: boolean;
  limit?: number;
};

export type PublicDropItem = AppDropEvent & {
  submissionCount: number;
};

export type PublicDropsResponse = {
  items: PublicDropItem[];
};
