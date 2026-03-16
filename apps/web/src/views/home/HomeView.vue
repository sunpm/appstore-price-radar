<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import HomeFeedFilters from './components/HomeFeedFilters.vue';
import HomeFeedHero from './components/HomeFeedHero.vue';
import HomeFeedList from './components/HomeFeedList.vue';

type DropEventItem = {
  id: number;
  appId: string;
  country: string;
  appName: string;
  storeUrl: string | null;
  iconUrl: string | null;
  currency: string;
  oldPrice: number;
  newPrice: number;
  dropPercent: number | null;
  detectedAt: string;
  submissionCount: number;
};

type CountryOption = {
  code: string;
  label: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '');

const buildApiUrl = (path: string) => `${API_BASE ?? ''}${path}`;

const countryOptions: CountryOption[] = [
  { code: 'ALL', label: '全部地区' },
  { code: 'US', label: '美国' },
  { code: 'CN', label: '中国大陆' },
  { code: 'HK', label: '中国香港' },
  { code: 'TW', label: '中国台湾' },
  { code: 'JP', label: '日本' },
  { code: 'KR', label: '韩国' },
  { code: 'SG', label: '新加坡' },
  { code: 'GB', label: '英国' },
  { code: 'DE', label: '德国' },
  { code: 'FR', label: '法国' },
  { code: 'CA', label: '加拿大' },
  { code: 'AU', label: '澳大利亚' },
  { code: 'IN', label: '印度' },
  { code: 'BR', label: '巴西' },
  { code: 'MX', label: '墨西哥' },
];

const countryLabelMap = new Map(countryOptions.map((item) => [item.code, item.label]));

const countryLabel = (country: string) => {
  const code = country.trim().toUpperCase();
  return countryLabelMap.get(code) ?? code;
};

const loading = ref(false);
const errorText = ref('');
const keyword = ref('');
const selectedCountry = ref('ALL');
const drops = ref<DropEventItem[]>([]);

const toMoney = (value: number | null | undefined, currency = 'USD') => {
  if (value === null || value === undefined) {
    return '-';
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
};

const toRelativeText = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();

  if (diff <= 0) {
    return '刚刚';
  }

  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) {
    return '刚刚';
  }

  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} 小时前`;
  }

  const days = Math.floor(hours / 24);

  if (days === 1) {
    return '昨天';
  }

  if (days === 2) {
    return '前天';
  }

  if (days <= 10) {
    return `${days} 天前`;
  }

  return `${days} 天前（历史记录保留）`;
};

const toTime = (iso: string) => {
  return new Date(iso).toLocaleString();
};

const parseErrorText = async (res: Response): Promise<string> => {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `Request failed with status ${res.status}`;
  } catch {
    return `Request failed with status ${res.status}`;
  }
};

const loadDrops = async () => {
  loading.value = true;
  errorText.value = '';

  try {
    const params = new URLSearchParams({ limit: '120', dedupe: '1' });

    if (selectedCountry.value !== 'ALL') {
      params.set('country', selectedCountry.value);
    }

    const res = await fetch(buildApiUrl(`/api/public/drops?${params.toString()}`));

    if (!res.ok) {
      throw new Error(await parseErrorText(res));
    }

    const data = (await res.json()) as { items: DropEventItem[] };
    drops.value = data.items;
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '公开情报加载失败，请稍后重试。';
  } finally {
    loading.value = false;
  }
};

const filteredDrops = computed(() => {
  const key = keyword.value.trim().toLowerCase();

  if (!key) {
    return drops.value;
  }

  return drops.value.filter((item) => {
    const text = `${item.appName} ${item.appId} ${item.country}`.toLowerCase();
    return text.includes(key);
  });
});

const summary = computed(() => {
  const total = drops.value.length;
  const apps = new Set(drops.value.map((item) => `${item.appId}:${item.country}`)).size;
  const maxDrop = drops.value.reduce((max, item) => {
    if (item.dropPercent === null) {
      return max;
    }

    return Math.max(max, item.dropPercent);
  }, 0);

  return {
    total,
    apps,
    maxDrop,
  };
});

onMounted(async () => {
  await loadDrops();
});
</script>

<template>
  <main class="min-h-[100dvh] bg-zinc-100 text-zinc-900">
    <div class="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_12%,rgba(16,185,129,0.16),transparent_32%),radial-gradient(circle_at_88%_6%,rgba(6,95,70,0.1),transparent_34%),linear-gradient(155deg,#f3f7f6_0%,#eef3f2_48%,#f7f7f8_100%)]"></div>

    <div class="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-10">
      <section class="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <HomeFeedHero :summary="summary" />
        <HomeFeedFilters
          :selected-country="selectedCountry"
          :keyword="keyword"
          :country-options="countryOptions"
          @update:selected-country="selectedCountry = $event"
          @update:keyword="keyword = $event"
          @refresh="loadDrops"
        />
      </section>

      <HomeFeedList
        :loading="loading"
        :error-text="errorText"
        :items="filteredDrops"
        :country-label="countryLabel"
        :to-money="toMoney"
        :to-relative-text="toRelativeText"
        :to-time="toTime"
      />
    </div>
  </main>
</template>
