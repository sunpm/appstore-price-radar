<script setup lang="ts">
import type { CountryOption } from '../../../types/common'

const props = defineProps<{
  countryOptions: CountryOption[]
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
</script>

<template>
  <article class="reveal reveal-delay-1 rounded-[2rem] border border-zinc-200/70 bg-white/92 p-6 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)]">
    <h2 class="text-base font-semibold tracking-tight text-zinc-900">
      筛选
    </h2>
    <div class="mt-4 grid gap-3">
      <label class="grid gap-2">
        <span class="text-sm font-medium text-zinc-700">市场区域</span>
        <div class="relative">
          <select
            :value="selectedCountry"
            class="w-full appearance-none rounded-xl border border-zinc-300 bg-white px-3 py-2.5 pr-11 text-sm leading-6 text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            @change="onCountryChange"
          >
            <option v-for="option in props.countryOptions" :key="option.code" :value="option.code">
              {{ option.label }}
            </option>
          </select>
          <span class="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-zinc-500">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" class="h-4 w-4" stroke="currentColor" stroke-width="1.8">
              <path d="M5 8l5 5 5-5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
      </label>

      <label class="grid gap-2">
        <span class="text-sm font-medium text-zinc-700">关键词</span>
        <input
          :value="keyword"
          type="text"
          placeholder="请输入应用名称 / App ID / 地区"
          class="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          @input="onKeywordInput"
        >
      </label>

      <button
        type="button"
        class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px]"
        @click="emit('refresh')"
      >
        刷新记录
      </button>
    </div>
  </article>
</template>
