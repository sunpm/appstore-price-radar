<script setup lang="ts">
import type { AppDecisionStatsState } from '../types'
import { computed } from 'vue'
import { resolveAppStoreGenreLabel } from '../../../lib/app-store'
import { formatMoney } from '../../../lib/format'
import AppDetailMoneyDisplay from './AppDetailMoneyDisplay.vue'

interface DecisionStatCard {
  label: string
  value: string
  tone: string
  surface: string
  kind?: 'money'
  amount?: number | null
  currency?: string
}

const props = defineProps<{
  stats: AppDecisionStatsState
}>()

function toPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-'
  }

  return `${value.toFixed(2)}%`
}

const statCards = computed<DecisionStatCard[]>(() => {
  return [
    {
      label: '综合评分',
      value: props.stats.averageUserRating === null ? '-' : props.stats.averageUserRating.toFixed(1),
      tone: 'text-slate-950',
      surface: 'bg-white',
    },
    {
      label: '当前版本评分',
      value: props.stats.averageUserRatingForCurrentVersion === null ? '-' : props.stats.averageUserRatingForCurrentVersion.toFixed(1),
      tone: 'text-slate-950',
      surface: 'bg-white',
    },
    {
      label: '评价数',
      value: props.stats.userRatingCount === null ? '-' : props.stats.userRatingCount.toLocaleString(),
      tone: 'text-slate-950',
      surface: 'bg-white',
    },
    {
      label: '距高点跌幅',
      value: toPercent(props.stats.dropFromPeakPct),
      tone: props.stats.dropFromPeakPct === null ? 'text-slate-950' : 'text-orange-700',
      surface: 'bg-orange-50',
    },
    {
      label: '历史最低价',
      value: formatMoney(props.stats.lowestPrice, props.stats.currency),
      tone: 'text-blue-700',
      surface: 'bg-blue-50',
      kind: 'money',
      amount: props.stats.lowestPrice,
      currency: props.stats.currency,
    },
    {
      label: '分类',
      value: resolveAppStoreGenreLabel(props.stats.primaryGenreName) ?? '暂无',
      tone: 'text-slate-950',
      surface: 'bg-white',
    },
    {
      label: '累计变化事件',
      value: String(props.stats.totalChanges),
      tone: 'text-slate-950',
      surface: 'bg-white',
    },
  ]
})
</script>

<template>
  <section class="radar-panel p-4 md:p-5">
    <div class="flex items-end justify-between gap-3">
      <h2 class="font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-slate-950">
        价格与评分
      </h2>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article
        v-for="card in statCards"
        :key="card.label"
        class="rounded-[1rem] border border-slate-200/76 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]"
        :class="card.surface"
      >
        <p class="text-xs font-medium tracking-[0.16em] text-slate-500">
          {{ card.label }}
        </p>
        <AppDetailMoneyDisplay
          v-if="card.kind === 'money'"
          class="mt-2"
          :value="card.amount"
          :currency="card.currency"
          size="card"
          tone="blue"
          placeholder="-"
        />
        <strong v-else class="radar-display mt-2 block text-2xl" :class="card.tone">
          {{ card.value }}
        </strong>
      </article>
    </div>
  </section>
</template>
