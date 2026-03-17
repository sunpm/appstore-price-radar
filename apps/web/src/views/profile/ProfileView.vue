<script setup lang="ts">
import type { AuthUser, HistoryPayload, SubscriptionItem, WatchStats } from './types'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { COUNTRY_OPTIONS, resolveCountryLabel } from '../../constants/countries'
import { clearStoredToken, getStoredToken } from '../../lib/auth-session'
import { formatDateTime, formatMoney } from '../../lib/format'
import { buildApiUrl, parseApiErrorText } from '../../lib/http'
import { useToast } from '../../lib/toast'
import ProfileDashboardHeader from './components/ProfileDashboardHeader.vue'
import ProfileHistorySection from './components/ProfileHistorySection.vue'
import ProfileSubscriptionListCard from './components/ProfileSubscriptionListCard.vue'
import ProfileWatchFormCard from './components/ProfileWatchFormCard.vue'

const router = useRouter()
const route = useRoute()
const countryOptions = COUNTRY_OPTIONS
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/

type AccountSection = 'profile' | 'security'

function countryLabel(countryCode: string): string {
  return resolveCountryLabel(countryCode)
}

const token = ref(getStoredToken())
const currentUser = ref<AuthUser | null>(null)
const sessionExpiresAt = ref('')
const restoringSession = ref(true)
const toast = useToast()

const form = reactive({
  appId: '',
  country: 'CN',
  targetPrice: '',
})

const subscriptions = ref<SubscriptionItem[]>([])
const selectedHistory = ref<HistoryPayload | null>(null)
const selectedSubscription = ref<SubscriptionItem | null>(null)
const selectedAppLabel = ref('')
const historyTargetPrice = ref('')

const loadingList = ref(false)
const creating = ref(false)
const loadingHistory = ref(false)
const updatingHistoryTarget = ref(false)

const successText = ref('')
const errorText = ref('')

watch(successText, (next): void => {
  if (!next) {
    return
  }

  toast.success(next)
})

watch(errorText, (next): void => {
  if (!next) {
    return
  }

  toast.error(next)
})

const activeSection = computed<AccountSection>(() => {
  return route.name === 'security' ? 'security' : 'profile'
})

function isAccountSectionActive(section: AccountSection): boolean {
  return activeSection.value === section
}

function resetMessages(): void {
  successText.value = ''
  errorText.value = ''
}

function clearSession(): void {
  token.value = ''
  currentUser.value = null
  sessionExpiresAt.value = ''
  subscriptions.value = []
  selectedHistory.value = null
  selectedSubscription.value = null
  selectedAppLabel.value = ''
  historyTargetPrice.value = ''
  clearStoredToken()
}

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const next = Number(value)

  if (!Number.isFinite(next) || next <= 0) {
    return null
  }

  return Number(next.toFixed(2))
}

function normalizeCountryCode(value: string): string | null {
  const next = value.trim().toUpperCase()

  if (!COUNTRY_CODE_PATTERN.test(next)) {
    return null
  }

  return next
}

function toMoney(value: number | null | undefined, currency = 'USD'): string {
  return formatMoney(value, currency)
}

function toTime(value: string): string {
  return formatDateTime(value)
}

function targetRuleText(targetPrice: number | null, currency = 'USD'): string {
  if (targetPrice === null) {
    return '任意降价即通知'
  }

  return `当价格 <= ${toMoney(targetPrice, currency)} 时通知`
}

async function apiRequest<T>(path: string, init: RequestInit = {}, options: { auth?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {})

  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  if (options.auth) {
    if (!token.value) {
      throw new Error('Please login first')
    }

    headers.set('authorization', `Bearer ${token.value}`)
  }

  const res = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  })

  if (!res.ok) {
    if (options.auth && res.status === 401) {
      clearSession()
    }

    throw new Error(await parseApiErrorText(res))
  }

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}

function syncSelectedSubscription(): void {
  if (!selectedSubscription.value) {
    return
  }

  const matched = subscriptions.value.find(item => item.id === selectedSubscription.value?.id)

  if (!matched) {
    return
  }

  selectedSubscription.value = matched
  historyTargetPrice.value = matched.targetPrice === null ? '' : String(matched.targetPrice)
}

async function loadCurrentUser(): Promise<void> {
  if (!token.value) {
    restoringSession.value = false
    return
  }

  try {
    const me = await apiRequest<{ user: AuthUser }>('/api/auth/me', {}, { auth: true })
    currentUser.value = me.user
    await loadSubscriptions({ silent: true })
  }
  catch {
    clearSession()
    await router.replace('/auth')
  }
  finally {
    restoringSession.value = false
  }
}

