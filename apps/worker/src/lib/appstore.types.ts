type AppStoreLookupBase = {
  appId: string;
  country: string;
  appName: string;
  currency: string;
  storeUrl: string | null;
  iconUrl: string | null;
  formattedPrice: string | null;
  sellerName: string | null;
  primaryGenreName: string | null;
  description: string | null;
  averageUserRating: number | null;
  userRatingCount: number | null;
  bundleId: string | null;
  version: string | null;
  minimumOsVersion: string | null;
  releaseNotes: string | null;
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
