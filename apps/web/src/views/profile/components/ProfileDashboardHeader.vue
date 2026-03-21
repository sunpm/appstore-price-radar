<script setup lang="ts">
import type { WatchStats } from '../types'

defineProps<{
  currentUserEmail: string
  sessionExpiresAt: string
  watchStats: WatchStats
  toTime: (value: string) => string
}>()

const emit = defineEmits<{
  logout: []
}>()

const statCards = [
  {
    label: '监控任务数',
    value: 'total',
    tone: 'text-slate-950',
    surface: 'border-blue-100 bg-[linear-gradient(180deg,#eff6ff,#ffffff)]',
  },
  {
    label: '已设价格阈值',
    value: 'withTarget',
    tone: 'text-orange-700',
    surface: 'border-orange-100 bg-[linear-gradient(180deg,#fff7ed,#ffffff)]',
  },
] as const
</script>

<template>
  <section class="reveal radar-panel-strong p-5 md:p-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="font-['Space_Grotesk'] text-3xl font-bold tracking-[-0.05em] text-slate-950 md:text-[2.5rem]">
          我的订阅
        </h1>
        <p class="mt-3 text-sm leading-6 text-slate-600">
          当前账号：{{ currentUserEmail }}
        </p>
        <p v-if="sessionExpiresAt" class="mt-1 text-sm text-slate-600">
          会话有效期至：{{ toTime(sessionExpiresAt) }}
        </p>
      </div>
      <button
        class="radar-button-secondary shrink-0"
        type="button"
        @click="emit('logout')"
      >
        退出账号
      </button>
    </div>

    <div class="mt-5 grid gap-3 md:grid-cols-2">
      <div
        v-for="card in statCards"
        :key="card.label"
        class="rounded-[1rem] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]"
        :class="card.surface"
      >
        <p class="text-xs font-semibold tracking-[0.16em] text-slate-500">
          {{ card.label }}
        </p>
        <p class="radar-display mt-2 text-3xl font-semibold" :class="card.tone">
          {{ watchStats[card.value] }}
        </p>
      </div>
    </div>
  </section>
</template>
