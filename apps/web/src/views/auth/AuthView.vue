<script setup lang="ts">
// @env browser

import type { AuthMode, AuthResponse, AuthViewMode, LoginMethod, SendCodeResponse } from './types'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthedApi } from '../../composables/useAuthedApi'
import { useAuthSession } from '../../composables/useAuthSession'
import { apiRequest } from '../../lib/api-client'
import { formatDateTime } from '../../lib/format'
import { buildApiUrl } from '../../lib/http'
import { useToast } from '../../lib/toast'
import AuthCredentialForms from './components/AuthCredentialForms.vue'
import AuthHeaderBlock from './components/AuthHeaderBlock.vue'
import AuthModeSwitcher from './components/AuthModeSwitcher.vue'
import AuthSessionPanel from './components/AuthSessionPanel.vue'
import { useAuthFeedback } from './composables/useAuthFeedback'
import { useCooldownTimer } from './composables/useCooldownTimer'
import {
  DEFAULT_LOGIN_CODE_COOLDOWN_SECONDS,
  MIN_PASSWORD_LENGTH,
  OPEN_RESET_PANEL_QUERY_PARAM,
  OTP_CODE_PATTERN,
  RESET_TOKEN_QUERY_PARAM,
} from './constants'

const props = withDefaults(
  defineProps<{
    mode?: AuthViewMode
    redirectOnSuccess?: boolean
  }>(),
  {
    mode: 'page',
    redirectOnSuccess: false,
  },
)
const emit = defineEmits<{
  authenticated: []
}>()
const router = useRouter()
const authMode = ref<AuthMode>('login')
const loginMethod = ref<LoginMethod>('password')
const showResetPanel = ref(false)
const isPageMode = computed((): boolean => props.mode === 'page')
const {
  seconds: loginCodeCooldownSeconds,
  canTrigger: loginCodeCanResend,
  start: startLoginCodeCooldown,
} = useCooldownTimer()

const authForm = reactive({
  email: '',
  password: '',
})

const codeForm = reactive({
  email: '',
  code: '',
})

const registerCode = ref('')

const resetForm = reactive({
  email: '',
  token: '',
  newPassword: '',
})

const { token, currentUser, sessionExpiresAt, applySession, clearSession, restoreSession } = useAuthSession()
const { request: authedRequest } = useAuthedApi()
const restoringSession = ref(true)
const toast = useToast()
const { successText, errorText, resetMessages, resolveErrorMessage } = useAuthFeedback(toast)

const authLoading = ref(false)
const codeSending = ref(false)
const codeVerifying = ref(false)
const resetSending = ref(false)
const resetSubmitting = ref(false)

function setAuthMode(mode: AuthMode): void {
  authMode.value = mode

  if (mode !== 'login') {
    showResetPanel.value = false
  }

  if (mode === 'register') {
    loginMethod.value = 'password'
  }
}

function setLoginMethod(method: LoginMethod): void {
  loginMethod.value = method
  showResetPanel.value = false
}

function setPrimaryEmail(email: string): void {
  const next = email.trim()

  if (!next) {
    return
  }

  authForm.email = next
  codeForm.email = next
  resetForm.email = next
}

function toTime(value: string): string {
  return formatDateTime(value)
}

function applyAuthSession(next: AuthResponse): void {
  applySession(next)
  setPrimaryEmail(next.user.email)
}

async function loadCurrentUser(): Promise<void> {
  if (!token.value) {
    restoringSession.value = false
    return
  }

  await restoreSession()

  if (currentUser.value) {
    setPrimaryEmail(currentUser.value.email)
  }

  restoringSession.value = false
}

async function onAuthenticated(): Promise<void> {
  emit('authenticated')

  if (props.redirectOnSuccess) {
    await router.push('/profile')
  }
}

async function submitAuth(): Promise<void> {
  resetMessages()

  const email = authForm.email.trim()
  const password = authForm.password

  if (!email || !password) {
    errorText.value = '请填写邮箱和密码。'
    return
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    errorText.value = '密码长度需不少于 8 位。'
    return
  }

  authLoading.value = true

  try {
    const data = await apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    applyAuthSession(data)
    authForm.password = ''
    successText.value = props.redirectOnSuccess ? '登录成功，正在进入我的订阅。' : '登录成功。'

    await onAuthenticated()
  }
  catch (error) {
    errorText.value = resolveErrorMessage(error, '登录失败，请稍后重试。')
  }
  finally {
    authLoading.value = false
  }
}

