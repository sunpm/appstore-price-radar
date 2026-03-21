<script setup lang="ts">
import type { SubscriptionItem, WatchStats } from './types'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthedApi } from '../../composables/useAuthedApi'
import { useAuthSession } from '../../composables/useAuthSession'
import { COUNTRY_OPTIONS, resolveCountryLabel } from '../../constants/countries'
import { formatDateTime, formatMoney } from '../../lib/format'
import { useToast } from '../../lib/toast'
import ProfileDashboardHeader from './components/ProfileDashboardHeader.vue'
import ProfileSubscriptionListCard from './components/ProfileSubscriptionListCard.vue'
import ProfileWatchFormCard from './components/ProfileWatchFormCard.vue'

const router = useRouter()
const countryOptions = COUNTRY_OPTIONS
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/

function countryLabel(countryCode: string): string {
  return resolveCountryLabel(countryCode)
}

const { currentUser, sessionExpiresAt, restoreSession, clearSession, isAuthenticated } = useAuthSession()
const { request: authedRequest, toAuthedErrorMessage, unauthorizedMessage } = useAuthedApi()
const unauthorizedHint = '登录状态已失效，请重新登录。'
const restoringSession = ref(true)
const toast = useToast()

const form = reactive({
  appId: '',
  country: 'CN',
  targetPrice: '',
})

const subscriptions = ref<SubscriptionItem[]>([])
const loadingList = ref(false)
const creating = ref(false)

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

function resetMessages(): void {
  successText.value = ''
  errorText.value = ''
}

function resetDashboardState(): void {
  subscriptions.value = []
}

async function handleAuthedError(error: unknown, fallback: string): Promise<void> {
  const message = toAuthedErrorMessage(error, fallback)
  errorText.value = message

  if (message === unauthorizedMessage || message === unauthorizedHint) {
    resetDashboardState()
  }
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

async function loadCurrentUser(): Promise<void> {
  if (!isAuthenticated.value) {
    restoringSession.value = false
    return
  }

  await restoreSession()

  if (!currentUser.value) {
    errorText.value = unauthorizedHint
    resetDashboardState()
    await router.replace('/auth')
    restoringSession.value = false
    return
  }

  await loadSubscriptions({ silent: true })
  restoringSession.value = false
}

async function logout(): Promise<void> {
  resetMessages()

  try {
    await authedRequest<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
    })
  }
  catch {
    // Ignore server logout errors and clear local session anyway.
  }

  clearSession()
  resetDashboardState()
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
    const data = await authedRequest<{ items: SubscriptionItem[] }>('/api/subscriptions')

    subscriptions.value = data.items

    if (!options.silent) {
      successText.value = `已同步 ${data.items.length} 条监控任务。`
    }
  }
  catch (error) {
    await handleAuthedError(error, '监控任务加载失败，请稍后重试。')
  }
  finally {
    loadingList.value = false
  }
}

async function createSubscription(): Promise<void> {
  resetMessages()

  if (!currentUser.value) {
    errorText.value = '请先登录。'
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
    const data = await authedRequest<{ subscription: SubscriptionItem }>(
      '/api/subscriptions',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )

    successText.value = `监控任务已创建：${data.subscription.appId}（${countryLabel(data.subscription.country)}）`

    form.appId = ''
    form.targetPrice = ''

    await loadSubscriptions({ silent: true })
  }
  catch (error) {
    await handleAuthedError(error, '监控任务创建失败，请稍后重试。')
  }
  finally {
    creating.value = false
  }
}

async function removeSubscription(id: string): Promise<void> {
  resetMessages()

  try {
    await authedRequest<{ ok: boolean }>(
      `/api/subscriptions/${id}`,
      {
        method: 'DELETE',
      },
    )

    successText.value = '监控任务已移除。'
    await loadSubscriptions({ silent: true })
  }
  catch (error) {
    await handleAuthedError(error, '任务移除失败，请稍后重试。')
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
  <main class="radar-app">
    <div class="radar-container pb-12 pt-5 md:pb-14 md:pt-6">
      <div v-if="restoringSession" class="grid gap-4 md:grid-cols-2">
        <div class="skeleton-box h-24 rounded-[1rem]" />
        <div class="skeleton-box h-24 rounded-[1rem]" />
      </div>

      <template v-else-if="currentUser">
        <ProfileDashboardHeader
          :current-user-email="currentUser.email"
          :session-expires-at="sessionExpiresAt"
          :watch-stats="watchStats"
          :to-time="toTime"
          @logout="logout"
        />

        <section class="reveal reveal-delay-1 mt-4 grid gap-3 xl:grid-cols-[340px_minmax(0,1fr)]">
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
            :to-time="toTime"
            :target-rule-text="targetRuleText"
            @refresh="loadSubscriptions()"
            @remove="removeSubscription($event)"
          />
        </section>
      </template>

      <section
        v-else
        class="reveal radar-panel-strong p-6"
      >
        <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-400">
          AUTH
        </p>
        <h2 class="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-slate-950">
          登录状态已失效
        </h2>
        <p class="mt-2 text-sm leading-6 text-slate-500">
          请重新登录。
        </p>
        <RouterLink
          to="/auth"
          class="radar-button-primary mt-5"
        >
          前往登录
        </RouterLink>
      </section>
    </div>
  </main>
</template>
