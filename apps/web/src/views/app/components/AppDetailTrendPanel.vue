<script setup lang="ts">
import type {
  AppSnapshotDto,
  PriceChangeEventDto,
  PriceHistorySummaryDto,
} from '@appstore-price-radar/contracts'
import { computed } from 'vue'
import { formatDate, formatDateTime, formatMoney } from '../../../lib/format'
import AppDetailMoneyDisplay from './AppDetailMoneyDisplay.vue'

interface TrendPoint {
  key: string
  time: string
  price: number
  currency: string
}

interface TrendChangeRow {
  id: number
  time: string
  oldAmount: number
  newAmount: number
  currency: string
  direction: 'up' | 'down' | 'flat'
}

const props = defineProps<{
  snapshot: AppSnapshotDto | null
  history: PriceChangeEventDto[]
  summary: PriceHistorySummaryDto
  loadingMore: boolean
  canLoadMore: boolean
  storeUrl: string | null
  storePlatformLabel: string
}>()

const emit = defineEmits<{
  loadMore: []
}>()

const priceTrail = computed<TrendPoint[]>(() => {
  if (props.history.length === 0) {
    if (!props.snapshot) {
      return []
    }

    return [{
      key: 'snapshot-only',
      time: props.snapshot.updatedAt,
      price: props.snapshot.lastPrice,
      currency: props.snapshot.currency,
    }]
  }

  const [firstChange] = props.history

  if (!firstChange) {
    return []
  }

  const points: TrendPoint[] = [{
    key: `baseline-${firstChange.id}`,
    time: firstChange.changedAt,
    price: firstChange.oldAmount,
    currency: firstChange.currency,
  }]

  for (const item of props.history) {
    points.push({
      key: `change-${item.id}`,
      time: item.changedAt,
      price: item.newAmount,
      currency: item.currency,
    })
  }

  return points
})

