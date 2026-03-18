<script setup lang="ts">
import type { HistoryPayload, SelectedSubscription } from '../types'
import { computed } from 'vue'

interface TrendPoint {
  key: string
  occurredAt: string
  price: number
  currency: string
}

interface ChangeRow {
  id: number
  occurredAt: string
  oldAmount: number
  newAmount: number
  currency: string
  source: string
  changePct: number | null
}

const props = defineProps<{
  selectedHistory: HistoryPayload | null
  selectedSubscription: SelectedSubscription | null
  selectedAppLabel: string
  updatingHistoryTarget: boolean
  loadingHistory: boolean
  targetRuleText: (targetPrice: number | null, currency?: string) => string
  toMoney: (value: number | null | undefined, currency?: string) => string
}>()

const emit = defineEmits<{
  saveTargetPrice: []
}>()

const historyTargetPrice = defineModel<string>('historyTargetPrice', { required: true })

function toPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-'
  }

  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function toTime(value: string): string {
  return new Date(value).toLocaleString()
}

function onTargetPriceInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  historyTargetPrice.value = value
}

const changeRows = computed<ChangeRow[]>(() => {
  const raw = props.selectedHistory?.history ?? []

  return raw
    .slice()
    .reverse()
    .map(row => ({
      id: row.id,
      occurredAt: row.changedAt,
      oldAmount: row.oldAmount,
      newAmount: row.newAmount,
      currency: row.currency,
      source: row.source,
      changePct: row.oldAmount > 0 ? ((row.newAmount - row.oldAmount) / row.oldAmount) * 100 : null,
    }))
})