async function submitRegister(): Promise<void> {
  resetMessages()

  const email = authForm.email.trim()
  const password = authForm.password
  const code = registerCode.value.trim()

  if (!email || !password || !code) {
    errorText.value = '请填写邮箱、密码和验证码。'
    return
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    errorText.value = '密码长度需不少于 8 位。'
    return
  }

  if (!OTP_CODE_PATTERN.test(code)) {
    errorText.value = '验证码需为 6 位数字。'
    return
  }

  authLoading.value = true

  try {
    const data = await apiRequest<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, code }),
    })

    applyAuthSession(data)
    authForm.password = ''
    registerCode.value = ''
    successText.value = props.redirectOnSuccess ? '账号创建成功，正在进入我的订阅。' : '账号创建成功。'

    await onAuthenticated()
  }
  catch (error) {
    errorText.value = resolveErrorMessage(error, '账号创建失败，请稍后重试。')
  }
  finally {
    authLoading.value = false
  }
}

async function requestLoginCode(emailInput: string, sceneLabel: string): Promise<void> {
  const email = emailInput.trim()

  if (!email) {
    errorText.value = '请输入邮箱地址。'
    return
  }

  if (!loginCodeCanResend.value) {
    errorText.value = `发送过于频繁，请在 ${loginCodeCooldownSeconds.value} 秒后重试。`
    return
  }

  codeSending.value = true

  try {
    const res = await fetch(buildApiUrl('/api/auth/send-login-code'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    const payload = (await res.json().catch(() => ({}))) as SendCodeResponse

    if (!res.ok) {
      if (res.status === 429 && 'retryAfterSeconds' in payload && payload.retryAfterSeconds) {
        startLoginCodeCooldown(payload.retryAfterSeconds)
      }

      const message
        = ('error' in payload && typeof payload.error === 'string')
          ? payload.error
          : `Request failed with status ${res.status}`

      throw new Error(message)
    }

    setPrimaryEmail(email)
    const cooldownSeconds
      = ('cooldownSeconds' in payload && payload.cooldownSeconds)
        ? payload.cooldownSeconds
        : DEFAULT_LOGIN_CODE_COOLDOWN_SECONDS
    startLoginCodeCooldown(cooldownSeconds)
    successText.value = `${sceneLabel}验证码已发送，请前往邮箱查收。${cooldownSeconds > 0 ? ` ${cooldownSeconds} 秒后可重新发送。` : ''}`
  }
  catch (error) {
    errorText.value = resolveErrorMessage(error, '验证码发送失败，请稍后重试。')
  }
  finally {
    codeSending.value = false
  }
}

async function sendLoginCode(): Promise<void> {
  resetMessages()
  await requestLoginCode(codeForm.email, '登录')
}

async function sendRegisterCode(): Promise<void> {
  resetMessages()
  await requestLoginCode(authForm.email, '注册')
}

async function verifyLoginCode(): Promise<void> {
  resetMessages()

  const email = codeForm.email.trim()
  const code = codeForm.code.trim()

  if (!email || !code) {
    errorText.value = '请填写邮箱和验证码。'
    return
  }

  if (!OTP_CODE_PATTERN.test(code)) {
    errorText.value = '验证码需为 6 位数字。'
    return
  }

  codeVerifying.value = true

  try {
    const data = await apiRequest<AuthResponse>('/api/auth/verify-login-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })

    applyAuthSession(data)
    codeForm.code = ''
    successText.value = props.redirectOnSuccess ? '登录成功，正在进入我的订阅。' : '登录成功。'

    await onAuthenticated()
  }
  catch (error) {
    errorText.value = resolveErrorMessage(error, '验证码登录失败，请稍后重试。')
  }
  finally {
    codeVerifying.value = false
  }
}

async function sendResetEmail(): Promise<void> {
  resetMessages()

  const email = resetForm.email.trim()

  if (!email) {
    errorText.value = '请输入邮箱地址。'
    return
  }

  resetSending.value = true

  try {
    await apiRequest<{ ok: boolean }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })

    setPrimaryEmail(email)
    successText.value = '若邮箱已注册，重置邮件已发送，请注意查收。'
  }
  catch (error) {
    errorText.value = resolveErrorMessage(error, '重置邮件发送失败，请稍后重试。')
  }
  finally {
    resetSending.value = false
  }
}

function openResetPanel(): void {
  authMode.value = 'login'
  loginMethod.value = 'password'
  showResetPanel.value = true
}

function closeResetPanel(): void {
  showResetPanel.value = false
}

function shouldOpenResetPanel(value: string | null): boolean {
  return value === '1' || value === 'true'
}

async function resetPassword(): Promise<void> {
  resetMessages()

  const tokenText = resetForm.token.trim()
  const newPassword = resetForm.newPassword

  if (!tokenText || !newPassword) {
    errorText.value = '请填写重置令牌和新密码。'
    return
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    errorText.value = '新密码长度需不少于 8 位。'
    return
  }

  resetSubmitting.value = true

  try {
    await apiRequest<{ ok: boolean }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: tokenText, password: newPassword }),
    })

    clearSession()
    resetForm.token = ''
    resetForm.newPassword = ''
    authMode.value = 'login'
    loginMethod.value = 'password'
    showResetPanel.value = false
    successText.value = '密码已更新，请使用新密码重新登录。'
  }
  catch (error) {
    errorText.value = resolveErrorMessage(error, '密码重置失败，请稍后重试。')
  }
  finally {
    resetSubmitting.value = false
  }
}

