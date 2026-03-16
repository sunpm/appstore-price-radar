<script setup lang="ts">
type CountryOption = {
  code: string;
  label: string;
};

const props = defineProps<{
  appId: string;
  country: string;
  targetPrice: string;
  countryOptions: CountryOption[];
  creating: boolean;
}>();

const emit = defineEmits<{
  'update:appId': [value: string];
  'update:country': [value: string];
  'update:targetPrice': [value: string];
  submit: [];
}>();

const onAppIdInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:appId', target.value);
};

const onCountryChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  emit('update:country', target.value);
};

const onTargetPriceInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:targetPrice', target.value);
};
</script>

<template>
  <article class="rounded-[2rem] border border-zinc-200/70 bg-white/92 p-5 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-6">
    <div class="flex items-end justify-between gap-3">
      <h2 class="text-lg font-semibold tracking-tight text-zinc-900">新建监控任务</h2>
      <span class="metric-mono text-xs tracking-[0.16em] text-zinc-500">WATCH FORM</span>
    </div>

    <form class="mt-4 grid gap-3" @submit.prevent="emit('submit')">
      <label class="grid gap-2">
        <span class="text-sm font-medium text-zinc-700">App ID 或 App Store 链接</span>
        <input
          :value="props.appId"
          type="text"
          placeholder="123456789 或 https://apps.apple.com/.../id123456789"
          required
          class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          @input="onAppIdInput"
        />
      </label>

      <label class="grid gap-2">
        <span class="text-sm font-medium text-zinc-700">市场区域</span>
        <div class="relative">
          <select
            :value="props.country"
            class="w-full appearance-none rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 pr-11 text-sm leading-6 text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            @change="onCountryChange"
          >
            <option v-for="option in props.countryOptions" :key="option.code" :value="option.code">
              {{ option.label }}（{{ option.code }}）
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
        <span class="text-sm font-medium text-zinc-700">目标价格（可选）</span>
        <input
          :value="props.targetPrice"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="示例：0.99"
          class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          @input="onTargetPriceInput"
        />
        <p class="text-xs text-zinc-500">通知规则：当前价 <= 目标价格。留空表示任意降价都会通知。</p>
      </label>

      <button
        class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        :disabled="props.creating"
      >
        {{ props.creating ? '创建中...' : '创建并开始监控' }}
      </button>
    </form>
  </article>
</template>
