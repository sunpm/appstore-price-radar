<script setup lang="ts">
import type { SecurityPasswordForm } from './types'
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthedApi } from '../../composables/useAuthedApi'
import { useAuthSession } from '../../composables/useAuthSession'
import { formatDateTime } from '../../lib/format'
import { useToast } from '../../lib/toast'
import { MIN_PASSWORD_LENGTH } from '../auth/constants'
import SecurityPasswordCard from './components/SecurityPasswordCard.vue'

const router = useRouter()
const UNAUTHORIZED_MESSAGE = '登录状态已失效，请重新登录。'

const { currentUser, sessionExpiresAt, restoreSession, clearSession } = useAuthSession()
const { request: authedRequest, toAuthedErrorMessage } = useAuthedApi()
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

function toTime(value: string): string {
  return formatDateTime(value)
}

function resetMessages(): void {
  successText.value = ''
  errorText.value = ''
}

function mapChangePasswordError(message: string): string {
  if (message === 'Current password is incorrect') {
    return '当前密码不正确。若你刚完成重置密码，请输入最新密码。'
  }

  if (message === 'Unauthorized' || message === UNAUTHORIZED_MESSAGE) {
    return UNAUTHORIZED_MESSAGE
  }

  return message
}

async function loadCurrentUser(): Promise<void> {
  await restoreSession()

  if (!currentUser.value) {
    errorText.value = UNAUTHORIZED_MESSAGE
    restoringSession.value = false
    await router.replace('/auth')
    return
  }

  restoringSession.value = false
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
    await authedRequest<{ ok: boolean }>(
      '/api/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      },
    )

    form.currentPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
    successText.value = '密码已更新，其他设备会话已失效，当前设备保持登录。'
  }
  catch (error) {
    errorText.value = mapChangePasswordError(
      toAuthedErrorMessage(error, '密码修改失败，请稍后重试。'),
    )
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
  <main class="radar-app">
    <div class="radar-container pb-12 pt-5 md:pb-14 md:pt-6">
      <div v-if="restoringSession" class="grid gap-4 md:grid-cols-2">
        <div class="skeleton-box h-24 rounded-[1rem]" />
        <div class="skeleton-box h-24 rounded-[1rem]" />
      </div>

      <template v-else-if="currentUser">
        <section class="reveal radar-panel-strong p-6 md:p-8">
          <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-end">
            <div>
              <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-500">
                账号安全
              </p>
              <h1 class="mt-2 font-['Space_Grotesk'] text-3xl font-bold tracking-[-0.05em] text-slate-950 md:text-[3rem]">
                账号安全中心
              </h1>
              <p class="mt-3 text-sm leading-6 text-slate-600">
                当前账号：{{ currentUser.email }}
              </p>
              <p v-if="sessionExpiresAt" class="mt-1 text-sm text-slate-600">
                会话有效期至：{{ toTime(sessionExpiresAt) }}
              </p>
            </div>

            <div class="flex justify-start lg:justify-end">
              <button
                class="radar-button-secondary"
                type="button"
                @click="logout"
              >
                退出账号
              </button>
            </div>
          </div>
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
        class="reveal radar-panel-strong p-6"
      >
        <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-400">
          AUTH
        </p>
        <h2 class="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-slate-950">
          登录状态已失效
        </h2>
        <p class="mt-2 text-sm leading-6 text-slate-500">
          请重新登录后再进入账号安全页面。
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
