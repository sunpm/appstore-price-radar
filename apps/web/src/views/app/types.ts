import type {
  AppDecisionMetadataDto,
  AppDetailResponseDto,
  PriceChangeEventDto,
} from '@appstore-price-radar/contracts'

export type AppDetailPayload = AppDetailResponseDto

export interface AppTrendPoint {
  key: string
  time: string
  price: number
  currency: string
}

export interface AppChangeRow {
  id: number
  time: string
  oldAmount: number
  newAmount: number
  currency: string
  source: string
  changePct: number | null
}

export interface AppDecisionStatsState {
  averageUserRating: number | null
  userRatingCount: number | null
  primaryGenreName: string | null
  dropFromPeakPct: number | null
  lowestPrice: number | null
  totalChanges: number
  currency: string
}

export type { AppDecisionMetadataDto }
export type { PriceChangeEventDto }
