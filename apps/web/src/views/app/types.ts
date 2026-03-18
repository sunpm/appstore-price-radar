import type { PriceChangeEventDto, PriceHistoryResponseDto } from '@appstore-price-radar/contracts'

export type AppDetailPayload = PriceHistoryResponseDto

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

export type { PriceChangeEventDto }
