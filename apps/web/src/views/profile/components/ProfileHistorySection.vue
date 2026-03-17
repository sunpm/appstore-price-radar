<script setup lang="ts">
import type { HistoryPayload, SelectedSubscription } from '../types'
import { computed } from 'vue'

interface DailyPoint {
  day: string
  price: number
  currency: string
  sampleCount: number
  fetchedAt: string
}

type ChartPoint = DailyPoint & {
  x: number
  y: number
}

type DailyRow = ChartPoint & {
  dayChangePct: number | null
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

function dayKey(iso: string): string {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dayLabel(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString()
}

function toPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-'
  }

  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function onTargetPriceInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  historyTargetPrice.value = value
}

const dailySeries = computed<DailyPoint[]>(() => {
  const raw = props.selectedHistory?.history ?? []

  if (raw.length === 0) {
    return []
  }

  const byDay = new Map<string, DailyPoint>()

  for (const row of raw) {
    const key = dayKey(row.fetchedAt)
    const price = Number(row.price)
    const existing = byDay.get(key)

    if (!existing) {
      byDay.set(key, {
        day: key,
        price,
        currency: row.currency,
        sampleCount: 1,
        fetchedAt: row.fetchedAt,
      })
      continue
    }

    existing.sampleCount += 1

    if (price < existing.price) {
      existing.price = price
      existing.currency = row.currency
    }

    if (new Date(row.fetchedAt).getTime() > new Date(existing.fetchedAt).getTime()) {
      existing.fetchedAt = row.fetchedAt
    }
  }

  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day))
})

const chartGeometry = computed(() => {
  const list = dailySeries.value

  if (list.length === 0) {
    return {
      path: '',
      points: [] as ChartPoint[],
      min: 0,
      max: 0,
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
    min,
    max,
  }
})

const lowestMarker = computed<ChartPoint | null>(() => {
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

const currentPoint = computed<ChartPoint | null>(() => {
  const points = chartGeometry.value.points
  return points.length === 0 ? null : points.at(-1)
})

const highestPoint = computed<ChartPoint | null>(() => {
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

const firstPoint = computed<ChartPoint | null>(() => {
  const points = chartGeometry.value.points
  return points.length === 0 ? null : points[0]
})

const dropFromHighestPct = computed<number | null>(() => {
  const current = currentPoint.value
  const highest = highestPoint.value

  if (!current || !highest || highest.price <= 0) {
    return null
  }

  return ((highest.price - current.price) / highest.price) * 100
})

const dropFromFirstPct = computed<number | null>(() => {
  const current = currentPoint.value
  const first = firstPoint.value

  if (!current || !first || first.price <= 0) {
    return null
  }

  return ((first.price - current.price) / first.price) * 100
})

const historyCurrency = computed<string>(() => {
  return (
    props.selectedHistory?.snapshot?.currency ?? currentPoint.value?.currency ?? lowestMarker.value?.currency ?? 'USD'
  )
})

const selectedTargetRule = computed<string>(() => {
  if (!props.selectedSubscription) {
    return '请先在右侧任务列表中选择一个应用并查看趋势。'
  }

  return props.targetRuleText(props.selectedSubscription.targetPrice, props.selectedSubscription.currency ?? historyCurrency.value)
})

const dailyRows = computed<DailyRow[]>(() => {
  const points = chartGeometry.value.points

  return points
    .map((point, index) => {
      if (index === 0) {
        return {
          ...point,
          dayChangePct: null,
        }
      }

      const previous = points[index - 1]
      const dayChangePct = previous.price > 0 ? ((point.price - previous.price) / previous.price) * 100 : null

      return {
        ...point,
        dayChangePct,
      }
    })
    .reverse()
})

function dayChangeClass(value: number | null): string {
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
</script>

<template>
  <section
    class="reveal reveal-delay-2 mt-4 rounded-[2rem] border border-zinc-200/70 bg-white/92 p-5 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-6"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-semibold tracking-tight text-zinc-900">
        价格趋势分析（按日最低价聚合）
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
        <form class="grid w-full gap-2 sm:grid-cols-[1fr_auto] lg:w-auto" @submit.prevent="emit('saveTargetPrice')">
          <input
            :value="historyTargetPrice"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="设置目标价格，留空表示任意降价"
            class="w-full min-w-[240px] rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            :disabled="!props.selectedSubscription || props.updatingHistoryTarget"
            @input="onTargetPriceInput"
          >
          <button
            class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            :disabled="!props.selectedSubscription || props.updatingHistoryTarget"
          >
            {{ props.updatingHistoryTarget ? '保存中...' : '更新规则' }}
          </button>
        </form>
      </div>
      <p class="mt-2 text-xs text-zinc-500">
        可在此直接更新当前应用的通知阈值，规则为“当前价 &lt;= 目标价格”。
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
      v-else-if="dailySeries.length === 0"
      class="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-4 text-sm font-medium text-zinc-500"
    >
      暂无可用历史数据。
    </div>

    <div v-else class="mt-4">
      <div class="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-3">
          <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            最新价（日聚合）
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
            相对首日降幅
          </p>
          <strong class="metric-mono mt-2 block text-lg text-emerald-700">{{ toPercent(dropFromFirstPct) }}</strong>
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
                日期
              </th>
              <th class="sticky top-0 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
                当日最低价
              </th>
              <th class="sticky top-0 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
                日变动
              </th>
              <th class="sticky top-0 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
                采样次数
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in dailyRows" :key="`${row.day}-${row.price}`" class="border-b border-zinc-100">
              <td class="px-3 py-2">
                {{ dayLabel(row.day) }}
              </td>
              <td class="px-3 py-2">
                {{ props.toMoney(row.price, row.currency) }}
              </td>
              <td class="px-3 py-2 font-medium" :class="[dayChangeClass(row.dayChangePct)]">
                {{ toPercent(row.dayChangePct) }}
              </td>
              <td class="metric-mono px-3 py-2">
                {{ row.sampleCount }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
