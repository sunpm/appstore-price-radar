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
  genres: string[];
  description: string | null;
  averageUserRating: number | null;
  averageUserRatingForCurrentVersion: number | null;
  userRatingCount: number | null;
  userRatingCountForCurrentVersion: number | null;
  bundleId: string | null;
  version: string | null;
  minimumOsVersion: string | null;
  releaseNotes: string | null;
  fileSizeBytes: string | null;
  contentAdvisoryRating: string | null;
  trackContentRating: string | null;
  releaseDate: string | null;
  currentVersionReleaseDate: string | null;
  sellerUrl: string | null;
  artistViewUrl: string | null;
  supportedDevices: string[];
  languageCodesISO2A: string[];
  advisories: string[];
  features: string[];
  screenshotUrls: string[];
  ipadScreenshotUrls: string[];
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
