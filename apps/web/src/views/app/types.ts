import type {
  AppDecisionMetadataDto,
  AppDetailResponseDto,
  PriceChangeEventDto,
} from '@appstore-price-radar/contracts'

export type AppDetailPayload = AppDetailResponseDto

export interface AppDecisionStatsState {
  averageUserRating: number | null
  averageUserRatingForCurrentVersion: number | null
  userRatingCount: number | null
  primaryGenreName: string | null
  dropFromPeakPct: number | null
  lowestPrice: number | null
  totalChanges: number
  currency: string
}

export type { AppDecisionMetadataDto }
export type { PriceChangeEventDto }