async function logout(): Promise<void> {
  resetMessages()

  try {
    await apiRequest<{ ok: boolean }>(
      '/api/auth/logout',
      {
        method: 'POST',
      },
      { auth: true },
    )
  }
  catch {
    // Ignore server logout errors and clear local session anyway.
  }

  clearSession()
  await router.push('/auth')
}

async function loadSubscriptions(options: { silent?: boolean } = {}): Promise<void> {
  if (!options.silent) {
    resetMessages()
  }

  if (!currentUser.value) {
    return
  }

  loadingList.value = true

  try {
    const data = await apiRequest<{ items: SubscriptionItem[] }>('/api/subscriptions', {}, { auth: true })

    subscriptions.value = data.items
    syncSelectedSubscription()

    if (!options.silent) {
      successText.value = `已同步 ${data.items.length} 条监控任务。`
    }
  }
  catch (error) {
    errorText.value = error instanceof Error ? error.message : '监控任务加载失败，请稍后重试。'
  }
  finally {
    loadingList.value = false
  }
}

async function createSubscription(): Promise<void> {
  resetMessages()

  if (!currentUser.value) {
    errorText.value = '请先完成登录。'
    return
  }

  if (!form.appId.trim()) {
    errorText.value = 'App ID 或 App Store 链接不能为空。'
    return
  }

  const country = normalizeCountryCode(form.country)

  if (!country) {
    errorText.value = '市场代码需为 2 位国家/地区代码。'
    return
  }

  creating.value = true

  const payload = {
    appId: form.appId.trim(),
    country,
    targetPrice: parsePrice(form.targetPrice),
  }

  try {
    const data = await apiRequest<{ subscription: SubscriptionItem }>(
      '/api/subscriptions',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      { auth: true },
    )

    successText.value = `监控任务已创建：${data.subscription.appId}（${countryLabel(data.subscription.country)}）`

    form.appId = ''
    form.targetPrice = ''

    await loadSubscriptions({ silent: true })
  }
  catch (error) {
    errorText.value = error instanceof Error ? error.message : '监控任务创建失败，请稍后重试。'
  }
  finally {
    creating.value = false
  }
}

async function removeSubscription(id: string): Promise<void> {
  resetMessages()

  try {
    await apiRequest<{ ok: boolean }>(
      `/api/subscriptions/${id}`,
      {
        method: 'DELETE',
      },
      { auth: true },
    )

    if (selectedSubscription.value?.id === id) {
      selectedSubscription.value = null
      selectedHistory.value = null
      selectedAppLabel.value = ''
      historyTargetPrice.value = ''
    }

    successText.value = '监控任务已移除。'
    await loadSubscriptions({ silent: true })
  }
  catch (error) {
    errorText.value = error instanceof Error ? error.message : '任务移除失败，请稍后重试。'
  }
}

async function loadHistory(item: SubscriptionItem): Promise<void> {
  resetMessages()
  loadingHistory.value = true

  selectedSubscription.value = item
  historyTargetPrice.value = item.targetPrice === null ? '' : String(item.targetPrice)
  selectedAppLabel.value = `${item.appName ?? `App ${item.appId}`} · ${countryLabel(item.country)}`

  try {
    const data = await apiRequest<HistoryPayload>(
      `/api/prices/${encodeURIComponent(item.appId)}?country=${item.country}&limit=3650`,
      {},
      { auth: true },
    )

    selectedHistory.value = data
  }
  catch (error) {
    errorText.value = error instanceof Error ? error.message : '历史数据加载失败，请稍后重试。'
  }
  finally {
    loadingHistory.value = false
  }
}

async function saveHistoryTargetPrice(): Promise<void> {
  resetMessages()

  const selected = selectedSubscription.value

  if (!selected) {
    errorText.value = '请先在任务列表中选择一个应用。'
    return
  }

  updatingHistoryTarget.value = true

  try {
    const targetPrice = parsePrice(historyTargetPrice.value)
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
    )

    selectedSubscription.value = {
      ...selected,
      targetPrice: data.subscription.targetPrice,
      updatedAt: data.subscription.updatedAt,
    }
    historyTargetPrice.value
      = data.subscription.targetPrice === null ? '' : String(data.subscription.targetPrice)

    successText.value
      = data.subscription.targetPrice === null
        ? '该应用已更新为“任意降价即通知”。'
        : `该应用已更新为“价格 <= ${toMoney(data.subscription.targetPrice, data.subscription.currency ?? 'USD')} 时通知”。`

    await loadSubscriptions({ silent: true })
  }
  catch (error) {
    errorText.value = error instanceof Error ? error.message : '通知规则更新失败，请稍后重试。'
  }
  finally {
    updatingHistoryTarget.value = false
  }
}

