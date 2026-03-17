export type AppStorePrice = {
  appId: string;
  country: string;
  appName: string;
  price: number;
  currency: string;
  storeUrl: string | null;
  iconUrl: string | null;
  formattedPrice: string | null;
};
