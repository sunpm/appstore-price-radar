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
</script>

<template>
  <section class="reveal radar-panel-strong p-5 md:p-6">
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
      <div>
        <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-500">
          我的订阅
        </p>
        <h1 class="mt-2 font-['Space_Grotesk'] text-3xl font-bold tracking-[-0.05em] text-slate-950 md:text-[2.5rem]">
          我的订阅
        </h1>
        <p class="mt-3 text-sm leading-6 text-slate-600">
          当前账号：{{ currentUserEmail }}
        </p>
        <p v-if="sessionExpiresAt" class="mt-1 text-sm text-slate-600">
          会话有效期至：{{ toTime(sessionExpiresAt) }}
        </p>
      </div>

      <div class="flex justify-start lg:justify-end">
        <button
          class="radar-button-secondary"
          type="button"
          @click="emit('logout')"
        >
          退出账号
        </button>
      </div>
    </div>

    <div class="mt-5 grid gap-3 md:grid-cols-2">
      <div class="rounded-[1rem] border border-blue-100 bg-[linear-gradient(180deg,#eff6ff,#ffffff)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
        <p class="text-xs font-semibold tracking-[0.16em] text-slate-500">
          监控任务数
        </p>
        <p class="radar-display mt-2 text-3xl font-semibold text-slate-950">
          {{ watchStats.total }}
        </p>
      </div>
      <div class="rounded-[1rem] border border-orange-100 bg-[linear-gradient(180deg,#fff7ed,#ffffff)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
        <p class="text-xs font-semibold tracking-[0.16em] text-slate-500">
          已设价格阈值
        </p>
        <p class="radar-display mt-2 text-3xl font-semibold text-orange-700">
          {{ watchStats.withTarget }}
        </p>
      </div>
    </div>
  </section>
</template>
