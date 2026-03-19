<script setup lang="ts">
import type { AppDecisionStatsState } from '../types'
import { computed } from 'vue'
import { formatMoney } from '../../../lib/format'

const props = defineProps<{
  stats: AppDecisionStatsState
}>()

function toPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-'
  }

  return `${value.toFixed(2)}%`
}

const statCards = computed(() => {
  return [
    {
      label: '综合评分',
      value: props.stats.averageUserRating === null ? '-' : props.stats.averageUserRating.toFixed(1),
      accent: 'text-zinc-900',
    },
    {
      label: '当前版本评分',
      value: props.stats.averageUserRatingForCurrentVersion === null ? '-' : props.stats.averageUserRatingForCurrentVersion.toFixed(1),
      accent: 'text-zinc-900',
    },
    {
      label: '评价数',
      value: props.stats.userRatingCount === null ? '-' : props.stats.userRatingCount.toLocaleString(),
      accent: 'text-zinc-900',
    },
    {
      label: '距高点跌幅',
      value: toPercent(props.stats.dropFromPeakPct),
      accent: props.stats.dropFromPeakPct === null ? 'text-zinc-900' : 'text-emerald-700',
    },
    {
      label: '历史最低价',
      value: formatMoney(props.stats.lowestPrice, props.stats.currency),
      accent: 'text-zinc-900',
    },
    {
      label: '分类',
      value: props.stats.primaryGenreName ?? '暂无',
      accent: 'text-zinc-900',
    },
    {
      label: '累计变化事件',
      value: String(props.stats.totalChanges),
      accent: 'text-zinc-900',
    },
  ]
})
</script>

<template>
  <section class="rounded-[2rem] border border-zinc-200/70 bg-white/92 p-5 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-6">
    <div>
      <div>
        <p class="metric-mono text-xs tracking-[0.18em] text-zinc-500">
          DECISION SIGNALS
        </p>
        <h2 class="mt-2 text-xl font-semibold tracking-tight text-zinc-900">
          购买决策信号
        </h2>
      </div>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="card in statCards"
        :key="card.label"
        class="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4"
      >
        <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
          {{ card.label }}
        </p>
        <strong class="metric-mono mt-2 block text-xl" :class="card.accent">
          {{ card.value }}
        </strong>
      </article>
    </div>
  </section>
</template>
