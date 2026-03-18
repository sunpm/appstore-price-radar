<script setup lang="ts">
import type { AppChangeRow, AppDetailPayload, AppTrendPoint } from './types'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { formatDateTime, formatMoney } from '../../lib/format'
import { buildApiUrl, parseApiErrorText } from '../../lib/http'
import { useToast } from '../../lib/toast'

const COUNTRY_CODE_RE = /^[A-Z]{2}$/

const route = useRoute()
const toast = useToast()
const loading = ref(false)
const errorText = ref('')
const detail = ref<AppDetailPayload | null>(null)

const appId = computed<string>(() => {
  const raw = route.params.appId
  return typeof raw === 'string' ? raw.trim() : ''
})

const country = computed<string>(() => {
  const raw = route.params.country
  const value = typeof raw === 'string' ? raw.trim().toUpperCase() : 'US'
  return COUNTRY_CODE_RE.test(value) ? value : 'US'
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

  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
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

async function loadDetail(): Promise<void> {
  if (!appId.value) {
    errorText.value = '应用 ID 无效。'
    detail.value = null
    return
  }

  loading.value = true
  errorText.value = ''

  try {
    const res = await fetch(
      buildApiUrl(`/api/prices/${encodeURIComponent(appId.value)}?country=${country.value}&limit=3650`),
    )

    if (!res.ok) {
      throw new Error(await parseApiErrorText(res))
    }

    detail.value = (await res.json()) as AppDetailPayload
  }
  catch (error) {
    detail.value = null
    errorText.value = error instanceof Error ? error.message : '详情加载失败，请稍后重试。'
  }
  finally {
    loading.value = false
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
  const history = detail.value?.history ?? []

  if (history.length === 0) {
    const snapshot = detail.value?.snapshot

    if (!snapshot) {
      return []
    }

    return [{
      key: 'snapshot-only',
      time: snapshot.updatedAt,
      price: snapshot.lastPrice,
      currency: snapshot.currency,
    }]
  }

  const first = history[0]
  const points: AppTrendPoint[] = [{
    key: `baseline-${first.id}`,
    time: first.changedAt,
    price: first.oldAmount,
    currency: first.currency,
  }]

  for (const item of history) {
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

const storeUrl = computed(() => detail.value?.snapshot?.storeUrl ?? null)
const iconUrl = computed(() => detail.value?.snapshot?.iconUrl ?? null)

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
      <header class="reveal rounded-[2rem] border border-zinc-200/70 bg-white/92 p-5 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-6">
        <RouterLink
          :to="{ name: 'home' }"
          class="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-400"
        >
          返回市场动态
        </RouterLink>

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <img
            v-if="iconUrl"
            :src="iconUrl"
            :alt="appTitle"
            class="h-16 w-16 rounded-2xl border border-zinc-200 object-cover"
          >
          <div
            v-else
            class="grid h-16 w-16 place-items-center rounded-2xl border border-zinc-200 bg-zinc-50 text-xs font-semibold tracking-[0.16em] text-zinc-500"
          >
            APP
          </div>

          <div class="min-w-0">
            <p class="metric-mono text-xs tracking-[0.18em] text-zinc-500">
              APP DETAIL
            </p>
            <h1 class="truncate text-2xl font-semibold tracking-tight text-zinc-900">
              {{ appTitle }}
            </h1>
            <p class="mt-1 text-sm text-zinc-600">
              appId: {{ appId }} · 国家/地区：{{ country }}
            </p>
          </div>

          <a
            v-if="storeUrl"
            :href="storeUrl"
            target="_blank"
            rel="noreferrer"
            class="ml-auto inline-flex items-center rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-400"
          >
            打开 App Store
          </a>
        </div>
      </header>

      <section v-if="loading" class="mt-4 grid gap-3">
        <div class="skeleton-box h-24 rounded-2xl" />
        <div class="skeleton-box h-48 rounded-2xl" />
      </section>

      <p v-else-if="errorText" class="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
        {{ errorText }}
      </p>

      <section
        v-else-if="detail"
        class="reveal reveal-delay-1 mt-4 rounded-[2rem] border border-zinc-200/70 bg-white/92 p-5 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-6"
      >
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article class="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-3">
            <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
              当前价格
            </p>
            <strong class="metric-mono mt-2 block text-lg text-zinc-900">{{ toMoney(currentPoint?.price, historyCurrency) }}</strong>
          </article>
          <article class="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-3">
            <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
              历史最低
            </p>
            <strong class="metric-mono mt-2 block text-lg text-zinc-900">{{ toMoney(lowestPoint?.price, historyCurrency) }}</strong>
          </article>
          <article class="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-3">
            <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
              相对峰值降幅
            </p>
            <strong class="metric-mono mt-2 block text-lg text-emerald-700">{{ toPercent(dropFromPeakPct) }}</strong>
          </article>
          <article class="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-3">
            <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
              变化事件数
            </p>
            <strong class="metric-mono mt-2 block text-lg text-zinc-900">{{ detail.history.length }}</strong>
          </article>
        </div>

        <p class="mt-3 text-xs text-zinc-500">
          最近快照时间：{{ detail.snapshot ? toTime(detail.snapshot.updatedAt) : '暂无快照' }}，仅在价格变化时写入历史事件。
        </p>

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
      </section>
    </div>
  </main>
</template>
