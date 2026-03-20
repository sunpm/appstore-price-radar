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
  <article class="rounded-[2rem] border border-zinc-200/70 bg-white/92 p-5 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-6">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-lg font-semibold tracking-tight text-zinc-900">
        我的监控任务
      </h2>
      <button
        class="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-400 hover:text-zinc-900 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        :disabled="props.loadingList"
        @click="emit('refresh')"
      >
        {{ props.loadingList ? '刷新中...' : '刷新列表' }}
      </button>
    </div>

    <div v-if="props.loadingList" class="mt-4 grid gap-3">
      <div class="skeleton-box h-20 rounded-2xl" />
      <div class="skeleton-box h-20 rounded-2xl" />
      <div class="skeleton-box h-20 rounded-2xl" />
    </div>

    <div
      v-else-if="props.subscriptions.length === 0"
      class="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-4 text-sm font-medium text-zinc-500"
    >
      暂无监控任务，请先在左侧创建一个任务。
    </div>

    <ul v-else class="mt-4 grid gap-3">
      <li
        v-for="item in props.subscriptions"
        :key="item.id"
        class="grid gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/45 p-3 md:grid-cols-[58px_1fr_auto] md:items-center"
      >
        <img
          v-if="item.iconUrl"
          :src="item.iconUrl"
          :alt="item.appName ?? item.appId"
          class="h-[58px] w-[58px] rounded-xl border border-zinc-200 object-cover"
        >
        <div
          v-else
          class="grid h-[58px] w-[58px] place-items-center rounded-xl border border-zinc-200 bg-white text-xs font-semibold tracking-[0.12em] text-zinc-500"
        >
          APP
        </div>

        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-zinc-900">
            {{ item.appName ?? `App ${item.appId}` }}
          </p>
          <p class="mt-1 text-xs text-zinc-500">
            App ID: {{ item.appId }} · {{ props.countryLabel(item.country) }}（{{ item.country }}）
          </p>
          <p class="mt-1 text-xs text-zinc-600">
            最新价格：{{ props.toMoney(item.currentPrice, item.currency ?? 'USD') }}
          </p>
          <p class="mt-1 text-xs text-zinc-600">
            通知规则：{{ props.targetRuleText(item.targetPrice, item.currency ?? 'USD') }}
          </p>
        </div>

        <div class="grid gap-2 md:w-[7.5rem]">
          <RouterLink
            :to="appDetailTo(item)"
            class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px]"
          >
            详情页
          </RouterLink>
          <button
            class="inline-flex items-center justify-center rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition duration-300 hover:-translate-y-0.5 hover:border-rose-400 active:translate-y-[1px]"
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