const trendPoints = computed<TrendPoint[]>(() => {
  const raw = props.selectedHistory?.history ?? []

  if (raw.length === 0) {
    const snapshot = props.selectedHistory?.snapshot

    if (!snapshot) {
      return []
    }

    return [{
      key: 'snapshot-only',
      occurredAt: snapshot.updatedAt,
      price: snapshot.lastPrice,
      currency: snapshot.currency,
    }]
  }

  const first = raw[0]
  const points: TrendPoint[] = [{
    key: `baseline-${first.id}`,
    occurredAt: first.changedAt,
    price: first.oldAmount,
    currency: first.currency,
  }]

  for (const item of raw) {
    points.push({
      key: `change-${item.id}`,
      occurredAt: item.changedAt,
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
      points: [] as Array<TrendPoint & { x: number, y: number }>,
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

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ')

  return {
    path,
    points,
  }
})

const lowestMarker = computed(() => {
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

const currentPoint = computed(() => {
  const points = chartGeometry.value.points

  if (points.length === 0) {
    return null
  }

  return points.at(-1) ?? null
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

const dropFromHighestPct = computed<number | null>(() => {
  const current = currentPoint.value
  const highest = highestPoint.value

  if (!current || !highest || highest.price <= 0) {
    return null
  }

  return ((highest.price - current.price) / highest.price) * 100
})

const historyCurrency = computed<string>(() => {
  return props.selectedHistory?.snapshot?.currency ?? currentPoint.value?.currency ?? 'USD'
})

const selectedTargetRule = computed<string>(() => {
  if (!props.selectedSubscription) {
    return '请先在右侧任务列表中选择一个应用并查看趋势。'
  }

  return props.targetRuleText(props.selectedSubscription.targetPrice, props.selectedSubscription.currency ?? historyCurrency.value)
})

function changeClass(value: number | null): string {
  if (value === null || value === undefined) {
    return 'text-zinc-700'
  }

  if (value < 0) {
    return 'text-emerald-700'
  }

  if (value > 0) {
    return 'text-amber-700'
  }

  return 'text-zinc-700'
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'scheduled':
      return '定时任务'
    case 'manual':
      return '手动刷新'
    case 'migration':
      return '迁移数据'
    default:
      return source
  }
}
</script>

<template>
  <section
    class="reveal reveal-delay-2 mt-4 rounded-[2rem] border border-zinc-200/70 bg-white/92 p-5 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-6"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-semibold tracking-tight text-zinc-900">
        价格变化趋势（仅记录发生变化时）
      </h2>
      <p v-if="props.selectedHistory" class="text-sm text-zinc-500">
        {{ props.selectedAppLabel }}
      </p>
    </div>

    <div class="mt-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4">
      <div class="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p class="text-sm font-medium text-zinc-700">
            当前通知规则
          </p>
          <p class="mt-1 text-sm text-zinc-600">
            {{ selectedTargetRule }}
          </p>
        </div>
        <form class="grid w-full gap-2 sm:grid-cols-[minmax(20rem,1fr)_auto] lg:w-auto" @submit.prevent="emit('saveTargetPrice')">
          <input
            :value="historyTargetPrice"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="设置目标价格，留空表示任意降价"
            class="w-full min-w-0 sm:min-w-[320px] lg:min-w-[380px] rounded-xl border border-zinc-300/80 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            :disabled="!props.selectedSubscription || props.updatingHistoryTarget"
            @input="onTargetPriceInput"
          >
          <button
            class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            :disabled="!props.selectedSubscription || props.updatingHistoryTarget"
          >
            {{ props.updatingHistoryTarget ? '保存中...' : '更新规则' }}
          </button>
        </form>
      </div>
      <p class="mt-2 text-xs text-zinc-500">
        仅在观测到价格变化时写入事件，因此不会按天产生无意义记录。
      </p>
    </div>

    <div v-if="props.loadingHistory" class="mt-4 grid gap-3">
      <div class="skeleton-box h-28 rounded-2xl" />
      <div class="skeleton-box h-56 rounded-2xl" />
    </div>

    <div
      v-else-if="!props.selectedHistory"
      class="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-4 text-sm font-medium text-zinc-500"
    >
      请选择右侧任务并进入趋势视图，即可查看历史曲线与设置通知阈值。
    </div>

    <div
      v-else-if="trendPoints.length === 0"
      class="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-4 text-sm font-medium text-zinc-500"
    >
      暂无可用历史数据。
    </div>

    <div v-else class="mt-4">
      <div class="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-3">
          <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            最新价
          </p>
          <strong class="metric-mono mt-2 block text-lg text-zinc-900">{{ props.toMoney(currentPoint?.price, historyCurrency) }}</strong>
        </article>
        <article class="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-3">
          <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            历史最低价
          </p>
          <strong class="metric-mono mt-2 block text-lg text-zinc-900">{{ props.toMoney(lowestMarker?.price, historyCurrency) }}</strong>
        </article>
        <article class="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-3">
          <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            相对历史最高降幅
          </p>
          <strong class="metric-mono mt-2 block text-lg text-emerald-700">{{ toPercent(dropFromHighestPct) }}</strong>
        </article>
        <article class="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-3">
          <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            累计变化事件
          </p>
          <strong class="metric-mono mt-2 block text-lg text-zinc-900">{{ props.selectedHistory.history.length }}</strong>
        </article>
      </div>

      <svg
        class="h-40 w-full rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,rgba(16,185,129,0.08)_0%,rgba(255,255,255,0.9)_60%)]"
        viewBox="0 0 100 50"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#059669" />
            <stop offset="100%" stop-color="#0f766e" />
          </linearGradient>
        </defs>
        <path :d="chartGeometry.path" fill="none" stroke="url(#trendGradient)" stroke-width="1.8" />
        <circle v-if="lowestMarker" :cx="lowestMarker.x" :cy="lowestMarker.y" r="1.7" fill="#be123c" />
        <text
          v-if="lowestMarker"
          :x="Math.min(Math.max(lowestMarker.x + 2, 4), 92)"
          :y="Math.max(lowestMarker.y - 2, 6)"
          class="fill-rose-700 text-[3.3px] font-semibold"
        >
          LOW {{ props.toMoney(lowestMarker.price, historyCurrency) }}
        </text>
      </svg>

      <div class="mt-4 max-h-[360px] overflow-auto rounded-2xl border border-zinc-200">
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
                目前仅有最新快照，还没有出现价格变化事件。
              </td>
            </tr>
            <tr v-for="row in changeRows" :key="row.id" class="border-b border-zinc-100">
              <td class="px-3 py-2">
                {{ toTime(row.occurredAt) }}
              </td>
              <td class="px-3 py-2">
                {{ props.toMoney(row.oldAmount, row.currency) }} → {{ props.toMoney(row.newAmount, row.currency) }}
              </td>
              <td class="px-3 py-2 font-medium" :class="changeClass(row.changePct)">
                {{ toPercent(row.changePct) }}
              </td>
              <td class="px-3 py-2 text-zinc-600">
                {{ sourceLabel(row.source) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