const watchStats = computed<WatchStats>(() => {
  const total = subscriptions.value.length
  const withTarget = subscriptions.value.filter(item => item.targetPrice !== null).length

  return {
    total,
    withTarget,
  }
})

onMounted(async (): Promise<void> => {
  await loadCurrentUser()
})
</script>

<template>
  <main class="radar-app min-h-[100dvh] bg-zinc-100 text-zinc-900">
    <div class="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_8%_10%,rgba(16,185,129,0.18),transparent_33%),radial-gradient(circle_at_85%_0%,rgba(14,116,144,0.16),transparent_35%),linear-gradient(160deg,#f4f7f7_0%,#ecf1f1_45%,#f6f7f9_100%)]" />

    <div class="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-10">
      <div v-if="restoringSession" class="grid gap-4 md:grid-cols-2">
        <div class="skeleton-box h-24 rounded-2xl" />
        <div class="skeleton-box h-24 rounded-2xl" />
      </div>

      <template v-else-if="currentUser">
        <ProfileDashboardHeader
          :current-user-email="currentUser.email"
          :session-expires-at="sessionExpiresAt"
          :watch-stats="watchStats"
          :to-time="toTime"
          @logout="logout"
        />

        <section class="reveal reveal-delay-1 mt-4 rounded-[1.5rem] border border-zinc-200/75 bg-white/88 px-4 shadow-[0_18px_38px_-16px_rgba(7,13,20,0.12)] md:px-6">
          <nav class="flex gap-2 border-b border-zinc-200/80" aria-label="工作台页面导航">
            <RouterLink
              :to="{ name: 'profile' }"
              class="group relative inline-flex min-w-fit items-center px-3 py-3.5 text-sm font-semibold tracking-[0.02em] transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/80 focus-visible:ring-offset-2"
              :class="isAccountSectionActive('profile') ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-800'"
            >
              监控工作台
              <span
                class="pointer-events-none absolute inset-x-2 -bottom-[1px] h-0.5 rounded-full transition duration-300"
                :class="isAccountSectionActive('profile') ? 'bg-zinc-900 opacity-100' : 'bg-zinc-400 opacity-0 group-hover:opacity-100'"
              />
            </RouterLink>

            <RouterLink
              :to="{ name: 'security' }"
              class="group relative inline-flex min-w-fit items-center px-3 py-3.5 text-sm font-semibold tracking-[0.02em] transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/80 focus-visible:ring-offset-2"
              :class="isAccountSectionActive('security') ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-800'"
            >
              账号安全
              <span
                class="pointer-events-none absolute inset-x-2 -bottom-[1px] h-0.5 rounded-full transition duration-300"
                :class="isAccountSectionActive('security') ? 'bg-zinc-900 opacity-100' : 'bg-zinc-400 opacity-0 group-hover:opacity-100'"
              />
            </RouterLink>
          </nav>
        </section>

        <section class="reveal reveal-delay-1 mt-4 grid gap-4 lg:grid-cols-[0.98fr_1.02fr]">
          <ProfileWatchFormCard
            v-model:app-id="form.appId"
            v-model:country="form.country"
            v-model:target-price="form.targetPrice"
            :country-options="countryOptions"
            :creating="creating"
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
          v-model:history-target-price="historyTargetPrice"
          :selected-history="selectedHistory"
          :selected-subscription="selectedSubscription"
          :selected-app-label="selectedAppLabel"
          :updating-history-target="updatingHistoryTarget"
          :loading-history="loadingHistory"
          :target-rule-text="targetRuleText"
          :to-money="toMoney"
          @save-target-price="saveHistoryTargetPrice"
        />
      </template>

      <section
        v-else
        class="reveal rounded-[2rem] border border-zinc-200/70 bg-white/92 p-6 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)]"
      >
        <p class="metric-mono text-xs tracking-[0.2em] text-zinc-500">
          AUTH
        </p>
        <h2 class="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
          登录状态已失效
        </h2>
        <p class="mt-2 text-sm text-zinc-600">
          请重新登录后再进入工作台或账号安全页面。
        </p>
        <RouterLink
          to="/auth"
          class="mt-4 inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px]"
        >
          前往登录
        </RouterLink>
      </section>
    </div>
  </main>
</template>
