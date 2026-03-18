import type {
  AuthUserDto,
  PriceHistoryResponseDto,
  SubscriptionItemDto,
} from '@appstore-price-radar/contracts'

export type AuthUser = AuthUserDto
export type SubscriptionItem = SubscriptionItemDto
export type HistoryPayload = PriceHistoryResponseDto
export type SelectedSubscription = Pick<SubscriptionItemDto, 'targetPrice' | 'currency'>

export interface WatchStats {
  total: number
  withTarget: number
}
