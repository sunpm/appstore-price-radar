<script setup lang="ts">
import type { CountryOption } from '../../../types/common'

const props = defineProps<{
  countryOptions: CountryOption[]
  loading: boolean
  resultCount: number
  selectedCountryLabel: string
  totalCount: number
}>()

const emit = defineEmits<{
  refresh: []
}>()

const selectedCountry = defineModel<string>('selectedCountry', { required: true })
const keyword = defineModel<string>('keyword', { required: true })

function onCountryChange(event: Event): void {
  const target = event.target as HTMLSelectElement
  selectedCountry.value = target.value
  emit('refresh')
}

function onKeywordInput(event: Event): void {
  const target = event.target as HTMLInputElement
  keyword.value = target.value
}

function clearKeyword(): void {
  keyword.value = ''
}
</script>

<template>
  <article class="radar-panel reveal reveal-delay-1 radar-grid-accent p-4 md:p-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-400">
          筛选
        </p>
        <h2 class="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-slate-950">
          筛选
        </h2>
      </div>

      <button
        type="button"
        class="radar-button-secondary shrink-0 px-4 py-2.5 text-sm"
        :disabled="props.loading"
        @click="emit('refresh')"
      >
        {{ props.loading ? '刷新中...' : '刷新记录' }}
      </button>
    </div>

    <div class="mt-5 grid gap-3">
      <label class="grid gap-2">
        <span class="text-sm font-semibold text-slate-700">市场区域</span>
        <div class="relative">
          <select
            :value="selectedCountry"
            class="radar-select appearance-none pr-11"
            @change="onCountryChange"
          >
            <option v-for="option in props.countryOptions" :key="option.code" :value="option.code">
              {{ option.label }}
            </option>
          </select>
          <span class="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-slate-500">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" class="h-4 w-4" stroke="currentColor" stroke-width="1.8">
              <path d="M5 8l5 5 5-5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
      </label>

      <label class="grid gap-2">
        <span class="text-sm font-semibold text-slate-700">关键词</span>
        <div class="relative">
          <input
            :value="keyword"
            type="text"
            placeholder="请输入应用名称 / App ID / 地区"
            class="radar-input pr-11"
            @input="onKeywordInput"
          >
          <button
            v-if="keyword"
            type="button"
            class="absolute inset-y-0 right-3 my-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            aria-label="清空关键词"
            @click="clearKeyword"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" class="h-3.5 w-3.5" stroke="currentColor" stroke-width="1.8">
              <path d="M6 6l8 8M14 6l-8 8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </label>
    </div>

    <div class="mt-4 rounded-[1rem] border border-blue-100 bg-[linear-gradient(145deg,#eff6ff,#fff7ed)] px-4 py-4 text-slate-950 shadow-[0_18px_36px_-28px_rgba(59,130,246,0.16)]">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs tracking-[0.18em] text-slate-500">
            当前视角
          </p>
          <p class="mt-2 text-base font-semibold">
            {{ selectedCountryLabel }}
          </p>
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="rounded-[0.95rem] border border-white/80 bg-white/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          <p class="text-xs text-slate-500">
            当前筛出
          </p>
          <p class="radar-display mt-2 text-3xl font-semibold text-slate-950">
            {{ props.resultCount }}
          </p>
        </div>
        <div class="rounded-[0.95rem] border border-white/80 bg-white/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          <p class="text-xs text-slate-500">
            总公开样本
          </p>
          <p class="radar-display mt-2 text-3xl font-semibold text-slate-950">
            {{ props.totalCount }}
          </p>
        </div>
      </div>

      <div class="mt-4 rounded-[0.95rem] border border-white/80 bg-white/72 px-4 py-3">
        <p class="text-xs tracking-[0.16em] text-slate-500">
          当前状态
        </p>
        <p class="mt-2 text-sm font-medium text-slate-900">
          {{ keyword ? `关键词“${keyword}”` : '未输入关键词' }}
        </p>
      </div>
    </div>
  </article>
</template>
