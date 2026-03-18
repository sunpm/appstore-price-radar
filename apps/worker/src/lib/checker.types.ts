export type RefreshOptions = {
  notifyDrops?: boolean;
  source?: string;
  requestId?: string;
};

export type SleepFn = (ms: number) => Promise<void>;
export type RandomFn = () => number;

export type RefreshSingleAppFn = (
  appId: string,
  country: string,
  options?: RefreshOptions,
) => Promise<RefreshResult | null>;

export type RunPriceCheckOptions = {
  sleep?: SleepFn;
  random?: RandomFn;
  refreshSingleApp?: RefreshSingleAppFn;
};

export type RefreshResult = {
  appId: string;
  country: string;
  appName?: string;
  oldPrice?: number;
  newPrice?: number;
  currency?: string;
  priceChanged: boolean;
  priceDropped: boolean;
  alertsSent: number;
};

export type CheckReport = {
  startedAt: string;
  finishedAt: string;
  scanned: number;
  updated: number;
  drops: number;
  emailsSent: number;
  errors: string[];
};
