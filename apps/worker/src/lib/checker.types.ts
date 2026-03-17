export type RefreshOptions = {
  notifyDrops?: boolean;
};

export type RefreshResult = {
  appId: string;
  country: string;
  appName?: string;
  oldPrice?: number;
  newPrice?: number;
  currency?: string;
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
