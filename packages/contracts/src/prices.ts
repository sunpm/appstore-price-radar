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
