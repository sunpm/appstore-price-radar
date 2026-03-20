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

function progressWidth(dropPercent: number | null): string {
  const safe = Math.min(Math.max(dropPercent ?? 0, 4), 100)
  return `${safe}%`
}
</script>

<template>
  <section class="radar-panel reveal reveal-delay-2 mt-5 p-4 md:mt-6 md:p-5">
    <div class="flex flex-col gap-3 border-b border-slate-200/80 pb-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-400">
          降价列表
        </p>
        <h2 class="mt-2 font-['Space_Grotesk'] text-3xl font-bold tracking-[-0.05em] text-slate-950">
          最新降价情报
        </h2>
      </div>

      <div class="flex items-center gap-3 text-sm text-slate-500">
        <span class="radar-chip">
          共 {{ items.length }} 条公开记录
        </span>
      </div>
    </div>

    <p v-if="errorText" class="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
      {{ errorText }}
    </p>

    <div v-if="loading" class="mt-4 grid gap-3">
      <div class="skeleton-box h-44 rounded-[1rem]" />
      <div class="skeleton-box h-44 rounded-[1rem]" />
      <div class="skeleton-box h-44 rounded-[1rem]" />
    </div>

    <div
      v-else-if="items.length === 0"
      class="radar-empty mt-4 p-4 text-sm leading-7"
    >
      暂无匹配结果
    </div>

    <ul v-else class="mt-4 grid gap-3">
      <li
        v-for="item in items"
        :key="item.id"
        class="group rounded-[1rem] border border-slate-200/76 bg-white/88 p-4 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.14)] transition duration-300 hover:border-slate-300 hover:shadow-[0_18px_32px_-24px_rgba(15,23,42,0.18)]"
      >
        <article class="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_230px]">
          <div class="grid gap-4 md:grid-cols-[80px_minmax(0,1fr)]">
            <img
              v-if="item.iconUrl"
              :src="item.iconUrl"
              :alt="item.appName"
              class="h-[80px] w-[80px] rounded-[1rem] border border-slate-200 bg-white object-cover shadow-[0_12px_24px_-18px_rgba(37,99,235,0.26)]"
            >
            <div
              v-else
              class="grid h-[80px] w-[80px] place-items-center rounded-[1rem] border border-slate-200 bg-white text-xs font-semibold tracking-[0.18em] text-slate-500 shadow-[0_12px_24px_-18px_rgba(37,99,235,0.2)]"
            >
              APP
            </div>

            <div class="min-w-0">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="truncate font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.05em] text-slate-950">
                    {{ item.appName }}
                  </h3>
                  <p class="mt-1 text-sm text-slate-500">
                    App ID {{ item.appId }} · {{ countryLabel(item.country) }}（{{ item.country }}）
                  </p>
                </div>

                <span class="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                  -{{ (item.dropPercent ?? 0).toFixed(2) }}%
                </span>
              </div>

              <div class="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-blue-500 to-orange-500"
                  :style="{ width: progressWidth(item.dropPercent) }"
                />
              </div>

              <div class="mt-4 grid gap-3 lg:grid-cols-2">
                <div class="radar-soft-card px-4 py-3">
                  <p class="text-xs tracking-[0.16em] text-slate-400">
                    价格变化
                  </p>
                  <p class="radar-display mt-2 text-lg font-semibold text-slate-950">
                    {{ toMoney(item.oldPrice, item.currency) }} -> {{ toMoney(item.newPrice, item.currency) }}
                  </p>
                </div>

                <div class="rounded-[0.95rem] border border-dashed border-slate-200 bg-slate-50/90 px-4 py-3">
                  <p class="text-xs tracking-[0.16em] text-slate-400">
                    发现与热度
                  </p>
                  <p class="mt-2 text-sm font-medium text-slate-900">
                    {{ toRelativeText(item.detectedAt) }}
                  </p>
                  <p class="mt-1 text-sm text-slate-500">
                    {{ toTime(item.detectedAt) }}
                  </p>
                  <p class="mt-2 text-sm text-slate-600">
                    关注该应用人数：{{ item.submissionCount }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="grid gap-3">
            <div class="rounded-[1rem] border border-blue-100 bg-[linear-gradient(145deg,#eff6ff,#dbeafe)] px-4 py-4 text-slate-950 shadow-[0_16px_28px_-22px_rgba(37,99,235,0.16)]">
              <p class="text-xs tracking-[0.16em] text-slate-500">
                当前价格
              </p>
              <p class="radar-display mt-3 text-4xl font-semibold text-blue-700">
                {{ toMoney(item.newPrice, item.currency) }}
              </p>
              <p class="mt-2 text-sm text-slate-600">
                原价 {{ toMoney(item.oldPrice, item.currency) }}
              </p>
            </div>

            <RouterLink
              :to="appDetailTo(item)"
              class="radar-button-primary w-full"
            >
              进入详情页
            </RouterLink>

            <a
              v-if="item.storeUrl"
              :href="item.storeUrl"
              target="_blank"
              rel="noreferrer"
              class="radar-button-secondary w-full"
            >
              前往 App Store
            </a>
            <span
              v-else
              class="inline-flex items-center justify-center rounded-[0.85rem] border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-500"
            >
              暂无商店链接
            </span>
          </div>
        </article>
      </li>
    </ul>
  </section>
</template>
