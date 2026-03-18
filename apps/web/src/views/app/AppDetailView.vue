<script setup lang="ts">
import type { PriceHistoryWindow } from '@appstore-price-radar/contracts'
import type {
  AppChangeRow,
  AppDecisionStatsState,
  AppDetailPayload,
  AppTrendPoint,
} from './types'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePriceHistory } from '../../composables/usePriceHistory'
import { formatDateTime, formatMoney } from '../../lib/format'
import { useToast } from '../../lib/toast'
import AppDetailDecisionStats from './components/AppDetailDecisionStats.vue'
import AppDetailHeroCard from './components/AppDetailHeroCard.vue'
import AppDetailMetadataPanel from './components/AppDetailMetadataPanel.vue'

const COUNTRY_CODE_RE = /^[A-Z]{2}$/
const WINDOW_OPTIONS: Array<{ value: PriceHistoryWindow, label: string }> = [
  { value: '30d', label: '30 天' },
  { value: '90d', label: '90 天' },
  { value: '1y', label: '1 年' },
  { value: 'all', label: '全部' },
]

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

function toMoney(value: number | null | undefined, currency = 'USD'): string {
  return formatMoney(value, currency)
}

function toTime(value: string): string {
  return formatDateTime(value)
}

function toPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-'
  }

  return `${value.toFixed(2)}%`
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'scheduled':
      return '定时任务'
    case 'manual':
      return '手动刷新'
    case 'migration':
      return '迁移数据'
    case 'legacy':
      return '旧版历史'
    default:
      return source
  }
}

