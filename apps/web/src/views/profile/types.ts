import type { AuthUser } from '../auth/types'

export type { AuthUser }

export interface SubscriptionItem {
  id: string
  appId: string
  country: string
  targetPrice: number | null
  lastNotifiedPrice: number | null
  isActive: boolean
  appName: string | null
  storeUrl: string | null
  iconUrl: string | null
  currentPrice: number | null
  currency: string | null
  createdAt: string
  updatedAt: string
}

export interface PricePoint {
  id: number
  appId: string
  country: string
  price: number
  currency: string
  fetchedAt: string
}

export interface HistoryPayload {
  snapshot: {
    appName: string
    storeUrl: string | null
    iconUrl: string | null
    currency: string
    lastPrice: number
  } | null
  history: PricePoint[]
}

export type SelectedSubscription = Pick<SubscriptionItem, 'targetPrice' | 'currency'>

export interface WatchStats {
  total: number
  withTarget: number
}
