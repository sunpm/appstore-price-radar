<script setup lang="ts">
import type { PriceHistoryWindow } from '@appstore-price-radar/contracts'
import type { AppDecisionStatsState, AppDetailPayload } from './types'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePriceHistory } from '../../composables/usePriceHistory'
import { useToast } from '../../lib/toast'
import AppDetailDecisionStats from './components/AppDetailDecisionStats.vue'
import AppDetailHeroCard from './components/AppDetailHeroCard.vue'
import AppDetailMetadataPanel from './components/AppDetailMetadataPanel.vue'
import AppDetailTrendPanel from './components/AppDetailTrendPanel.vue'

interface DetailPricePoint {
  key: string
  time: string
  price: number
  currency: string
}

const COUNTRY_CODE_RE = /^[A-Z]{2}$/
const DEFAULT_DETAIL_WINDOW: PriceHistoryWindow = '1y'

const route = useRoute()
const toast = useToast()
const errorText = ref('')
const hasLoaded = ref(false)

const {
  history,
  metadata,
  snapshot,
  page,
  summary,
  loading,
  loadingMore,
  selectedWindow,
  loadInitial,
  loadMore,
} = usePriceHistory()

const appId = computed<string>(() => {
  const raw = route.params.appId
  return typeof raw === 'string' ? raw.trim() : ''
})

const country = computed<string>(() => {
  const raw = route.params.country
  const value = typeof raw === 'string' ? raw.trim().toUpperCase() : 'US'
  return COUNTRY_CODE_RE.test(value) ? value : 'US'
})

const detail = computed<AppDetailPayload | null>(() => {
  if (!hasLoaded.value) {
    return null
  }

  return {
    snapshot: snapshot.value,
    history: history.value,
    page: page.value,
    summary: summary.value,
    metadata: metadata.value,
  }
})

watch(errorText, (next): void => {
  if (!next) {
    return
  }

  toast.error(next)
})

async function loadDetail(window: PriceHistoryWindow = DEFAULT_DETAIL_WINDOW): Promise<void> {
  if (!appId.value) {
    errorText.value = '应用 ID 无效。'
    hasLoaded.value = true
    return
  }

  errorText.value = ''
  hasLoaded.value = false

  try {
    await loadInitial(appId.value, country.value, window)
  }
  catch (error) {
    errorText.value = error instanceof Error ? error.message : '详情加载失败，请稍后重试。'
  }
  finally {
    hasLoaded.value = true
  }
}

async function changeHistoryWindow(window: PriceHistoryWindow): Promise<void> {
  await loadDetail(window)
}

async function loadMoreHistory(): Promise<void> {
  try {
    await loadMore()
  }
  catch (error) {
    errorText.value = error instanceof Error ? error.message : '更多历史数据加载失败，请稍后重试。'
  }
}

const priceTrail = computed<DetailPricePoint[]>(() => {
  const currentHistory = detail.value?.history ?? []

  if (currentHistory.length === 0) {
    const currentSnapshot = detail.value?.snapshot

    if (!currentSnapshot) {
      return []
    }

    return [{
      key: 'snapshot-only',
      time: currentSnapshot.updatedAt,
      price: currentSnapshot.lastPrice,
      currency: currentSnapshot.currency,
    }]
  }

  const [firstChange] = currentHistory

  if (!firstChange) {
    return []
  }

  const points: DetailPricePoint[] = [{
    key: `baseline-${firstChange.id}`,
    time: firstChange.changedAt,
    price: firstChange.oldAmount,
    currency: firstChange.currency,
  }]

  for (const item of currentHistory) {
    points.push({
      key: `change-${item.id}`,
      time: item.changedAt,
      price: item.newAmount,
      currency: item.currency,
    })
  }

  return points
})

const currentPoint = computed(() => {
  return priceTrail.value.at(-1) ?? null
})

const lowestPoint = computed(() => {
  if (priceTrail.value.length === 0) {
    return null
  }

  return priceTrail.value.reduce((lowest, current) => {
    if (current.price < lowest.price) {
      return current
    }

    return lowest
  }, priceTrail.value[0]!)
})

