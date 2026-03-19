<script setup lang="ts">
import type {
  AppSnapshotDto,
  PriceChangeEventDto,
  PriceHistorySummaryDto,
  PriceHistoryWindow,
} from '@appstore-price-radar/contracts'
import { computed } from 'vue'
import { formatDate, formatDateTime, formatMoney } from '../../../lib/format'

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
  deltaAmount: number
}

interface WindowOption {
  value: PriceHistoryWindow
  label: string
  lowestLabel: string
}

const props = defineProps<{
  snapshot: AppSnapshotDto | null
  history: PriceChangeEventDto[]
  summary: PriceHistorySummaryDto
  selectedWindow: PriceHistoryWindow
  loadingMore: boolean
  canLoadMore: boolean
}>()

const emit = defineEmits<{
  changeWindow: [window: PriceHistoryWindow]
  loadMore: []
}>()

const WINDOW_OPTIONS: WindowOption[] = [
  { value: '30d', label: '30 天', lowestLabel: '30 天内最低价' },
  { value: '90d', label: '90 天', lowestLabel: '90 天内最低价' },
  { value: '1y', label: '1 年', lowestLabel: '一年内最低价' },
  { value: 'all', label: '全部', lowestLabel: '历史最低价' },
]

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

const dropFromPeakPct = computed<number | null>(() => {
  const current = latestPoint.value
  const highest = highestPoint.value

  if (!current || !highest || highest.price <= 0) {
    return null
  }

  return ((highest.price - current.price) / highest.price) * 100
})

const selectedWindowOption = computed(() => {
  return WINDOW_OPTIONS.find(option => option.value === props.selectedWindow) ?? WINDOW_OPTIONS[2]
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
      deltaAmount: Math.abs(item.newAmount - item.oldAmount),
    }))
})