async function loadDetail(window: PriceHistoryWindow = selectedWindow.value): Promise<void> {
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

const changeRows = computed<AppChangeRow[]>(() => {
  const raw = detail.value?.history ?? []

  return raw
    .slice()
    .reverse()
    .map(row => ({
      id: row.id,
      time: row.changedAt,
      oldAmount: row.oldAmount,
      newAmount: row.newAmount,
      currency: row.currency,
      source: row.source,
      changePct: row.oldAmount > 0 ? ((row.newAmount - row.oldAmount) / row.oldAmount) * 100 : null,
    }))
})

const trendPoints = computed<AppTrendPoint[]>(() => {
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

  const first = currentHistory[0]
  const points: AppTrendPoint[] = [{
    key: `baseline-${first.id}`,
    time: first.changedAt,
    price: first.oldAmount,
    currency: first.currency,
  }]

  for (const item of currentHistory) {
    points.push({
      key: `event-${item.id}`,
      time: item.changedAt,
      price: item.newAmount,
      currency: item.currency,
    })
  }

  return points
})

const chartGeometry = computed(() => {
  const list = trendPoints.value

  if (list.length === 0) {
    return {
      path: '',
      points: [] as Array<AppTrendPoint & { x: number, y: number }>,
    }
  }

  const prices = list.map(item => item.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const points = list.map((item, index) => {
    const x = list.length === 1 ? 50 : (index / (list.length - 1)) * 100
    const y = 44 - ((item.price - min) / range) * 34

    return {
      ...item,
      x,
      y,
    }
  })

  return {
    path: points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(' '),
    points,
  }
})

const currentPoint = computed(() => {
  const points = chartGeometry.value.points
  return points.length === 0 ? null : (points.at(-1) ?? null)
})

const lowestPoint = computed(() => {
  const points = chartGeometry.value.points

  if (points.length === 0) {
    return null
  }

  return points.reduce((lowest, current) => {
    if (current.price < lowest.price) {
      return current
    }

    return lowest
  }, points[0])
})

const highestPoint = computed(() => {
  const points = chartGeometry.value.points

  if (points.length === 0) {
    return null
  }

  return points.reduce((highest, current) => {
    if (current.price > highest.price) {
      return current
    }

    return highest
  }, points[0])
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
    await loadDetail()
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
        <div class="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div class="skeleton-box h-64 rounded-[2rem]" />
          <div class="skeleton-box h-64 rounded-[2rem]" />
        </div>
        <div class="skeleton-box h-[28rem] rounded-[2rem]" />
      </section>

      <p v-else-if="errorText" class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
        {{ errorText }}
      </p>

      <template v-else-if="detail">
        <AppDetailHeroCard
          :app-id="appId"
          :country="country"
          :app-name="appTitle"
          :icon-url="detail.snapshot?.iconUrl ?? null"
          :store-url="detail.snapshot?.storeUrl ?? null"
          :current-price="heroCurrentPrice"
          :currency="historyCurrency"
          :updated-at="detail.snapshot?.updatedAt ?? null"
        />

        <div class="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <AppDetailDecisionStats :stats="decisionStats" />
          <AppDetailMetadataPanel :metadata="detail.metadata" />
        </div>

        <section class="reveal reveal-delay-1 mt-4 rounded-[2rem] border border-zinc-200/70 bg-white/92 p-5 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="metric-mono text-xs tracking-[0.18em] text-zinc-500">
                PRICE HISTORY
              </p>
              <h2 class="mt-2 text-xl font-semibold tracking-tight text-zinc-900">
                历史趋势与变化明细
              </h2>
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                v-for="option in WINDOW_OPTIONS"
                :key="option.value"
                type="button"
                class="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.08em] transition duration-300"
                :class="selectedWindow === option.value ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900'"
                :disabled="loading || loadingMore"
                @click="changeHistoryWindow(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
            <p>
              当前窗口：{{ WINDOW_OPTIONS.find(item => item.value === selectedWindow)?.label ?? selectedWindow }}，
              已加载 {{ detail.history.length }} / {{ detail.summary.totalChanges }} 条变化事件。
            </p>
            <p v-if="detail.summary.latestChangeAt">
              最近变化：{{ toTime(detail.summary.latestChangeAt) }}
            </p>
          </div>

          <div
            v-if="trendPoints.length === 0"
            class="mt-4 rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/70 px-4 py-4 text-sm text-zinc-500"
          >
            当前还没有可展示的历史变化事件。
          </div>

          <template v-else>
            <svg
              class="mt-4 h-44 w-full rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,rgba(16,185,129,0.08)_0%,rgba(255,255,255,0.9)_60%)]"
              viewBox="0 0 100 50"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="detailTrendGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#059669" />
                  <stop offset="100%" stop-color="#0f766e" />
                </linearGradient>
              </defs>
              <path :d="chartGeometry.path" fill="none" stroke="url(#detailTrendGradient)" stroke-width="1.8" />
              <circle v-if="lowestPoint" :cx="lowestPoint.x" :cy="lowestPoint.y" r="1.8" fill="#be123c" />
            </svg>

            <div class="mt-4 max-h-[420px] overflow-auto rounded-2xl border border-zinc-200">
              <table class="min-w-full border-collapse bg-white text-left text-sm">
                <thead>
                  <tr>
                    <th class="sticky top-0 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
                      变化时间
                    </th>
                    <th class="sticky top-0 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
                      价格变化
                    </th>
                    <th class="sticky top-0 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
                      变化幅度
                    </th>
                    <th class="sticky top-0 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
                      来源
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="changeRows.length === 0" class="border-b border-zinc-100">
                    <td colspan="4" class="px-3 py-3 text-zinc-500">
                      该应用还没有价格变化事件。
                    </td>
                  </tr>
                  <tr v-for="row in changeRows" :key="row.id" class="border-b border-zinc-100">
                    <td class="px-3 py-2">
                      {{ toTime(row.time) }}
                    </td>
                    <td class="px-3 py-2">
                      {{ toMoney(row.oldAmount, row.currency) }} → {{ toMoney(row.newAmount, row.currency) }}
                    </td>
                    <td
                      class="px-3 py-2 font-medium"
                      :class="row.changePct !== null && row.changePct < 0 ? 'text-emerald-700' : row.changePct !== null && row.changePct > 0 ? 'text-amber-700' : 'text-zinc-700'"
                    >
                      {{ toPercent(row.changePct) }}
                    </td>
                    <td class="px-3 py-2 text-zinc-600">
                      {{ sourceLabel(row.source) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-4 flex justify-end">
              <button
                v-if="canLoadMore"
                type="button"
                class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="loadingMore"
                @click="loadMoreHistory"
              >
                {{ loadingMore ? '加载中...' : '加载更多' }}
              </button>
            </div>
          </template>
        </section>
      </template>
    </div>
  </main>
</template>
