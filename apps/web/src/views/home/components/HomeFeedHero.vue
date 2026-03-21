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
      label: '平均降幅',
      value: `${props.summary.averageDrop.toFixed(2)}%`,
      tone: 'text-blue-900',
      valueTone: 'text-blue-700',
      surface: 'border-blue-200 bg-blue-50',
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
    <div class="p-5 md:p-6">
      <h1 class="font-['Space_Grotesk'] text-4xl font-bold tracking-[-0.08em] text-slate-950 md:text-[3.65rem] md:leading-[0.98]">
        公开降价记录
      </h1>
      <p class="mt-3 text-sm text-slate-600 md:text-[0.96rem]">
        查看最近捕捉到的价格变化，按市场筛选，按应用检索。
      </p>

      <div class="mt-4 text-sm text-slate-500">
        最后更新时间 {{ lastUpdatedText }}
      </div>

      <div class="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
  </article>
</template>
