<script setup lang="ts">
import type { HomeFeedSummary } from '../types'
import { computed } from 'vue'

const props = defineProps<{
  summary: HomeFeedSummary
}>()

const lastUpdatedText = computed(() => {
  if (!props.summary.newestAt) {
    return '等待载入'
  }

  return new Date(props.summary.newestAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})

const statCards = computed(() => {
  return [
    {
      label: '公开降价事件',
      value: props.summary.total,
      tone: 'text-slate-950',
      valueTone: 'text-slate-950',
      surface: 'border-slate-200 bg-white/88',
    },
    {
      label: '覆盖应用数',
      value: props.summary.apps,
      tone: 'text-slate-950',
      valueTone: 'text-slate-950',
      surface: 'border-slate-200 bg-white/88',
    },
    {
      label: '最高降幅',
      value: `${props.summary.maxDrop.toFixed(2)}%`,
      tone: 'text-orange-900',
      valueTone: 'text-orange-700',
      surface: 'border-orange-200 bg-orange-50',
    },
  ]
})
</script>

<template>
  <article class="radar-panel reveal radar-grid-accent overflow-hidden">
    <div class="grid gap-5 p-5 md:p-6 xl:grid-cols-[minmax(0,1.12fr)_300px]">
      <div>
        <div class="flex flex-wrap gap-2">
          <span class="radar-chip border-blue-100 bg-blue-50 text-blue-700 shadow-none">
            公开情报
          </span>
        </div>

        <h1 class="mt-5 max-w-[12ch] font-['Space_Grotesk'] text-4xl font-bold tracking-[-0.08em] text-slate-950 md:text-[3.7rem] md:leading-[0.98]">
          公开降价情报总览
        </h1>

        <div class="mt-6 grid gap-3 md:grid-cols-3">
          <article
            v-for="card in statCards"
            :key="card.label"
            class="rounded-[1rem] border p-4 backdrop-blur-sm"
            :class="card.surface"
          >
            <p class="text-xs tracking-[0.18em]" :class="card.tone">
              {{ card.label }}
            </p>
            <p class="radar-display mt-3 text-3xl font-semibold" :class="card.valueTone">
              {{ card.value }}
            </p>
          </article>
        </div>
      </div>

      <aside class="grid gap-3 self-stretch">
        <article class="rounded-[1rem] border border-blue-100 bg-[linear-gradient(180deg,#eff6ff,#ffffff)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
          <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-300">
            实时快照
          </p>

          <dl class="mt-4 grid gap-4">
            <div class="flex items-end justify-between gap-3">
              <dt class="text-sm text-slate-500">
                覆盖市场
              </dt>
              <dd class="radar-display text-3xl font-semibold text-slate-950">
                {{ summary.countries }}
              </dd>
            </div>
            <div class="h-px bg-slate-200" />
            <div class="flex items-end justify-between gap-3">
              <dt class="text-sm text-slate-500">
                最近捕捉
              </dt>
              <dd class="text-sm font-medium text-slate-950">
                {{ lastUpdatedText }}
              </dd>
            </div>
          </dl>
        </article>
      </aside>
    </div>
  </article>
</template>
