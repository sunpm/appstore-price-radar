<script setup lang="ts">
import { computed } from 'vue'
import { resolveAppStoreGenreLabel } from '../../../lib/app-store'
import { formatDateTime } from '../../../lib/format'

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

const quickFacts = computed(() => {
  return [
    {
      label: '市场',
      value: props.countryLabel,
    },
    {
      label: '平台',
      value: props.storePlatformLabel,
    },
    {
      label: '版本',
      value: props.version ?? '暂无',
    },
  ]
})
</script>

<template>
  <section class="radar-panel-strong overflow-hidden">
    <div class="grid gap-5 p-5 md:p-6 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div>
        <div class="flex flex-wrap gap-2">
          <span class="radar-chip border-blue-100 bg-blue-50 text-blue-700 shadow-none">
            应用详情
          </span>
          <span class="radar-chip border-orange-100 bg-orange-50 text-orange-700 shadow-none">
            {{ props.storePlatformLabel }}
          </span>
        </div>

        <div class="mt-5 flex flex-col gap-4 md:flex-row md:items-start">
          <img
            v-if="props.iconUrl"
            :src="props.iconUrl"
            :alt="props.appName"
            class="h-24 w-24 rounded-[1.1rem] border border-white/80 object-cover shadow-[0_14px_24px_-18px_rgba(37,99,235,0.2)]"
          >
          <div
            v-else
            class="grid h-24 w-24 place-items-center rounded-[1.1rem] border border-white/80 bg-white text-sm font-semibold tracking-[0.18em] text-slate-500 shadow-[0_14px_24px_-18px_rgba(37,99,235,0.16)]"
          >
            APP
          </div>

          <div class="min-w-0 flex-1">
            <h1 class="font-['Space_Grotesk'] text-3xl font-bold tracking-[-0.06em] text-slate-950 md:text-[3rem]">
              {{ props.appName }}
            </h1>
            <p class="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-[0.97rem]">
              {{ props.sellerName ?? 'App Store 应用详情' }}
              <span v-if="formattedPrimaryGenreName"> · {{ formattedPrimaryGenreName }}</span>
              <span v-if="props.version"> · 版本 {{ props.version }}</span>
            </p>

            <div class="mt-4 flex flex-wrap gap-2">
              <span class="radar-chip">
                App ID {{ props.appId }}
              </span>
              <span
                v-if="props.contentAdvisoryRating"
                class="radar-chip"
              >
                分级 {{ props.contentAdvisoryRating }}
              </span>
              <span
                v-if="formattedPrimaryGenreName"
                class="radar-chip"
              >
                {{ formattedPrimaryGenreName }}
              </span>
            </div>

            <p class="mt-5 text-sm text-slate-600">
              最近快照更新时间：{{ formattedUpdatedAt }}
            </p>
          </div>
        </div>
      </div>

      <aside class="grid gap-3 self-stretch">
        <article
          v-for="item in quickFacts"
          :key="item.label"
          class="rounded-[1rem] border border-white/80 bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
        >
          <p class="text-xs tracking-[0.18em] text-slate-500">
            {{ item.label }}
          </p>
          <p class="mt-3 break-all text-lg font-semibold text-slate-950">
            {{ item.value }}
          </p>
        </article>
      </aside>
    </div>
  </section>
</template>
