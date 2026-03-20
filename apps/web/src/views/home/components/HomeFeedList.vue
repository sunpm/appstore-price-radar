<script setup lang="ts">
import type { DropEventItem } from '../types'

defineProps<{
  loading: boolean
  errorText: string
  items: DropEventItem[]
  countryLabel: (country: string) => string
  toMoney: (value: number | null | undefined, currency?: string) => string
  toRelativeText: (iso: string) => string
  toTime: (iso: string) => string
}>()

function appDetailTo(item: DropEventItem) {
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
  <section class="reveal reveal-delay-2 mt-4 rounded-[2rem] border border-zinc-200/70 bg-white/92 p-5 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-6">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-lg font-semibold tracking-tight text-zinc-900">
        最新降价记录
      </h2>
      <p class="text-sm text-zinc-500">
        共 {{ items.length }} 条公开记录
      </p>
    </div>

    <p v-if="errorText" class="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
      {{ errorText }}
    </p>

    <div v-if="loading" class="mt-4 grid gap-3">
      <div class="skeleton-box h-24 rounded-2xl" />
      <div class="skeleton-box h-24 rounded-2xl" />
      <div class="skeleton-box h-24 rounded-2xl" />
    </div>

    <div
      v-else-if="items.length === 0"
      class="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-4 text-sm text-zinc-500"
    >
      暂无匹配记录，请调整筛选条件后重试。
    </div>

    <ul v-else class="mt-4 grid gap-3">
      <li
        v-for="item in items"
        :key="item.id"
        class="grid gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/45 p-3 md:grid-cols-[58px_1fr_auto] md:items-center"
      >
        <img
          v-if="item.iconUrl"
          :src="item.iconUrl"
          :alt="item.appName"
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
            {{ item.appName }}
          </p>
          <p class="mt-1 text-xs text-zinc-500">
            appId: {{ item.appId }} · {{ countryLabel(item.country) }}（{{ item.country }}）
          </p>
          <p class="mt-1 text-xs text-zinc-700">
            {{ toMoney(item.oldPrice, item.currency) }} → {{ toMoney(item.newPrice, item.currency) }}
            <span class="ml-1 font-medium text-emerald-700">-{{ (item.dropPercent ?? 0).toFixed(2) }}%</span>
          </p>
          <p class="mt-1 text-xs text-zinc-600">
            捕捉时间：{{ toRelativeText(item.detectedAt) }} · {{ toTime(item.detectedAt) }}
          </p>
          <p class="mt-1 text-xs text-zinc-600">
            关注该应用人数：{{ item.submissionCount }}
          </p>
        </div>

        <div class="grid gap-2 md:w-[7.5rem]">
          <RouterLink
            :to="appDetailTo(item)"
            class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px]"
          >
            查看详情
          </RouterLink>

          <a
            v-if="item.storeUrl"
            :href="item.storeUrl"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-400 hover:text-zinc-900 active:translate-y-[1px]"
          >
            App Store
          </a>
          <span
            v-else
            class="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-500"
          >
            暂无商店链接
          </span>
        </div>
      </li>
    </ul>
  </section>
</template>
