<script setup lang="ts">
type CountryOption = {
  code: string;
  label: string;
};

const props = defineProps<{
  selectedCountry: string;
  keyword: string;
  countryOptions: CountryOption[];
}>();

const emit = defineEmits<{
  'update:selectedCountry': [value: string];
  'update:keyword': [value: string];
  refresh: [];
}>();

const onCountryChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  emit('update:selectedCountry', target.value);
  emit('refresh');
};

const onKeywordInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:keyword', target.value);
};
</script>

<template>
  <article class="reveal reveal-delay-1 rounded-[2rem] border border-zinc-200/70 bg-white/92 p-6 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)]">
    <h2 class="text-base font-semibold tracking-tight text-zinc-900">智能筛选</h2>
    <div class="mt-4 grid gap-3">
      <label class="grid gap-2">
        <span class="text-sm font-medium text-zinc-700">市场区域</span>
        <div class="relative">
          <select
            :value="props.selectedCountry"
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
        <span class="text-sm font-medium text-zinc-700">检索关键词</span>
        <input
          :value="props.keyword"
          type="text"
          placeholder="请输入应用名称 / App ID / 地区"
          class="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          @input="onKeywordInput"
        />
      </label>

      <button
        type="button"
        class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px]"
        @click="emit('refresh')"
      >
        更新情报
      </button>
    </div>
  </article>
</template>
