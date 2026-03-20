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

const {
  token,
  currentUser,
  sessionExpiresAt,
  applySession,
  clearSession,
  restoreSession,
} = useAuthSession()
const { request: authedRequest } = useAuthedApi()
const restoringSession = ref(true)
const toast = useToast()
const { successText, errorText, resetMessages, resolveErrorMessage } = useAuthFeedback(toast)

const authLoading = ref(false)
const codeSending = ref(false)
const codeVerifying = ref(false)
const resetSending = ref(false)
const resetSubmitting = ref(false)

const featureCards = computed(() => {
  if (showResetPanel.value) {
    return [
      {
        label: 'RECOVERY',
        title: '重置流程拆成两个动作',
        body: '先发重置邮件，再填写令牌和新密码，避免把不同风险级别的动作混在同一表单里。',
      },
      {
        label: 'TOKEN HANDOFF',
        title: '支持直接识别邮件里的 reset token',
        body: '从链接进入页面时会自动填充令牌，并把页面切到重置视图，减少复制错误。',
      },
      {
        label: 'SAFE EXIT',
        title: '密码更新后回到标准登录流程',
        body: '重置完成会清空旧会话，并提示你使用新密码重新登录。',
      },
    ]
  }

  if (currentUser.value) {
    return [
      {
        label: 'SESSION',
        title: '当前会话已恢复',
        body: '你可以直接进入工作台管理订阅，或退出当前设备会话。',
      },
      {
        label: 'SYNC',
        title: '工作台与安全页共用同一登录状态',
        body: '登录后所有个人监控数据会自动同步，无需重复验证。',
      },
      {
        label: 'CONTINUITY',
        title: '弹层与独立页面使用同一套交互',
        body: '从导航快速登录，或者进入独立认证页，都会走同一套状态逻辑。',
      },
    ]
  }

  return [
    {
      label: 'PASSWORD',
      title: '标准密码登录',
      body: '适合已有账号且经常回访的用户，直接进入工作台继续追踪价格。',
    },
    {
      label: 'EMAIL OTP',
      title: '邮箱验证码登录',
      body: '不想记密码时也能完成登录，首次验证同样可以快速建立账号。',
    },
    {
      label: 'RESET',
      title: '重置密码不离开当前页面',
      body: '发送邮件、填入令牌和设置新密码都在同一入口完成，路径更短。',
    },
  ]
})

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
    errorText.value = `密码长度需不少于 ${MIN_PASSWORD_LENGTH} 位。`
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
    successText.value = props.redirectOnSuccess ? '登录成功，正在进入工作台。' : '登录成功。'

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
    errorText.value = `密码长度需不少于 ${MIN_PASSWORD_LENGTH} 位。`
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
    successText.value = props.redirectOnSuccess ? '账号创建成功，正在进入工作台。' : '账号创建成功。'

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
    successText.value = props.redirectOnSuccess ? '验证成功，正在进入工作台。' : '验证成功，已完成登录。'

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
    errorText.value = `新密码长度需不少于 ${MIN_PASSWORD_LENGTH} 位。`
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
  successText.value = '已安全退出登录。'
}

onMounted(async (): Promise<void> => {
  if (isPageMode.value) {
    const url = new URL(window.location.href)
    const openReset = shouldOpenResetPanel(url.searchParams.get(OPEN_RESET_PANEL_QUERY_PARAM))
    const resetToken = url.searchParams.get(RESET_TOKEN_QUERY_PARAM)

    if (openReset || resetToken) {
      showResetPanel.value = true
    }

    if (resetToken) {
      resetForm.token = resetToken
      successText.value = '已识别重置令牌，请填写新密码后提交。'
    }
    else if (openReset) {
      successText.value = '请输入注册邮箱并完成密码重置流程。'
    }

    if (openReset || resetToken) {
      url.searchParams.delete(OPEN_RESET_PANEL_QUERY_PARAM)
      url.searchParams.delete(RESET_TOKEN_QUERY_PARAM)
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }

  await loadCurrentUser()
})
</script>

<template>
  <main class="radar-app text-slate-900" :class="isPageMode ? 'pb-10 pt-5 md:pb-12 md:pt-6' : ''">
    <div v-if="isPageMode" class="radar-container">
      <section class="reveal grid gap-4 lg:grid-cols-[minmax(0,0.98fr)_300px]">
        <article class="radar-panel-strong p-5 md:p-6">
          <AuthHeaderBlock v-bind="{ isPageMode, showResetPanel }" />

          <div v-if="restoringSession" class="mt-6 grid gap-3 md:grid-cols-2">
            <div class="skeleton-box h-24 rounded-[1rem]" />
            <div class="skeleton-box h-24 rounded-[1rem]" />
          </div>

          <AuthSessionPanel
            v-else-if="currentUser && !showResetPanel"
            :current-user="currentUser"
            :session-expires-at="sessionExpiresAt"
            :to-time="toTime"
            @logout="logout"
          />

          <template v-else>
            <AuthModeSwitcher
              v-if="!showResetPanel"
              :mode="authMode"
              @change="setAuthMode"
            />

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
        </article>

        <aside class="grid gap-3">
          <article class="radar-panel-dark p-4">
            <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-300">
              ENTRY POINT
            </p>
            <h2 class="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.05em] text-white">
              一个入口覆盖登录、注册、验证码与重置
            </h2>
            <p class="mt-3 text-sm leading-6 text-slate-300">
              认证页不再只是一个输入表单，而是一块完整的访问中枢，用来承接整站的会话状态。
            </p>
          </article>

          <article
            v-for="card in featureCards"
            :key="card.title"
            class="radar-panel p-4"
          >
            <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-400">
              {{ card.label }}
            </p>
            <h3 class="mt-2 font-['Space_Grotesk'] text-lg font-bold tracking-[-0.04em] text-slate-950">
              {{ card.title }}
            </h3>
            <p class="mt-2 text-sm leading-6 text-slate-500">
              {{ card.body }}
            </p>
          </article>
        </aside>
      </section>
    </div>

    <section
      v-else
      class="radar-panel-strong p-5 md:p-6"
    >
      <AuthHeaderBlock v-bind="{ isPageMode, showResetPanel }" />

      <div v-if="restoringSession" class="mt-5 grid gap-3 md:grid-cols-2">
        <div class="skeleton-box h-24 rounded-[1rem]" />
        <div class="skeleton-box h-24 rounded-[1rem]" />
      </div>

      <AuthSessionPanel
        v-else-if="currentUser && !showResetPanel"
        :current-user="currentUser"
        :session-expires-at="sessionExpiresAt"
        :to-time="toTime"
        @logout="logout"
      />

      <template v-else>
        <AuthModeSwitcher
          v-if="!showResetPanel"
          :mode="authMode"
          @change="setAuthMode"
        />

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
  </main>
</template>
