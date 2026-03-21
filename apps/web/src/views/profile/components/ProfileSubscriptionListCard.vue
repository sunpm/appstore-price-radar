<script setup lang="ts">
import type { SubscriptionItem } from '../types'

const props = defineProps<{
  loadingList: boolean
  subscriptions: SubscriptionItem[]
  countryLabel: (countryCode: string) => string
  toMoney: (value: number | null | undefined, currency?: string) => string
  toTime: (value: string) => string
  targetRuleText: (targetPrice: number | null, currency?: string) => string
}>()

const emit = defineEmits<{
  refresh: []
  remove: [id: string]
}>()

function appDetailTo(item: SubscriptionItem) {
  return {
    name: 'app-detail',
    params: {
      appId: item.appId,
      country: item.country,
    },
  }
}
</script>

<template>
  <article class="radar-panel p-4 md:p-5">
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <h2 class="font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-slate-950">
        我的监控任务
      </h2>
      <button
        class="radar-button-secondary"
        type="button"
        :disabled="props.loadingList"
        @click="emit('refresh')"
      >
        {{ props.loadingList ? '刷新中...' : '刷新列表' }}
      </button>
    </div>

    <div v-if="props.loadingList" class="mt-4 grid gap-3">
      <article
        v-for="index in 3"
        :key="index"
        class="grid gap-3 rounded-[1rem] border border-slate-200/80 bg-slate-50/55 p-3 md:grid-cols-[68px_minmax(0,1fr)_120px]"
      >
        <div class="skeleton-box h-[68px] w-[68px] rounded-[0.95rem]" />
        <div class="grid gap-2">
          <div class="skeleton-box h-6 w-40 rounded-lg" />
          <div class="skeleton-box h-4 w-56 rounded-lg max-w-full" />
          <div class="skeleton-box h-4 w-48 rounded-lg max-w-full" />
        </div>
        <div class="grid gap-2">
          <div class="skeleton-box h-10 w-full rounded-[0.85rem]" />
          <div class="skeleton-box h-10 w-full rounded-[0.85rem]" />
        </div>
      </article>
    </div>

    <div
      v-else-if="props.subscriptions.length === 0"
      class="radar-empty mt-4 p-4 text-sm font-medium"
    >
      暂无监控任务，请先在左侧创建一个任务。
    </div>

    <ul v-else class="mt-4 grid gap-2.5">
      <li
        v-for="item in props.subscriptions"
        :key="item.id"
        class="grid gap-3 rounded-[1rem] border border-slate-200/80 bg-slate-50/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] md:grid-cols-[68px_minmax(0,1fr)_120px] md:items-center"
      >
        <img
          v-if="item.iconUrl"
          :src="item.iconUrl"
          :alt="item.appName ?? item.appId"
          loading="lazy"
          class="h-[68px] w-[68px] rounded-[0.95rem] border border-slate-200 object-cover"
        >
        <div
          v-else
          class="grid h-[68px] w-[68px] place-items-center rounded-[0.95rem] border border-slate-200 bg-white text-xs font-semibold tracking-[0.12em] text-slate-500"
        >
          APP
        </div>

        <div class="min-w-0">
          <RouterLink :to="appDetailTo(item)" class="inline-block max-w-full">
            <p class="truncate font-['Space_Grotesk'] text-lg font-bold tracking-[-0.04em] text-slate-950 transition hover:text-blue-700">
              {{ item.appName ?? `App ${item.appId}` }}
            </p>
          </RouterLink>
          <div class="mt-2 flex flex-wrap gap-2">
            <span class="radar-chip border-slate-200 bg-white/85 text-slate-600 shadow-none">
              App ID {{ item.appId }}
            </span>
            <span class="radar-chip border-slate-200 bg-white/85 text-slate-600 shadow-none">
              {{ props.countryLabel(item.country) }}（{{ item.country }}）
            </span>
          </div>
          <div class="mt-3 grid gap-2 text-sm text-slate-600">
            <p>最新价格：{{ props.toMoney(item.currentPrice, item.currency ?? 'USD') }}</p>
            <p>通知规则：{{ props.targetRuleText(item.targetPrice, item.currency ?? 'USD') }}</p>
            <p>最近同步：{{ props.toTime(item.updatedAt) }}</p>
          </div>
        </div>

        <div class="grid gap-2 md:w-[7.25rem]">
          <RouterLink
            :to="appDetailTo(item)"
            class="radar-button-primary px-4 py-2 text-sm"
          >
            查看详情
          </RouterLink>
          <button
            class="radar-button-danger px-4 py-2 text-sm"
            type="button"
            @click="emit('remove', item.id)"
          >
            移除
          </button>
        </div>
      </li>
    </ul>
  </article>
</template>
