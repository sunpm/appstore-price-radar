<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { clearStoredToken, getStoredToken } from '../../lib/auth-session';
import { useToast } from '../../lib/toast';
import ProfileDashboardHeader from './components/ProfileDashboardHeader.vue';
import ProfileHistorySection from './components/ProfileHistorySection.vue';
import ProfileSubscriptionListCard from './components/ProfileSubscriptionListCard.vue';
import ProfileWatchFormCard from './components/ProfileWatchFormCard.vue';

type AuthUser = {
  id: string;
  email: string;
};

type SubscriptionItem = {
  id: string;
  appId: string;
  country: string;
  targetPrice: number | null;
  lastNotifiedPrice: number | null;
  isActive: boolean;
  appName: string | null;
  storeUrl: string | null;
  iconUrl: string | null;
  currentPrice: number | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
};

type PricePoint = {
  id: number;
  appId: string;
  country: string;
  price: number;
  currency: string;
  fetchedAt: string;
};

type HistoryPayload = {
  snapshot: {
    appName: string;
    storeUrl: string | null;
    iconUrl: string | null;
    currency: string;
    lastPrice: number;
  } | null;
  history: PricePoint[];
};

type CountryOption = {
  code: string;
  label: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '');
const buildApiUrl = (path: string) => `${API_BASE ?? ''}${path}`;
const router = useRouter();

const countryOptions: CountryOption[] = [
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

const countryLabel = (countryCode: string) => {
  const normalized = countryCode.trim().toUpperCase();
  return countryLabelMap.get(normalized) ?? normalized;
};

const token = ref(getStoredToken());
const currentUser = ref<AuthUser | null>(null);
const sessionExpiresAt = ref('');
const restoringSession = ref(true);
const toast = useToast();

const form = reactive({
  appId: '',
  country: 'CN',
  targetPrice: '',
});

const subscriptions = ref<SubscriptionItem[]>([]);
const selectedHistory = ref<HistoryPayload | null>(null);
const selectedSubscription = ref<SubscriptionItem | null>(null);
const selectedAppLabel = ref('');
const historyTargetPrice = ref('');

const loadingList = ref(false);
const creating = ref(false);
const loadingHistory = ref(false);
const updatingHistoryTarget = ref(false);

const successText = ref('');
const errorText = ref('');

watch(successText, (next) => {
  if (!next) {
    return;
  }

  toast.success(next);
});

watch(errorText, (next) => {
  if (!next) {
    return;
  }

  toast.error(next);
});

const resetMessages = () => {
  successText.value = '';
  errorText.value = '';
};

const clearSession = () => {
  token.value = '';
  currentUser.value = null;
  sessionExpiresAt.value = '';
  subscriptions.value = [];
  selectedHistory.value = null;
  selectedSubscription.value = null;
  selectedAppLabel.value = '';
  historyTargetPrice.value = '';
  clearStoredToken();
};

const parsePrice = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const next = Number(value);

  if (!Number.isFinite(next) || next <= 0) {
    return null;
  }

  return Number(next.toFixed(2));
};

const normalizeCountryCode = (value: string): string | null => {
  const next = value.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(next)) {
    return null;
  }

  return next;
};

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

const toTime = (value: string) => {
  return new Date(value).toLocaleString();
};

const targetRuleText = (targetPrice: number | null, currency = 'USD') => {
  if (targetPrice === null) {
    return '任意降价即通知';
  }

  return `当价格 <= ${toMoney(targetPrice, currency)} 时通知`;
};

const parseErrorText = async (res: Response): Promise<string> => {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `Request failed with status ${res.status}`;
  } catch {
    return `Request failed with status ${res.status}`;
  }
};

