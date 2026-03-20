<script setup lang="ts">
import type { AuthMode, LoginMethod } from '../types'
import { MIN_PASSWORD_LENGTH } from '../constants'
import AuthOtpCodeField from './AuthOtpCodeField.vue'

const props = defineProps<{
  authMode: AuthMode
  loginMethod: LoginMethod
  showResetPanel: boolean
  authLoading: boolean
  codeSending: boolean
  codeVerifying: boolean
  resetSending: boolean
  resetSubmitting: boolean
  loginCodeCooldownSeconds: number
  loginCodeCanResend: boolean
}>()

const emit = defineEmits<{
  submitAuth: []
  submitRegister: []
  sendLoginCode: []
  sendRegisterCode: []
  verifyLoginCode: []
  setLoginMethod: [value: LoginMethod]
  openResetPanel: []
  closeResetPanel: []
  sendResetEmail: []
  resetPassword: []
  syncPrimaryEmail: [value: string]
}>()

const authEmail = defineModel<string>('authEmail', { required: true })
const authPassword = defineModel<string>('authPassword', { required: true })
const codeEmail = defineModel<string>('codeEmail', { required: true })
const code = defineModel<string>('code', { required: true })
const registerCode = defineModel<string>('registerCode', { required: true })
const resetEmail = defineModel<string>('resetEmail', { required: true })
const resetToken = defineModel<string>('resetToken', { required: true })
const resetNewPassword = defineModel<string>('resetNewPassword', { required: true })

const minPasswordLength = MIN_PASSWORD_LENGTH
</script>

