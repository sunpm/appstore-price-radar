export interface AppSnapshotDto {
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

export interface PriceHistoryPayload {
  snapshot: AppSnapshotDto | null
  history: PriceChangeEventDto[]
}
