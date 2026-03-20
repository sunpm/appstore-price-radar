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
    <article class="radar-panel-strong p-4">
      <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-500">
        官方渠道
      </p>
      <h2 class="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.05em] text-slate-950">
        官方渠道下载
      </h2>
      <p class="mt-2 text-sm text-slate-600">
        {{ props.storePlatformLabel }}
      </p>

      <a
        v-if="props.storeUrl"
        :href="props.storeUrl"
        target="_blank"
        rel="noreferrer"
        class="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[0.9rem] bg-[#ffd84f] px-5 text-base font-semibold text-slate-950 shadow-[0_14px_24px_-18px_rgba(250,204,21,0.6)] transition duration-300 hover:bg-[#ffcf2d]"
      >
        官方渠道下载
      </a>

      <div
        v-else
        class="radar-empty mt-5 px-4 py-4 text-center text-sm"
      >
        暂无 App Store 官方链接
      </div>
    </article>

    <article class="radar-panel p-4">
      <div>
        <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-400">
          PRICE RANGE
        </p>
        <h2 class="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-slate-950">
          历史最低价
        </h2>
      </div>

      <template v-if="lowestPoint">
        <p class="radar-display mt-5 text-[2.45rem] font-semibold text-orange-600">
          {{ formatMoney(lowestPoint.price, lowestPoint.currency) }}
        </p>
        <p class="mt-2 text-base text-slate-500">
          {{ formatDate(lowestPoint.time) }}
        </p>

        <div
          v-if="showStandaloneCurrentPrice && latestPoint"
          class="mt-4 rounded-[1rem] border border-slate-200/80 bg-white p-4"
        >
          <p class="text-sm font-medium tracking-[0.08em] text-slate-500">
            当前价格
          </p>
          <strong class="radar-display mt-2 block text-3xl text-slate-950">
            {{ formatMoney(latestPoint.price, latestPoint.currency) }}
          </strong>
          <p class="mt-2 text-sm text-slate-500">
            {{ props.snapshot?.updatedAt ? `最近快照：${formatDateTime(props.snapshot.updatedAt)}` : '暂无快照时间' }}
          </p>
        </div>
      </template>

      <div
        v-else
        class="radar-empty mt-5 px-4 py-4 text-sm"
      >
        暂无价格轨迹
      </div>

      <div class="mt-4 grid gap-3">
        <article class="rounded-[0.95rem] border border-slate-200/80 bg-blue-50 p-4">
          <p class="text-sm font-medium tracking-[0.08em] text-slate-500">
            一年内最低价
          </p>
          <strong class="radar-display mt-2 block text-2xl text-slate-950">
            {{ oneYearLowestPoint ? formatMoney(oneYearLowestPoint.price, oneYearLowestPoint.currency) : '-' }}
          </strong>
          <p class="mt-2 text-sm text-slate-500">
            {{ oneYearLowestPoint ? formatDate(oneYearLowestPoint.time) : '一年内暂无价格记录' }}
          </p>
        </article>

        <article class="rounded-[0.95rem] border border-slate-200/80 bg-white p-4">
          <p class="text-sm font-medium tracking-[0.08em] text-slate-500">
            历史价格区间
          </p>
          <strong class="mt-2 block text-base font-semibold leading-8 text-slate-950">
            {{ lowestPoint ? `最低 ${formatMoney(lowestPoint.price, lowestPoint.currency)}` : '暂无最低价' }}
          </strong>
          <p class="mt-2 text-sm text-slate-500">
            {{ highestPoint ? `最高 ${formatMoney(highestPoint.price, highestPoint.currency)}` : '暂无历史高点' }}
          </p>
        </article>

        <article class="rounded-[0.95rem] border border-slate-200/80 bg-white p-4">
          <p class="text-sm font-medium tracking-[0.08em] text-slate-500">
            最近一次变化
          </p>
          <strong class="mt-2 block text-base font-semibold leading-7 text-slate-950">
            {{ latestChange ? `${formatMoney(latestChange.oldAmount, latestChange.currency)} -> ${formatMoney(latestChange.newAmount, latestChange.currency)}` : '暂无变化事件' }}
          </strong>
          <p class="mt-2 text-sm text-slate-500">
            {{ latestChange ? formatDate(latestChange.time) : '等待后续价格更新' }}
          </p>
        </article>

        <article class="rounded-[0.95rem] border border-blue-100 bg-[linear-gradient(145deg,#eff6ff,#dbeafe)] p-4 text-slate-950">
          <p class="text-sm font-medium tracking-[0.08em] text-slate-500">
            变价记录
          </p>
          <strong class="radar-display mt-2 block text-3xl text-blue-700">
            {{ props.summary.totalChanges }}
          </strong>
          <p class="mt-2 text-sm text-slate-600">
            已加载 {{ props.history.length }} / {{ props.summary.totalChanges }} 条
          </p>
        </article>
      </div>
    </article>

    <article class="radar-panel p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="font-['Space_Grotesk'] text-xl font-bold tracking-[-0.04em] text-slate-950">
            最低入手价浮动记录
          </h3>
          <p class="mt-1 text-sm text-slate-500">
            {{ props.summary.latestChangeAt ? `最近更新：${formatDateTime(props.summary.latestChangeAt)}` : '暂无变价记录' }}
          </p>
        </div>
      </div>

      <div
        v-if="orderedChanges.length === 0"
        class="radar-empty mt-4 px-4 py-4 text-sm"
      >
        当前窗口暂无历史变化事件。
      </div>

      <ul v-else class="mt-4 space-y-3">
        <li
          v-for="row in orderedChanges"
          :key="row.id"
          class="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-[0.9rem] border border-slate-200/80 bg-slate-50/82 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
        >
          <span
            class="text-2xl font-semibold leading-none"
            :class="directionTextClass(row.direction)"
          >
            {{ directionSymbol(row.direction) }}
          </span>

          <p class="metric-mono min-w-0 text-lg leading-8 text-slate-700">
            {{ formatMoney(row.oldAmount, row.currency) }} -> {{ formatMoney(row.newAmount, row.currency) }}
          </p>

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
