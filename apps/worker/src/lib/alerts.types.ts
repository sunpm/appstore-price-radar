export type DropAlertPayload = {
  to: string;
  appName: string;
  appId: string;
  country: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  targetPrice: number | null;
  storeUrl: string | null;
};

export type AlertResult = {
  sent: boolean;
  reason?: string;
};