const latestChange = computed(() => {
  return orderedChanges.value[0] ?? null
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

function directionClass(direction: TrendChangeRow['direction']): string {
  switch (direction) {
    case 'down':
      return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
    case 'up':
      return 'bg-rose-100 text-rose-700 ring-1 ring-rose-200'
    default:
      return 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200'
  }
}

function changeSummaryText(row: TrendChangeRow): string {
  if (row.direction === 'flat') {
    return '价格未变化'
  }

  const prefix = row.direction === 'down' ? '较上次降低' : '较上次提高'
  return `${prefix} ${formatMoney(row.deltaAmount, row.currency)}`
}

function percentText(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }

  return `${value.toFixed(2)}%`
}
</script>

<template>
  <section class="reveal reveal-delay-1 mt-4 rounded-[2rem] border border-zinc-200/70 bg-white/92 p-5 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-6">
    <div class="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
      <article class="overflow-hidden rounded-[1.8rem] border border-zinc-200/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),linear-gradient(145deg,rgba(250,250,249,0.96),rgba(244,244,245,0.92))] p-5">
        <p class="metric-mono text-xs tracking-[0.18em] text-zinc-500">
          PRICE TREND
        </p>
        <h2 class="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">
          {{ selectedWindowOption.lowestLabel }}
        </h2>

        <template v-if="lowestPoint">
          <p class="metric-mono mt-5 text-3xl font-semibold text-rose-500 md:text-4xl">
            {{ formatMoney(lowestPoint.price, lowestPoint.currency) }}
            <span class="ml-2 text-lg font-medium text-zinc-500 md:text-xl">
              ({{ formatDate(lowestPoint.time) }})
            </span>
          </p>

          <p class="mt-6 text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl">
            最低入手价浮动记录
          </p>
        </template>

        <div
          v-else
          class="mt-5 rounded-[1.4rem] border border-dashed border-zinc-300 bg-white/75 px-4 py-4 text-sm text-zinc-500"
        >
          当前还没有可展示的价格轨迹。
        </div>
      </article>

      <div class="grid gap-3 sm:grid-cols-2">
        <article class="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4">
          <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            当前价格
          </p>
          <strong class="metric-mono mt-2 block text-2xl text-zinc-900">
            {{ latestPoint ? formatMoney(latestPoint.price, latestPoint.currency) : '-' }}
          </strong>
          <p class="mt-2 text-xs text-zinc-500">
            {{ props.snapshot?.updatedAt ? `最近快照：${formatDateTime(props.snapshot.updatedAt)}` : '暂无快照时间' }}
          </p>
        </article>

        <article class="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4">
          <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            最近一次变化
          </p>
          <strong class="mt-2 block text-base font-semibold text-zinc-900">
            {{ latestChange ? `${formatMoney(latestChange.oldAmount, latestChange.currency)} → ${formatMoney(latestChange.newAmount, latestChange.currency)}` : '暂无变化事件' }}
          </strong>
          <p class="mt-2 text-xs text-zinc-500">
            {{ latestChange ? formatDateTime(latestChange.time) : '等待后续价格更新' }}
          </p>
        </article>

        <article class="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4">
          <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            累计变化事件
          </p>
          <strong class="metric-mono mt-2 block text-2xl text-zinc-900">
            {{ props.summary.totalChanges }}
          </strong>
          <p class="mt-2 text-xs text-zinc-500">
            已加载 {{ props.history.length }} / {{ props.summary.totalChanges }} 条
          </p>
        </article>

        <article class="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4">
          <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            距历史高点
          </p>
          <strong class="metric-mono mt-2 block text-2xl text-emerald-700">
            {{ percentText(dropFromPeakPct) }}
          </strong>
          <p class="mt-2 text-xs text-zinc-500">
            {{ highestPoint ? `历史高点：${formatMoney(highestPoint.price, highestPoint.currency)}` : '暂无高点数据' }}
          </p>
        </article>
      </div>
    </div>

    <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-lg font-semibold tracking-tight text-zinc-900">
          历史趋势与变化明细
        </h3>
        <p class="mt-1 text-sm text-zinc-600">
          {{ selectedWindowOption.label }}窗口，最近变化：{{ props.summary.latestChangeAt ? formatDateTime(props.summary.latestChangeAt) : '暂无' }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in WINDOW_OPTIONS"
          :key="option.value"
          type="button"
          class="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.08em] transition duration-300"
          :class="props.selectedWindow === option.value ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900'"
          :disabled="props.loadingMore"
          @click="emit('changeWindow', option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div
      v-if="orderedChanges.length === 0"
      class="mt-4 rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/70 px-4 py-4 text-sm text-zinc-500"
    >
      当前窗口暂无历史变化事件。
    </div>

    <ul v-else class="mt-4 divide-y divide-zinc-200/80 overflow-hidden rounded-[1.6rem] border border-zinc-200/80 bg-zinc-50/60">
      <li
        v-for="row in orderedChanges"
        :key="row.id"
        class="grid gap-3 px-4 py-4 md:grid-cols-[auto_1fr_auto] md:items-center md:px-5"
      >
        <span
          class="grid h-10 w-10 place-items-center rounded-2xl text-lg font-semibold"
          :class="directionClass(row.direction)"
        >
          {{ directionSymbol(row.direction) }}
        </span>

        <div class="min-w-0">
          <p class="metric-mono text-lg font-medium text-zinc-800">
            {{ formatMoney(row.oldAmount, row.currency) }} -> {{ formatMoney(row.newAmount, row.currency) }}
          </p>
          <p class="mt-1 text-sm text-zinc-500">
            {{ changeSummaryText(row) }}
          </p>
        </div>

        <p class="metric-mono text-sm text-zinc-500 md:text-base">
          {{ formatDate(row.time) }}
        </p>
      </li>
    </ul>

    <div class="mt-4 flex justify-end">
      <button
        v-if="props.canLoadMore"
        type="button"
        class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="props.loadingMore"
        @click="emit('loadMore')"
      >
        {{ props.loadingMore ? '加载中...' : '加载更多记录' }}
      </button>
    </div>
  </section>
</template>