const latestPoint = computed(() => {
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

const oneYearLowestPoint = computed(() => {
  if (priceTrail.value.length === 0) {
    return null
  }

  const referenceTime = props.snapshot?.updatedAt ?? latestPoint.value?.time ?? null

  if (!referenceTime) {
    return null
  }

  const referenceTimestamp = new Date(referenceTime).getTime()

  if (Number.isNaN(referenceTimestamp)) {
    return null
  }

  const oneYearAgo = new Date(referenceTimestamp)
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const pointsWithinOneYear = priceTrail.value.filter((point) => {
    const pointTimestamp = new Date(point.time).getTime()
    return !Number.isNaN(pointTimestamp) && pointTimestamp >= oneYearAgo.getTime()
  })

  if (pointsWithinOneYear.length === 0) {
    return null
  }

  return pointsWithinOneYear.reduce((lowest, current) => {
    if (current.price < lowest.price) {
      return current
    }

    return lowest
  }, pointsWithinOneYear[0]!)
})

const orderedChanges = computed<TrendChangeRow[]>(() => {
  return props.history
    .slice()
    .reverse()
    .map(item => ({
      id: item.id,
      time: item.changedAt,
      oldAmount: item.oldAmount,
      newAmount: item.newAmount,
      currency: item.currency,
      direction: item.newAmount < item.oldAmount ? 'down' : item.newAmount > item.oldAmount ? 'up' : 'flat',
    }))
})

const latestChange = computed(() => {
  return orderedChanges.value[0] ?? null
})

const currentPriceCardValue = computed(() => {
  if (!latestPoint.value) {
    return '暂无'
  }

  return formatMoney(latestPoint.value.price, latestPoint.value.currency)
})

const loadProgress = computed(() => {
  if (props.summary.totalChanges <= 0) {
    return 0
  }

  return Math.min((props.history.length / props.summary.totalChanges) * 100, 100)
})

const showStandaloneCurrentPrice = computed(() => {
  if (!latestPoint.value || !lowestPoint.value) {
    return false
  }

  return latestPoint.value.price !== lowestPoint.value.price
    || latestPoint.value.currency !== lowestPoint.value.currency
})

function directionSymbol(direction: TrendChangeRow['direction']): string {
  switch (direction) {
    case 'down':
      return '↓'
    case 'up':
      return '↑'
    default:
      return '→'
  }
}

function directionTextClass(direction: TrendChangeRow['direction']): string {
  switch (direction) {
    case 'down':
      return 'text-blue-600'
    case 'up':
      return 'text-rose-500'
    default:
      return 'text-slate-400'
  }
}
</script>

<template>
  <section class="grid gap-4">
    <article class="radar-panel-strong p-4 md:p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.05em] text-slate-950">
          价格轨迹
        </h2>

        <a
          v-if="props.storeUrl"
          :href="props.storeUrl"
          target="_blank"
          rel="noreferrer"
          class="radar-button-secondary shrink-0 px-4 py-2.5"
        >
          打开 App Store
        </a>
      </div>

      <template v-if="lowestPoint">
        <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <article class="min-w-0 rounded-[1rem] border border-orange-200 bg-orange-50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
            <p class="text-xs tracking-[0.16em] text-slate-500">
              历史最低价
            </p>
            <div class="mt-3">
              <AppDetailMoneyDisplay
                :value="lowestPoint.price"
                :currency="lowestPoint.currency"
                size="hero"
                tone="orange"
              />
            </div>
            <p class="mt-2 text-sm text-slate-600">
              {{ formatDate(lowestPoint.time) }}
            </p>
          </article>

          <article
            v-if="showStandaloneCurrentPrice && latestPoint"
            class="min-w-0 rounded-[1rem] border border-blue-200 bg-white/92 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]"
          >
            <p class="text-xs tracking-[0.16em] text-slate-500">
              当前价格
            </p>
            <div class="mt-3">
              <AppDetailMoneyDisplay
                :value="latestPoint.price"
                :currency="latestPoint.currency"
                size="hero"
                tone="blue"
              />
            </div>
            <p class="mt-2 text-sm text-slate-600">
              {{ props.snapshot?.updatedAt ? `最近快照：${formatDateTime(props.snapshot.updatedAt)}` : '暂无快照时间' }}
            </p>
          </article>
        </div>
      </template>

      <div
        v-else
        class="radar-empty mt-5 px-4 py-4 text-sm"
      >
        暂无价格记录。
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <article class="min-w-0 rounded-[0.95rem] border border-slate-200/80 bg-blue-50 p-4">
          <p class="text-sm font-medium tracking-[0.08em] text-slate-500">
            一年内最低价
          </p>
          <div class="mt-2">
            <AppDetailMoneyDisplay
              :value="oneYearLowestPoint?.price ?? null"
              :currency="oneYearLowestPoint?.currency ?? 'USD'"
              size="card"
              tone="default"
              placeholder="-"
            />
          </div>
          <p class="mt-2 text-sm text-slate-500">
            {{ oneYearLowestPoint ? formatDate(oneYearLowestPoint.time) : '一年内暂无价格记录' }}
          </p>
        </article>

        <article class="min-w-0 rounded-[0.95rem] border border-slate-200/80 bg-white p-4">
          <p class="text-sm font-medium tracking-[0.08em] text-slate-500">
            历史价格区间
          </p>
          <div v-if="lowestPoint" class="mt-2 flex flex-wrap items-end gap-2">
            <span class="text-sm font-medium text-slate-500">最低</span>
            <AppDetailMoneyDisplay
              :value="lowestPoint.price"
              :currency="lowestPoint.currency"
              size="inline"
              tone="orange"
            />
          </div>
          <strong v-else class="mt-2 block text-base font-semibold leading-8 text-slate-950">
            暂无最低价
          </strong>
          <p class="mt-2 text-sm text-slate-500">
            <template v-if="highestPoint">
              最高
              <AppDetailMoneyDisplay
                class="ml-2"
                :value="highestPoint.price"
                :currency="highestPoint.currency"
                size="inline"
                tone="default"
              />
            </template>
            <template v-else>
              暂无历史高点
            </template>
          </p>
        </article>

        <article class="min-w-0 rounded-[0.95rem] border border-slate-200/80 bg-white p-4">
          <p class="text-sm font-medium tracking-[0.08em] text-slate-500">
            最近一次变价
          </p>
          <div v-if="latestChange" class="mt-2 flex flex-wrap items-end gap-2 text-slate-950">
            <AppDetailMoneyDisplay
              :value="latestChange.oldAmount"
              :currency="latestChange.currency"
              size="inline"
              tone="default"
            />
            <span class="text-sm font-medium text-slate-400">→</span>
            <AppDetailMoneyDisplay
              :value="latestChange.newAmount"
              :currency="latestChange.currency"
              size="inline"
              :tone="latestChange.direction === 'down' ? 'blue' : latestChange.direction === 'up' ? 'orange' : 'default'"
            />
          </div>
          <strong v-else class="mt-2 block text-base font-semibold leading-7 text-slate-950">
            暂无变价记录
          </strong>
          <p class="mt-2 text-sm text-slate-500">
            {{ latestChange ? formatDate(latestChange.time) : '暂无最近变价时间' }}
          </p>
        </article>

        <article class="min-w-0 rounded-[0.95rem] border border-blue-100 bg-[linear-gradient(145deg,#eff6ff,#dbeafe)] p-4 text-slate-950">
          <p class="text-sm font-medium tracking-[0.08em] text-slate-500">
            变价记录
          </p>
          <strong class="radar-display mt-2 block text-3xl text-blue-700">
            {{ props.summary.totalChanges }}
          </strong>
          <p class="mt-2 text-sm text-slate-600">
            已加载 {{ props.history.length }} / {{ props.summary.totalChanges }} 条
          </p>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/70">
            <div
              class="h-full rounded-full bg-gradient-to-r from-blue-500 to-orange-400"
              :style="{ width: `${Math.max(loadProgress, props.history.length > 0 ? 12 : 0)}%` }"
            />
          </div>
        </article>
      </div>
    </article>

    <article class="radar-panel p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <h3 class="font-['Space_Grotesk'] text-xl font-bold tracking-[-0.04em] text-slate-950">
          价格变动记录
        </h3>
        <span class="radar-chip border-slate-200 bg-slate-50 text-slate-600 shadow-none">
          当前价格 {{ currentPriceCardValue }}
        </span>
      </div>

      <div
        v-if="orderedChanges.length === 0"
        class="radar-empty mt-4 px-4 py-4 text-sm"
      >
        当前范围内暂无变价记录。
      </div>

      <ul v-else class="mt-4 space-y-3">
        <li
          v-for="row in orderedChanges"
          :key="row.id"
          class="grid gap-3 rounded-[0.95rem] border border-slate-200/80 bg-slate-50/82 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
        >
          <div class="flex items-center gap-3">
            <span
              class="inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg font-semibold leading-none"
              :class="{
                'border-blue-200 bg-blue-50 text-blue-600': row.direction === 'down',
                'border-rose-200 bg-rose-50 text-rose-500': row.direction === 'up',
                'border-slate-200 bg-white text-slate-400': row.direction === 'flat',
              }"
            >
              {{ directionSymbol(row.direction) }}
            </span>
            <div class="min-w-0">
              <p class="min-w-0">
                <span class="flex flex-wrap items-end gap-2 text-slate-700">
                  <AppDetailMoneyDisplay
                    :value="row.oldAmount"
                    :currency="row.currency"
                    size="inline"
                    tone="default"
                  />
                  <span class="text-sm font-medium text-slate-300">→</span>
                  <AppDetailMoneyDisplay
                    :value="row.newAmount"
                    :currency="row.currency"
                    size="inline"
                    :tone="row.direction === 'down' ? 'blue' : row.direction === 'up' ? 'orange' : 'default'"
                  />
                </span>
              </p>
              <p class="text-sm" :class="directionTextClass(row.direction)">
                {{ row.direction === 'down' ? '价格下降' : row.direction === 'up' ? '价格上调' : '价格未变' }}
              </p>
            </div>
          </div>

          <p class="metric-mono text-base text-slate-500 md:text-right">
            {{ formatDate(row.time) }}
          </p>
        </li>
      </ul>

      <div class="mt-4 flex justify-end">
        <button
          v-if="props.canLoadMore"
          type="button"
          class="radar-button-primary"
          :disabled="props.loadingMore"
          @click="emit('loadMore')"
        >
          {{ props.loadingMore ? '加载中...' : '加载更多记录' }}
        </button>
      </div>
    </article>
  </section>
</template>