<template>
  <div class="mt-6">
    <article class="rounded-[1rem] border border-slate-200/78 bg-white/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)] md:p-5">
      <template v-if="props.showResetPanel">
        <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-400">
              PASSWORD RECOVERY
            </p>
            <h2 class="mt-2 font-['Space_Grotesk'] text-xl font-bold tracking-[-0.04em] text-slate-950">
              两步完成密码重置
            </h2>
          </div>
          <button
            type="button"
            class="radar-button-secondary px-4 py-2 text-sm"
            @click="emit('closeResetPanel')"
          >
            收起重置
          </button>
        </div>

        <div class="grid gap-4">
          <form class="radar-soft-card grid gap-3 p-4" @submit.prevent="emit('sendResetEmail')">
            <div>
              <p class="text-sm font-semibold text-slate-900">
                第一步：发送重置邮件
              </p>
              <p class="mt-1 text-sm text-slate-500">
                输入注册邮箱，我们会发送一次性的密码重置链接和令牌。
              </p>
            </div>

            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">邮箱地址</span>
              <input
                v-model="resetEmail"
                type="email"
                autocomplete="email"
                placeholder="输入邮箱地址"
                required
                class="radar-input"
                @blur="emit('syncPrimaryEmail', resetEmail)"
              >
            </label>

            <button
              type="submit"
              class="radar-button-primary"
              :disabled="props.resetSending"
            >
              {{ props.resetSending ? '发送中...' : '发送重置邮件' }}
            </button>
          </form>

          <form class="radar-soft-card grid gap-3 p-4" @submit.prevent="emit('resetPassword')">
            <div>
              <p class="text-sm font-semibold text-slate-900">
                第二步：提交令牌和新密码
              </p>
              <p class="mt-1 text-sm text-slate-500">
                若你从邮件链接打开页面，系统会尽量自动填充令牌。
              </p>
            </div>

            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">重置令牌</span>
              <input
                v-model="resetToken"
                type="text"
                placeholder="粘贴邮件中的重置令牌"
                required
                class="radar-input"
              >
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">新密码</span>
              <input
                v-model="resetNewPassword"
                type="password"
                :minlength="minPasswordLength"
                placeholder="请输入新密码"
                required
                class="radar-input"
              >
            </label>

            <button
              type="submit"
              class="radar-button-primary"
              :disabled="props.resetSubmitting"
            >
              {{ props.resetSubmitting ? '提交中...' : '更新密码' }}
            </button>
          </form>
        </div>
      </template>

      <form v-else-if="props.authMode === 'register'" class="grid gap-4" @submit.prevent="emit('submitRegister')">
        <div>
          <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-400">
            CREATE ACCOUNT
          </p>
          <h2 class="mt-2 font-['Space_Grotesk'] text-xl font-bold tracking-[-0.04em] text-slate-950">
            注册账号并立即开始监控
          </h2>
        </div>

        <label class="grid gap-2">
          <span class="text-sm font-semibold text-slate-700">邮箱地址</span>
          <input
            v-model="authEmail"
            type="email"
            autocomplete="email"
            placeholder="输入邮箱地址"
            required
            class="radar-input"
            @blur="emit('syncPrimaryEmail', authEmail)"
          >
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-semibold text-slate-700">密码（至少 8 位）</span>
          <input
            v-model="authPassword"
            type="password"
            autocomplete="new-password"
            :minlength="minPasswordLength"
            placeholder="请输入密码"
            required
            class="radar-input"
          >
        </label>

        <AuthOtpCodeField
          v-model="registerCode"
          label="6 位注册验证码"
          placeholder="输入邮箱验证码"
          :sending="props.codeSending"
          :can-resend="props.loginCodeCanResend"
          :cooldown-seconds="props.loginCodeCooldownSeconds"
          @send="emit('sendRegisterCode')"
        />

        <p class="text-sm leading-6 text-slate-500">
          注册前需要先完成邮箱验证码校验，这能避免垃圾账号进入监控工作台。
        </p>

        <button
          type="submit"
          class="radar-button-primary"
          :disabled="props.authLoading"
        >
          {{ props.authLoading ? '提交中...' : '创建账号' }}
        </button>
      </form>

      <form v-else-if="props.loginMethod === 'password'" class="grid gap-4" @submit.prevent="emit('submitAuth')">
        <div>
          <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-400">
            PASSWORD LOGIN
          </p>
          <h2 class="mt-2 font-['Space_Grotesk'] text-xl font-bold tracking-[-0.04em] text-slate-950">
            用邮箱和密码继续工作流
          </h2>
        </div>

        <label class="grid gap-2">
          <span class="text-sm font-semibold text-slate-700">邮箱地址</span>
          <input
            v-model="authEmail"
            type="email"
            autocomplete="email"
            placeholder="输入邮箱地址"
            required
            class="radar-input"
            @blur="emit('syncPrimaryEmail', authEmail)"
          >
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-semibold text-slate-700">密码</span>
          <input
            v-model="authPassword"
            type="password"
            autocomplete="current-password"
            :minlength="minPasswordLength"
            placeholder="请输入密码"
            required
            class="radar-input"
          >
        </label>

        <button
          type="submit"
          class="radar-button-primary"
          :disabled="props.authLoading"
        >
          {{ props.authLoading ? '提交中...' : '登录' }}
        </button>

        <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            class="font-semibold text-slate-500 transition duration-300 hover:text-slate-950"
            @click="emit('setLoginMethod', 'code')"
          >
            使用邮箱验证码登录
          </button>
          <button
            type="button"
            class="font-semibold text-slate-500 transition duration-300 hover:text-slate-950"
            @click="emit('openResetPanel')"
          >
            忘记密码？
          </button>
        </div>
      </form>

      <form v-else class="grid gap-4" @submit.prevent="emit('verifyLoginCode')">
        <div>
          <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-400">
            EMAIL OTP
          </p>
          <h2 class="mt-2 font-['Space_Grotesk'] text-xl font-bold tracking-[-0.04em] text-slate-950">
            用验证码快速完成登录
          </h2>
        </div>

        <label class="grid gap-2">
          <span class="text-sm font-semibold text-slate-700">邮箱地址</span>
          <input
            v-model="codeEmail"
            type="email"
            autocomplete="email"
            placeholder="输入邮箱地址"
            required
            class="radar-input"
            @blur="emit('syncPrimaryEmail', codeEmail)"
          >
        </label>

        <AuthOtpCodeField
          v-model="code"
          label="6 位登录验证码"
          placeholder="输入邮箱验证码"
          :sending="props.codeSending"
          :can-resend="props.loginCodeCanResend"
          :cooldown-seconds="props.loginCodeCooldownSeconds"
          @send="emit('sendLoginCode')"
        />

        <p class="text-sm leading-6 text-slate-500">
          验证码通常在一分钟内送达，首次使用该方式的邮箱也可以快速完成账号建立。
        </p>

        <button
          type="submit"
          class="radar-button-primary"
          :disabled="props.codeVerifying"
        >
          {{ props.codeVerifying ? '验证中...' : '验证并登录' }}
        </button>

        <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            class="font-semibold text-slate-500 transition duration-300 hover:text-slate-950"
            @click="emit('setLoginMethod', 'password')"
          >
            使用密码登录
          </button>
          <button
            type="button"
            class="font-semibold text-slate-500 transition duration-300 hover:text-slate-950"
            @click="emit('openResetPanel')"
          >
            忘记密码？
          </button>
        </div>
      </form>
    </article>
  </div>
</template>
