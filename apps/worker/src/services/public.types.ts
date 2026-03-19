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

export type PublicDropItem = {
  id: number;
  appId: string;
  country: string;
  appName: string;
  storeUrl: string | null;
  iconUrl: string | null;
  currency: string;
  oldPrice: number;
  newPrice: number;
  dropPercent: number | null;
  detectedAt: Date;
  submissionCount: number;
};

export type PublicDropsResponse = {
  items: PublicDropItem[];
};
