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

export interface PriceHistoryPageDto {
  limit: number
  returned: number
}

export interface PriceHistorySummaryDto {
  latestPrice: number | null
  lowestPrice: number | null
  highestPrice: number | null
}

export interface PriceHistoryResponseDto {
  snapshot: AppSnapshotDto | null
  history: PriceChangeEventDto[]
  page: PriceHistoryPageDto
  summary: PriceHistorySummaryDto
}
