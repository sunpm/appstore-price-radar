export interface SubscriptionItemDto {
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

export interface CreateSubscriptionResponseDto {
  subscription: SubscriptionItemDto
}

export interface ListSubscriptionsResponseDto {
  items: SubscriptionItemDto[]
}

export interface DeleteSubscriptionResponseDto {
  ok: true
  id: string
}

export interface SubscriptionErrorDto {
  error: string
}
