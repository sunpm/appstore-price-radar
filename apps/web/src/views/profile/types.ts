import type {
  AuthUserDto,
  SubscriptionItemDto,
} from '@appstore-price-radar/contracts'

export type AuthUser = AuthUserDto
export type SubscriptionItem = SubscriptionItemDto

export interface WatchStats {
  total: number
  withTarget: number
}
