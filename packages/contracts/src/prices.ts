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
  description: string | null
  averageUserRating: number | null
  userRatingCount: number | null
  bundleId: string | null
  version: string | null
  minimumOsVersion: string | null
  releaseNotes: string | null
}

export interface AppDetailResponseDto extends PriceHistoryResponseDto {
  metadata: AppDecisionMetadataDto | null
}