async function logout(): Promise<void> {
  resetMessages()

  try {
    await authedRequest<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
  }
  catch {
    // Ignore server logout errors and clear local session anyway.
  }

  clearSession()
  successText.value = '已退出登录。'
}

onMounted(async (): Promise<void> => {
  if (isPageMode.value) {
    const url = new URL(window.location.href)
    const openResetPanel = shouldOpenResetPanel(url.searchParams.get(OPEN_RESET_PANEL_QUERY_PARAM))
    const resetToken = url.searchParams.get(RESET_TOKEN_QUERY_PARAM)

    if (openResetPanel || resetToken) {
      showResetPanel.value = true
    }

    if (resetToken) {
      resetForm.token = resetToken
      successText.value = '已识别重置令牌，请填写新密码后提交。'
    }
    else if (openResetPanel) {
      successText.value = '请输入邮箱并重置密码。'
    }

    if (openResetPanel || resetToken) {
      url.searchParams.delete(OPEN_RESET_PANEL_QUERY_PARAM)
      url.searchParams.delete(RESET_TOKEN_QUERY_PARAM)
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }

  await loadCurrentUser()
})
</script>

<template>
  <main class="text-zinc-900" :class="[isPageMode ? 'min-h-[100dvh] bg-zinc-100' : '']">
    <div
      v-if="isPageMode"
      class="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_10%,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_88%_6%,rgba(15,23,42,0.08),transparent_35%),linear-gradient(160deg,#f4f7f7_0%,#eef3f2_48%,#f8f8f8_100%)]"
    />

    <div :class="isPageMode ? 'mx-auto max-w-[980px] px-4 py-6 md:px-8 md:py-10' : ''">
      <section
        :class="
          isPageMode
            ? 'reveal rounded-[2rem] border border-zinc-200/70 bg-white/92 p-6 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)]'
            : 'rounded-[1.5rem] border border-zinc-200/80 bg-white p-5 shadow-[0_18px_38px_-16px_rgba(7,13,20,0.22)] md:p-6'
        "
      >
        <AuthHeaderBlock :is-page-mode="isPageMode" />

        <div v-if="restoringSession" class="mt-4 grid gap-3 md:grid-cols-2">
          <div class="skeleton-box h-24 rounded-2xl" />
          <div class="skeleton-box h-24 rounded-2xl" />
        </div>

        <AuthSessionPanel
          v-else-if="currentUser && !showResetPanel"
          :current-user="currentUser"
          :session-expires-at="sessionExpiresAt"
          :to-time="toTime"
          @logout="logout"
        />

        <template v-else>
          <AuthModeSwitcher v-if="!showResetPanel" :mode="authMode" @change="setAuthMode" />

          <AuthCredentialForms
            v-model:auth-email="authForm.email"
            v-model:auth-password="authForm.password"
            v-model:code-email="codeForm.email"
            v-model:code="codeForm.code"
            v-model:register-code="registerCode"
            v-model:reset-email="resetForm.email"
            v-model:reset-token="resetForm.token"
            v-model:reset-new-password="resetForm.newPassword"
            :auth-mode="authMode"
            :login-method="loginMethod"
            :show-reset-panel="showResetPanel"
            :auth-loading="authLoading"
            :code-sending="codeSending"
            :code-verifying="codeVerifying"
            :reset-sending="resetSending"
            :reset-submitting="resetSubmitting"
            :login-code-cooldown-seconds="loginCodeCooldownSeconds"
            :login-code-can-resend="loginCodeCanResend"
            @submit-auth="submitAuth"
            @submit-register="submitRegister"
            @send-login-code="sendLoginCode"
            @send-register-code="sendRegisterCode"
            @verify-login-code="verifyLoginCode"
            @set-login-method="setLoginMethod"
            @open-reset-panel="openResetPanel"
            @close-reset-panel="closeResetPanel"
            @send-reset-email="sendResetEmail"
            @reset-password="resetPassword"
            @sync-primary-email="setPrimaryEmail"
          />
        </template>
      </section>
    </div>
  </main>
</template>
