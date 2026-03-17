<script setup lang="ts">
import type { AuthUser, SecurityPasswordForm } from './types'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { clearStoredToken, getStoredToken } from '../../lib/auth-session'
import { formatDateTime } from '../../lib/format'
import { buildApiUrl, parseApiErrorText } from '../../lib/http'
import { useToast } from '../../lib/toast'
import { MIN_PASSWORD_LENGTH } from '../auth/constants'
import SecurityPasswordCard from './components/SecurityPasswordCard.vue'

const router = useRouter()
const route = useRoute()

type AccountSection = 'profile' | 'security'

const token = ref(getStoredToken())
const currentUser = ref<AuthUser | null>(null)
const sessionExpiresAt = ref('')
const restoringSession = ref(true)
const changingPassword = ref(false)
const successText = ref('')
const errorText = ref('')
const toast = useToast()

const form = reactive<SecurityPasswordForm>({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

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

function toTime(value: string): string {
  return formatDateTime(value)
}

function resetMessages(): void {
  successText.value = ''
  errorText.value = ''
}

function clearSession(): void {
  token.value = ''
  currentUser.value = null
  sessionExpiresAt.value = ''
  clearStoredToken()
}

function mapChangePasswordError(message: string): string {
  if (message === 'Current password is incorrect') {
    return '当前密码不正确。若你刚完成重置密码，请输入最新密码。'
  }

  if (message === 'Unauthorized') {
    return '登录状态已失效，请重新登录后再试。'
  }

  return message
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

async function loadCurrentUser(): Promise<void> {
  if (!token.value) {
    restoringSession.value = false
    return
  }

  try {
    const me = await apiRequest<{ user: AuthUser }>('/api/auth/me', {}, { auth: true })
    currentUser.value = me.user
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

async function changePassword(): Promise<void> {
  resetMessages()

  if (!currentUser.value) {
    errorText.value = '请先完成登录。'
    return
  }

  const currentPassword = form.currentPassword
  const newPassword = form.newPassword
  const confirmPassword = form.confirmPassword

  if (!currentPassword || !newPassword || !confirmPassword) {
    errorText.value = '请填写当前密码、新密码和确认密码。'
    return
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    errorText.value = `新密码长度需不少于 ${MIN_PASSWORD_LENGTH} 位。`
    return
  }

  if (newPassword !== confirmPassword) {
    errorText.value = '两次输入的新密码不一致。'
    return
  }

  if (newPassword === currentPassword) {
    errorText.value = '新密码不能与当前密码相同。'
    return
  }

  changingPassword.value = true

  try {
    await apiRequest<{ ok: boolean }>(
      '/api/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      },
      { auth: true },
    )

    form.currentPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
    successText.value = '密码已更新，其他设备会话已失效，当前设备保持登录。'
  }
  catch (error) {
    errorText.value = error instanceof Error ? mapChangePasswordError(error.message) : '密码修改失败，请稍后重试。'
  }
  finally {
    changingPassword.value = false
  }
}

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
        <section class="reveal rounded-[2rem] border border-zinc-200/70 bg-white/92 p-6 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)]">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="metric-mono text-xs tracking-[0.22em] text-zinc-500">
                SECURITY
              </p>
              <h1 class="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl">
                账号安全中心
              </h1>
              <p class="mt-2 text-sm text-zinc-600">
                当前账号：{{ currentUser.email }}
              </p>
              <p v-if="sessionExpiresAt" class="mt-1 text-xs text-zinc-500">
                会话有效期至：{{ toTime(sessionExpiresAt) }}
              </p>
            </div>
            <button
              class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px]"
              type="button"
              @click="logout"
            >
              退出账号
            </button>
          </div>
        </section>

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

        <SecurityPasswordCard
          v-model:current-password="form.currentPassword"
          v-model:new-password="form.newPassword"
          v-model:confirm-password="form.confirmPassword"
          :submitting="changingPassword"
          :min-password-length="MIN_PASSWORD_LENGTH"
          @submit="changePassword"
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
          请重新登录后再进入账号安全页面。
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
