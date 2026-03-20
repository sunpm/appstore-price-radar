<script setup lang="ts">
import type { SubscriptionItem } from '../types'

const props = defineProps<{
  loadingList: boolean
  subscriptions: SubscriptionItem[]
  countryLabel: (countryCode: string) => string
  toMoney: (value: number | null | undefined, currency?: string) => string
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
      <div>
        <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-400">
          ACTIVE WATCHES
        </p>
        <h2 class="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-slate-950">
          我的监控任务
        </h2>
      </div>
      <button
        class="radar-button-secondary"
        type="button"
        :disabled="props.loadingList"
        @click="emit('refresh')"
      >
        {{ props.loadingList ? '同步中...' : '同步数据' }}
      </button>
    </div>

    <div v-if="props.loadingList" class="mt-4 grid gap-3">
      <div class="skeleton-box h-20 rounded-[1rem]" />
      <div class="skeleton-box h-20 rounded-[1rem]" />
      <div class="skeleton-box h-20 rounded-[1rem]" />
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
        class="grid gap-3 rounded-[1rem] border border-slate-200/80 bg-slate-50/55 p-3 md:grid-cols-[64px_1fr_auto] md:items-center"
      >
        <img
          v-if="item.iconUrl"
          :src="item.iconUrl"
          :alt="item.appName ?? item.appId"
          class="h-[64px] w-[64px] rounded-[0.9rem] border border-slate-200 object-cover"
        >
        <div
          v-else
          class="grid h-[64px] w-[64px] place-items-center rounded-[0.9rem] border border-slate-200 bg-white text-xs font-semibold tracking-[0.12em] text-slate-500"
        >
          APP
        </div>

        <div class="min-w-0">
          <p class="truncate font-['Space_Grotesk'] text-lg font-bold tracking-[-0.04em] text-slate-950">
            {{ item.appName ?? `App ${item.appId}` }}
          </p>
          <p class="mt-1 text-sm text-slate-500">
            App ID: {{ item.appId }} · {{ props.countryLabel(item.country) }}（{{ item.country }}）
          </p>
          <p class="mt-1 text-sm text-slate-600">
            最新价格：{{ props.toMoney(item.currentPrice, item.currency ?? 'USD') }}
          </p>
          <p class="mt-1 text-sm text-slate-600">
            通知规则：{{ props.targetRuleText(item.targetPrice, item.currency ?? 'USD') }}
          </p>
        </div>

        <div class="grid gap-2 md:w-[7.25rem]">
          <RouterLink
            :to="appDetailTo(item)"
            class="radar-button-primary px-4 py-2 text-sm"
          >
            详情页
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
