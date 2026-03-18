<script setup lang="ts">
import { computed } from 'vue'
import { formatDateTime, formatMoney } from '../../../lib/format'

const props = defineProps<{
  appId: string
  country: string
  appName: string
  iconUrl: string | null
  storeUrl: string | null
  currentPrice: number | null
  currency: string
  updatedAt: string | null
}>()

const formattedPrice = computed(() => {
  return formatMoney(props.currentPrice, props.currency)
})

const formattedUpdatedAt = computed(() => {
  return props.updatedAt ? formatDateTime(props.updatedAt) : '暂无快照'
})
</script>

<template>
  <section class="rounded-[2rem] border border-zinc-200/70 bg-white/92 p-5 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-6">
    <RouterLink
      :to="{ name: 'home' }"
      class="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-400"
    >
      返回市场动态
    </RouterLink>

    <div class="mt-4 flex flex-wrap items-center gap-4">
      <img
        v-if="props.iconUrl"
        :src="props.iconUrl"
        :alt="props.appName"
        class="h-[4.5rem] w-[4.5rem] rounded-[1.35rem] border border-zinc-200 object-cover"
      >
      <div
        v-else
        class="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-[1.35rem] border border-zinc-200 bg-zinc-50 text-xs font-semibold tracking-[0.18em] text-zinc-500"
      >
        APP
      </div>

      <div class="min-w-0 flex-1">
        <p class="metric-mono text-xs tracking-[0.18em] text-zinc-500">
          APP DETAIL
        </p>
        <h1 class="mt-2 truncate text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">
          {{ props.appName }}
        </h1>
        <p class="mt-1 text-sm text-zinc-600">
          appId: {{ props.appId }} · 国家/地区：{{ props.country }}
        </p>
      </div>

      <div class="ml-auto min-w-[180px] rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 px-4 py-3">
        <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
          当前价格
        </p>
        <strong class="metric-mono mt-2 block text-2xl text-zinc-900">{{ formattedPrice }}</strong>
        <p class="mt-2 text-xs text-zinc-500">
          最近快照：{{ formattedUpdatedAt }}
        </p>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/70 px-4 py-3">
      <p class="text-sm text-zinc-600">
        首屏聚焦当前价格、关键评分指标与历史决策信号，更多元数据已折叠到下方扩展面板。
      </p>
      <a
        v-if="props.storeUrl"
        :href="props.storeUrl"
        target="_blank"
        rel="noreferrer"
        class="inline-flex items-center rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800"
      >
        前往 App Store
      </a>
    </div>
  </section>
</template>
