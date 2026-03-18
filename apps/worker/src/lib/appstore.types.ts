type AppStoreLookupBase = {
  appId: string;
  country: string;
  appName: string;
  currency: string;
  storeUrl: string | null;
  iconUrl: string | null;
  formattedPrice: string | null;
};

export type AppStorePrice = AppStoreLookupBase & {
  kind: 'found';
  price: number;
};

export type InvalidAppStorePrice = AppStoreLookupBase & {
  kind: 'invalid-price';
  reason: 'missing-price';
};

export type AppStoreLookupResult = AppStorePrice | InvalidAppStorePrice;