const highestPoint = computed(() => {
  if (priceTrail.value.length === 0) {
    return null
  }

  return priceTrail.value.reduce((highest, current) => {
    if (current.price > highest.price) {
      return current
    }

    return highest
  }, priceTrail.value[0]!)
})

const historyCurrency = computed(() => {
  return detail.value?.snapshot?.currency ?? currentPoint.value?.currency ?? 'USD'
})

const dropFromPeakPct = computed<number | null>(() => {
  const current = currentPoint.value
  const highest = highestPoint.value

  if (!current || !highest || highest.price <= 0) {
    return null
  }

  return ((highest.price - current.price) / highest.price) * 100
})

const appTitle = computed(() => {
  return detail.value?.snapshot?.appName ?? `App ${appId.value}`
})

const heroCurrentPrice = computed(() => {
  return currentPoint.value?.price ?? detail.value?.snapshot?.lastPrice ?? null
})

const decisionStats = computed<AppDecisionStatsState>(() => {
  return {
    averageUserRating: detail.value?.metadata?.averageUserRating ?? null,
    averageUserRatingForCurrentVersion:
      detail.value?.metadata?.averageUserRatingForCurrentVersion ?? null,
    userRatingCount: detail.value?.metadata?.userRatingCount ?? null,
    primaryGenreName: detail.value?.metadata?.primaryGenreName ?? null,
    dropFromPeakPct: dropFromPeakPct.value,
    lowestPrice: lowestPoint.value?.price ?? heroCurrentPrice.value,
    totalChanges: detail.value?.summary.totalChanges ?? 0,
    currency: historyCurrency.value,
  }
})

const canLoadMore = computed(() => Boolean(detail.value?.page.hasMore))

watch(
  () => [appId.value, country.value],
  async () => {
    await loadDetail(DEFAULT_DETAIL_WINDOW)
  },
  { immediate: true },
)
</script>

<template>
  <main class="min-h-[100dvh] bg-zinc-100 text-zinc-900">
    <div class="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_8%,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_90%_5%,rgba(20,83,45,0.1),transparent_34%),linear-gradient(158deg,#f3f7f6_0%,#edf3f3_48%,#f8f8f9_100%)]" />

    <div class="mx-auto max-w-[1200px] px-4 py-6 md:px-8 md:py-10">
      <section v-if="loading" class="grid gap-4">
        <div class="skeleton-box h-48 rounded-[2rem]" />
        <div class="skeleton-box h-[34rem] rounded-[2rem]" />
        <div class="skeleton-box h-72 rounded-[2rem]" />
        <div class="skeleton-box h-[40rem] rounded-[2rem]" />
      </section>

      <p
        v-else-if="errorText"
        class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
      >
        {{ errorText }}
      </p>

      <template v-else-if="detail">
        <AppDetailHeroCard
          :app-id="appId"
          :country="country"
          :app-name="appTitle"
          :icon-url="detail.snapshot?.iconUrl ?? null"
          :store-url="detail.snapshot?.storeUrl ?? null"
          :seller-name="detail.metadata?.sellerName ?? null"
          :primary-genre-name="detail.metadata?.primaryGenreName ?? null"
          :version="detail.metadata?.version ?? null"
          :content-advisory-rating="detail.metadata?.contentAdvisoryRating ?? detail.metadata?.trackContentRating ?? null"
          :current-price="heroCurrentPrice"
          :currency="historyCurrency"
          :updated-at="detail.snapshot?.updatedAt ?? null"
        />

        <AppDetailTrendPanel
          :snapshot="detail.snapshot"
          :history="detail.history"
          :summary="detail.summary"
          :selected-window="selectedWindow"
          :loading-more="loadingMore"
          :can-load-more="canLoadMore"
          @change-window="changeHistoryWindow"
          @load-more="loadMoreHistory"
        />

        <AppDetailDecisionStats class="mt-4" :stats="decisionStats" />

        <AppDetailMetadataPanel
          class="mt-4"
          :metadata="detail.metadata"
          :app-name="appTitle"
          :store-url="detail.snapshot?.storeUrl ?? null"
        />
      </template>
    </div>
  </main>
</template>
