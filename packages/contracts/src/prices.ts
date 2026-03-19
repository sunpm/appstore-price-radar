export interface AppSnapshotDto {
  appId: string
  country: string
  appName: string
  storeUrl: string | null
  iconUrl: string | null
  currency: string
  lastPrice: number
  updatedAt: string
}

export interface PriceChangeEventDto {
  id: number
  appId: string
  country: string
  currency: string
  oldAmount: number
  newAmount: number
  changedAt: string
  source: string
  requestId: string
}

export type PriceHistoryWindow = '30d' | '90d' | '1y' | 'all'

export interface PriceHistoryPageDto {
  window: PriceHistoryWindow
  pageSize: number
  nextCursor: string | null
  hasMore: boolean
}

export interface PriceHistorySummaryDto {
  totalChanges: number
  latestChangeAt: string | null
  earliestChangeAt: string | null
}

export interface PriceHistoryResponseDto {
  snapshot: AppSnapshotDto | null
  history: PriceChangeEventDto[]
  page: PriceHistoryPageDto
  summary: PriceHistorySummaryDto
}

export interface AppDecisionMetadataDto {
  sellerName: string | null
  primaryGenreName: string | null
  genres: string[]
  description: string | null
  averageUserRating: number | null
  averageUserRatingForCurrentVersion: number | null
  userRatingCount: number | null
  userRatingCountForCurrentVersion: number | null
  bundleId: string | null
  version: string | null
  minimumOsVersion: string | null
  releaseNotes: string | null
  fileSizeBytes: string | null
  contentAdvisoryRating: string | null
  trackContentRating: string | null
  releaseDate: string | null
  currentVersionReleaseDate: string | null
  sellerUrl: string | null
  artistViewUrl: string | null
  supportedDevices: string[]
  languageCodesISO2A: string[]
  advisories: string[]
  features: string[]
  screenshotUrls: string[]
  ipadScreenshotUrls: string[]
}

export interface AppDetailResponseDto extends PriceHistoryResponseDto {
  metadata: AppDecisionMetadataDto | null
}
