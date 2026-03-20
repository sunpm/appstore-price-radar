<script setup lang="ts">
import type { CountryOption } from '../../../types/common'

const props = defineProps<{
  countryOptions: CountryOption[]
  creating: boolean
}>()

const emit = defineEmits<{
  submit: []
}>()

const appId = defineModel<string>('appId', { required: true })
const country = defineModel<string>('country', { required: true })
const targetPrice = defineModel<string>('targetPrice', { required: true })

function onAppIdInput(event: Event): void {
  const target = event.target as HTMLInputElement
  appId.value = target.value
}

function onCountryChange(event: Event): void {
  const target = event.target as HTMLSelectElement
  country.value = target.value
}

function onTargetPriceInput(event: Event): void {
  const target = event.target as HTMLInputElement
  targetPrice.value = target.value
}
</script>

<template>
  <article class="radar-panel p-4 md:p-5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-400">
          WATCH FORM
        </p>
        <h2 class="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-slate-950">
          新建监控任务
        </h2>
      </div>
    </div>

    <form class="mt-4 grid gap-3" @submit.prevent="emit('submit')">
      <label class="grid gap-2">
        <span class="text-sm font-semibold text-slate-700">App ID 或 App Store 链接</span>
        <input
          :value="appId"
          type="text"
          placeholder="123456789 或 https://apps.apple.com/.../id123456789"
          required
          class="radar-input"
          @input="onAppIdInput"
        >
      </label>

      <label class="grid gap-2">
        <span class="text-sm font-semibold text-slate-700">市场区域</span>
        <div class="relative">
          <select
            :value="country"
            class="radar-select appearance-none pr-11"
            @change="onCountryChange"
          >
            <option v-for="option in props.countryOptions" :key="option.code" :value="option.code">
              {{ option.label }}（{{ option.code }}）
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
        <span class="text-sm font-semibold text-slate-700">目标价格（可选）</span>
        <input
          :value="targetPrice"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="示例：0.99"
          class="radar-input"
          @input="onTargetPriceInput"
        >
        <p class="text-sm leading-6 text-slate-500">
          通知规则：当前价 &lt;= 目标价格。留空表示任意降价都会通知。
        </p>
      </label>

      <button
        class="radar-button-primary"
        type="submit"
        :disabled="props.creating"
      >
        {{ props.creating ? '创建中...' : '创建任务' }}
      </button>
    </form>
  </article>
</template>
