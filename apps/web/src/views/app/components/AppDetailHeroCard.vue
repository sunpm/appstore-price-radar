<script setup lang="ts">
import { computed } from 'vue'
import { formatDateTime } from '../../../lib/format'
import { resolveAppStoreGenreLabel } from '../../../lib/app-store'

const props = defineProps<{
  appId: string
  countryLabel: string
  appName: string
  iconUrl: string | null
  storePlatformLabel: string
  sellerName: string | null
  primaryGenreName: string | null
  version: string | null
  contentAdvisoryRating: string | null
  updatedAt: string | null
}>()

const formattedUpdatedAt = computed(() => {
  return props.updatedAt ? formatDateTime(props.updatedAt) : '暂无快照'
})

const formattedPrimaryGenreName = computed(() => {
  return resolveAppStoreGenreLabel(props.primaryGenreName)
})
</script>

<template>
  <section class="rounded-[2rem] border border-zinc-200/70 bg-white/92 p-5 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-6">
    <div class="overflow-hidden rounded-[1.7rem] border border-zinc-200/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_36%),linear-gradient(145deg,rgba(250,250,249,0.98),rgba(244,244,245,0.92))] p-5 md:p-6">
      <div class="flex gap-4">
        <img
          v-if="props.iconUrl"
          :src="props.iconUrl"
          :alt="props.appName"
          class="h-[5.25rem] w-[5.25rem] rounded-[1.55rem] border border-white/80 object-cover shadow-[0_18px_32px_-20px_rgba(15,23,42,0.5)]"
        >
        <div
          v-else
          class="grid h-[5.25rem] w-[5.25rem] place-items-center rounded-[1.55rem] border border-white/80 bg-white/85 text-xs font-semibold tracking-[0.18em] text-zinc-500 shadow-[0_18px_32px_-20px_rgba(15,23,42,0.5)]"
        >
          APP
        </div>

        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium tracking-[0.12em] text-zinc-500">
            应用详情
          </p>
          <h1 class="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 md:text-[2rem]">
            {{ props.appName }}
          </h1>
          <p class="mt-3 max-w-3xl text-sm leading-7 text-zinc-600 md:text-[0.95rem]">
            {{ props.sellerName ?? 'App Store 应用详情' }}
            <span v-if="formattedPrimaryGenreName"> · {{ formattedPrimaryGenreName }}</span>
            <span v-if="props.version"> · 版本 {{ props.version }}</span>
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <svg
                class="h-3.5 w-3.5 text-emerald-600"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <rect x="6.2" y="2.8" width="7.6" height="14.4" rx="2.2" stroke="currentColor" stroke-width="1.4" />
                <circle cx="10" cy="14.6" r="0.9" fill="currentColor" />
              </svg>
              {{ props.storePlatformLabel }}
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
              <svg
                class="h-3.5 w-3.5 text-zinc-500"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.4" />
                <path d="M3.5 10h13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                <path d="M10 3.4c1.8 1.8 2.8 4.1 2.8 6.6s-1 4.8-2.8 6.6c-1.8-1.8-2.8-4.1-2.8-6.6s1-4.8 2.8-6.6Z" stroke="currentColor" stroke-width="1.4" />
              </svg>
              {{ props.countryLabel }}
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
              <svg
                class="h-3.5 w-3.5 text-zinc-500"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="14" height="12" rx="3" stroke="currentColor" stroke-width="1.4" />
                <path d="M7 8h6M7 12h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
              </svg>
              {{ props.appId }}
            </span>
            <span
              v-if="props.contentAdvisoryRating"
              class="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600"
            >
              分级 {{ props.contentAdvisoryRating }}
            </span>
            <span
              v-if="formattedPrimaryGenreName"
              class="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600"
            >
              {{ formattedPrimaryGenreName }}
            </span>
            <span
              v-if="props.version"
              class="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600"
            >
              版本 {{ props.version }}
            </span>
          </div>

          <p class="mt-5 text-sm text-zinc-500">
            最近快照更新时间：{{ formattedUpdatedAt }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
