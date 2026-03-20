<script setup lang="ts">
import type {
  AppSnapshotDto,
  PriceChangeEventDto,
  PriceHistorySummaryDto,
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
      return 'text-teal-500'
    case 'up':
      return 'text-rose-500'
    default:
      return 'text-zinc-400'
  }
}
</script>

<template>
  <section class="reveal reveal-delay-1 rounded-[2rem] border border-zinc-200/70 bg-white/92 p-4 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-5">
    <article class="rounded-[1.7rem] border border-zinc-200/80 bg-white p-5 shadow-[0_18px_36px_-26px_rgba(15,23,42,0.26)]">
      <p class="text-center text-[1.7rem] font-semibold tracking-tight text-zinc-800">
        App Store 下载
      </p>
      <p class="mt-2 text-center text-sm text-zinc-500">
        {{ props.storePlatformLabel }}
      </p>

      <a
        v-if="props.storeUrl"
        :href="props.storeUrl"
        target="_blank"
        rel="noreferrer"
        class="mt-5 inline-flex h-14 w-full items-center justify-center rounded-full bg-[#ffd84f] px-5 text-xl font-medium text-zinc-900 shadow-[0_18px_32px_-22px_rgba(250,204,21,0.9)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#ffcf2d] active:translate-y-[1px]"
      >
        前往 App Store
      </a>

      <div
        v-else
        class="mt-5 rounded-[1.3rem] border border-dashed border-zinc-300 bg-zinc-50 px-4 py-4 text-center text-sm text-zinc-500"
      >
        暂无 App Store 链接
      </div>
    </article>

    <article class="mt-4 overflow-hidden rounded-[1.7rem] border border-zinc-200/80 bg-[radial-gradient(circle_at_top_left,rgba(255,214,10,0.14),transparent_36%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(249,250,251,0.92))] p-5">
      <div class="flex flex-col gap-4">
        <div>
          <p class="text-sm font-medium tracking-[0.12em] text-zinc-500">
            价格历史
          </p>
          <h2 class="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
            历史最低价
          </h2>
        </div>
      </div>

      <template v-if="lowestPoint">
        <p class="metric-mono mt-6 text-[2.4rem] font-semibold text-rose-500">
          {{ formatMoney(lowestPoint.price, lowestPoint.currency) }}
        </p>
        <p class="mt-2 text-base text-zinc-500">
          {{ formatDate(lowestPoint.time) }}
        </p>

        <div
          v-if="showStandaloneCurrentPrice && latestPoint"
          class="mt-5 rounded-[1.35rem] border border-zinc-200/80 bg-white/90 p-4"
        >
          <p class="text-sm font-medium tracking-[0.08em] text-zinc-500">
            当前价格
          </p>
          <strong class="metric-mono mt-2 block text-2xl text-zinc-900">
            {{ formatMoney(latestPoint.price, latestPoint.currency) }}
          </strong>
          <p class="mt-2 text-sm text-zinc-500">
            {{ props.snapshot?.updatedAt ? `最近快照：${formatDateTime(props.snapshot.updatedAt)}` : '暂无快照时间' }}
          </p>
        </div>
      </template>

      <div
        v-else
        class="mt-5 rounded-[1.4rem] border border-dashed border-zinc-300 bg-white/75 px-4 py-4 text-sm text-zinc-500"
      >
        暂无价格记录。
      </div>

      <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <article class="rounded-[1.35rem] border border-zinc-200/80 bg-white/90 p-4">
          <p class="text-sm font-medium tracking-[0.08em] text-zinc-500">
            一年内最低价
          </p>
          <strong class="metric-mono mt-2 block text-2xl text-zinc-900">
            {{ oneYearLowestPoint ? formatMoney(oneYearLowestPoint.price, oneYearLowestPoint.currency) : '-' }}
          </strong>
          <p class="mt-2 text-sm text-zinc-500">
            {{ oneYearLowestPoint ? formatDate(oneYearLowestPoint.time) : '一年内暂无价格记录' }}
          </p>
        </article>

        <article class="rounded-[1.35rem] border border-zinc-200/80 bg-white/90 p-4">
          <p class="text-sm font-medium tracking-[0.08em] text-zinc-500">
            历史价格区间
          </p>
          <strong class="mt-2 block text-base font-semibold leading-8 text-zinc-900">
            {{ lowestPoint ? `最低 ${formatMoney(lowestPoint.price, lowestPoint.currency)}` : '暂无最低价' }}
          </strong>
          <p class="mt-2 text-sm text-zinc-500">
            {{ highestPoint ? `最高 ${formatMoney(highestPoint.price, highestPoint.currency)}` : '暂无历史高点' }}
          </p>
        </article>

        <article class="rounded-[1.35rem] border border-zinc-200/80 bg-white/90 p-4">
          <p class="text-sm font-medium tracking-[0.08em] text-zinc-500">
            最近一次变价
          </p>
          <strong class="mt-2 block text-base font-semibold leading-7 text-zinc-900">
            {{ latestChange ? `${formatMoney(latestChange.oldAmount, latestChange.currency)} -> ${formatMoney(latestChange.newAmount, latestChange.currency)}` : '暂无变价记录' }}
          </strong>
          <p class="mt-2 text-sm text-zinc-500">
            {{ latestChange ? formatDate(latestChange.time) : '暂无最近变价时间' }}
          </p>
        </article>

        <article class="rounded-[1.35rem] border border-zinc-200/80 bg-white/90 p-4">
          <p class="text-sm font-medium tracking-[0.08em] text-zinc-500">
            变价记录
          </p>
          <strong class="metric-mono mt-2 block text-2xl text-zinc-900">
            {{ props.summary.totalChanges }}
          </strong>
          <p class="mt-2 text-sm text-zinc-500">
            已加载 {{ props.history.length }} / {{ props.summary.totalChanges }} 条
          </p>
        </article>
      </div>
    </article>

    <article class="mt-4 rounded-[1.7rem] border border-zinc-200/80 bg-white p-5 shadow-[0_18px_36px_-26px_rgba(15,23,42,0.22)]">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-xl font-semibold tracking-tight text-zinc-900">
            价格变动记录
          </h3>
          <p class="mt-1 text-sm text-zinc-500">
            {{ props.summary.latestChangeAt ? `最近更新：${formatDateTime(props.summary.latestChangeAt)}` : '暂无变价记录' }}
          </p>
        </div>
      </div>

      <div
        v-if="orderedChanges.length === 0"
        class="mt-4 rounded-[1.4rem] border border-dashed border-zinc-300 bg-zinc-50/70 px-4 py-4 text-sm text-zinc-500"
      >
        当前范围内暂无变价记录。
      </div>

      <ul v-else class="mt-4 space-y-3">
        <li
          v-for="row in orderedChanges"
          :key="row.id"
          class="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-[1.2rem] border border-zinc-200/80 bg-zinc-50/70 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
        >
          <span
            class="text-2xl font-semibold leading-none"
            :class="directionTextClass(row.direction)"
          >
            {{ directionSymbol(row.direction) }}
          </span>

          <p class="metric-mono min-w-0 text-lg leading-8 text-zinc-700">
            {{ formatMoney(row.oldAmount, row.currency) }} -> {{ formatMoney(row.newAmount, row.currency) }}
          </p>

          <p class="metric-mono text-base text-zinc-500 md:text-right">
            {{ formatDate(row.time) }}
          </p>
        </li>
      </ul>

      <div class="mt-4 flex justify-end">
        <button
          v-if="props.canLoadMore"
          type="button"
          class="inline-flex items-center justify-center rounded-full border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="props.loadingMore"
          @click="emit('loadMore')"
        >
          {{ props.loadingMore ? '加载中...' : '加载更多记录' }}
        </button>
      </div>
    </article>
  </section>
</template>
