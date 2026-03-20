export interface DropEventItem {
  id: number
  appId: string
  country: string
  appName: string
  storeUrl: string | null
  iconUrl: string | null
  currency: string
  oldPrice: number
  newPrice: number
  dropPercent: number | null
  detectedAt: string
  submissionCount: number
}

export interface HomeFeedSummary {
  total: number
  apps: number
  maxDrop: number
  countries: number
  newestAt: string | null
}