const apiRequest = async <T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = {},
): Promise<T> => {
  const headers = new Headers(init.headers ?? {});

  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  if (options.auth) {
    if (!token.value) {
      throw new Error('Please login first');
    }

    headers.set('authorization', `Bearer ${token.value}`);
  }

  const res = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });

  if (!res.ok) {
    if (options.auth && res.status === 401) {
      clearSession();
    }

    throw new Error(await parseErrorText(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
};

const syncSelectedSubscription = () => {
  if (!selectedSubscription.value) {
    return;
  }

  const matched = subscriptions.value.find((item) => item.id === selectedSubscription.value?.id);

  if (!matched) {
    return;
  }

  selectedSubscription.value = matched;
  historyTargetPrice.value = matched.targetPrice === null ? '' : String(matched.targetPrice);
};

const loadCurrentUser = async () => {
  if (!token.value) {
    restoringSession.value = false;
    return;
  }

  try {
    const me = await apiRequest<{ user: AuthUser }>('/api/auth/me', {}, { auth: true });
    currentUser.value = me.user;
    await loadSubscriptions({ silent: true });
  } catch {
    clearSession();
    await router.replace('/auth');
  } finally {
    restoringSession.value = false;
  }
};

const logout = async () => {
  resetMessages();

  try {
    await apiRequest<{ ok: boolean }>(
      '/api/auth/logout',
      {
        method: 'POST',
      },
      { auth: true },
    );
  } catch {
    // Ignore server logout errors and clear local session anyway.
  }

  clearSession();
  await router.push('/auth');
};

const loadSubscriptions = async (options: { silent?: boolean } = {}) => {
  if (!options.silent) {
    resetMessages();
  }

  if (!currentUser.value) {
    return;
  }

  loadingList.value = true;

  try {
    const data = await apiRequest<{ items: SubscriptionItem[] }>('/api/subscriptions', {}, { auth: true });

    subscriptions.value = data.items;
    syncSelectedSubscription();

    if (!options.silent) {
      successText.value = `已同步 ${data.items.length} 条监控任务。`;
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '监控任务加载失败，请稍后重试。';
  } finally {
    loadingList.value = false;
  }
};

const createSubscription = async () => {
  resetMessages();

  if (!currentUser.value) {
    errorText.value = '请先完成登录。';
    return;
  }

  if (!form.appId.trim()) {
    errorText.value = 'App ID 或 App Store 链接不能为空。';
    return;
  }

  const country = normalizeCountryCode(form.country);

  if (!country) {
    errorText.value = '市场代码需为 2 位国家/地区代码。';
    return;
  }

  creating.value = true;

  const payload = {
    appId: form.appId.trim(),
    country,
    targetPrice: parsePrice(form.targetPrice),
  };

  try {
    const data = await apiRequest<{ subscription: SubscriptionItem }>(
      '/api/subscriptions',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      { auth: true },
    );

    successText.value = `监控任务已创建：${data.subscription.appId}（${countryLabel(data.subscription.country)}）`;

    form.appId = '';
    form.targetPrice = '';

    await loadSubscriptions({ silent: true });
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '监控任务创建失败，请稍后重试。';
  } finally {
    creating.value = false;
  }
};

const removeSubscription = async (id: string) => {
  resetMessages();

  try {
    await apiRequest<{ ok: boolean }>(
      `/api/subscriptions/${id}`,
      {
        method: 'DELETE',
      },
      { auth: true },
    );

    if (selectedSubscription.value?.id === id) {
      selectedSubscription.value = null;
      selectedHistory.value = null;
      selectedAppLabel.value = '';
      historyTargetPrice.value = '';
    }

    successText.value = '监控任务已移除。';
    await loadSubscriptions({ silent: true });
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '任务移除失败，请稍后重试。';
  }
};

const loadHistory = async (item: SubscriptionItem) => {
  resetMessages();
  loadingHistory.value = true;

  selectedSubscription.value = item;
  historyTargetPrice.value = item.targetPrice === null ? '' : String(item.targetPrice);
  selectedAppLabel.value = `${item.appName ?? `App ${item.appId}`} · ${countryLabel(item.country)}`;

  try {
    const data = await apiRequest<HistoryPayload>(
      `/api/prices/${encodeURIComponent(item.appId)}?country=${item.country}&limit=3650`,
      {},
      { auth: true },
    );

    selectedHistory.value = data;
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '历史数据加载失败，请稍后重试。';
  } finally {
    loadingHistory.value = false;
  }
};

const saveHistoryTargetPrice = async () => {
  resetMessages();

  const selected = selectedSubscription.value;

  if (!selected) {
    errorText.value = '请先在任务列表中选择一个应用。';
    return;
  }

  updatingHistoryTarget.value = true;

  try {
    const targetPrice = parsePrice(historyTargetPrice.value);
    const data = await apiRequest<{ subscription: SubscriptionItem }>(
      '/api/subscriptions',
      {
        method: 'POST',
        body: JSON.stringify({
          appId: selected.appId,
          country: selected.country,
          targetPrice,
        }),
      },
      { auth: true },
    );

    selectedSubscription.value = {
      ...selected,
      targetPrice: data.subscription.targetPrice,
      updatedAt: data.subscription.updatedAt,
    };
    historyTargetPrice.value =
      data.subscription.targetPrice === null ? '' : String(data.subscription.targetPrice);

    successText.value =
      data.subscription.targetPrice === null
        ? '该应用已更新为“任意降价即通知”。'
        : `该应用已更新为“价格 <= ${toMoney(data.subscription.targetPrice, data.subscription.currency ?? 'USD')} 时通知”。`;

    await loadSubscriptions({ silent: true });
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '通知规则更新失败，请稍后重试。';
  } finally {
    updatingHistoryTarget.value = false;
  }
};

const watchStats = computed(() => {
  const total = subscriptions.value.length;
  const withTarget = subscriptions.value.filter((item) => item.targetPrice !== null).length;

  return {
    total,
    withTarget,
  };
});

onMounted(async () => {
  await loadCurrentUser();
});
</script>

<template>
  <main class="radar-app min-h-[100dvh] bg-zinc-100 text-zinc-900">
    <div class="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_8%_10%,rgba(16,185,129,0.18),transparent_33%),radial-gradient(circle_at_85%_0%,rgba(14,116,144,0.16),transparent_35%),linear-gradient(160deg,#f4f7f7_0%,#ecf1f1_45%,#f6f7f9_100%)]"></div>

    <div class="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-10">
      <div v-if="restoringSession" class="grid gap-4 md:grid-cols-2">
        <div class="skeleton-box h-24 rounded-2xl"></div>
        <div class="skeleton-box h-24 rounded-2xl"></div>
      </div>

      <template v-else-if="currentUser">
        <ProfileDashboardHeader
          :current-user-email="currentUser.email"
          :session-expires-at="sessionExpiresAt"
          :watch-stats="watchStats"
          :to-time="toTime"
          @logout="logout"
        />

        <section class="reveal reveal-delay-1 mt-4 grid gap-4 lg:grid-cols-[0.98fr_1.02fr]">
          <ProfileWatchFormCard
            :app-id="form.appId"
            :country="form.country"
            :target-price="form.targetPrice"
            :country-options="countryOptions"
            :creating="creating"
            @update:app-id="form.appId = $event"
            @update:country="form.country = $event"
            @update:target-price="form.targetPrice = $event"
            @submit="createSubscription"
          />

          <ProfileSubscriptionListCard
            :loading-list="loadingList"
            :subscriptions="subscriptions"
            :country-label="countryLabel"
            :to-money="toMoney"
            :target-rule-text="targetRuleText"
            @refresh="loadSubscriptions()"
            @show-history="loadHistory($event)"
            @remove="removeSubscription($event)"
          />
        </section>

        <ProfileHistorySection
          :selected-history="selectedHistory"
          :selected-subscription="selectedSubscription"
          :selected-app-label="selectedAppLabel"
          :history-target-price="historyTargetPrice"
          :updating-history-target="updatingHistoryTarget"
          :loading-history="loadingHistory"
          :target-rule-text="targetRuleText"
          :to-money="toMoney"
          @update:history-target-price="historyTargetPrice = $event"
          @save-target-price="saveHistoryTargetPrice"
        />
      </template>
    </div>
  </main>
</template>
