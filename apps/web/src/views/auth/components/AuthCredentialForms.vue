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
  <div class="mt-5">
    <article class="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4 md:p-5">
      <template v-if="props.showResetPanel">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <p class="text-xs tracking-[0.16em] text-zinc-500">
              RECOVERY
            </p>
            <h2 class="mt-1 text-lg font-semibold tracking-tight text-zinc-900">
              找回访问权限
            </h2>
          </div>
          <button
            class="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-400 hover:text-zinc-900 active:translate-y-[1px]"
            type="button"
            @click="emit('closeResetPanel')"
          >
            返回登录
          </button>
        </div>

        <div class="grid gap-4">
          <form class="grid gap-3 rounded-xl border border-zinc-200 bg-white p-3.5" @submit.prevent="emit('sendResetEmail')">
            <h3 class="text-sm font-semibold text-zinc-900">
              第一步：发送重置邮件
            </h3>
            <label class="grid gap-2">
              <span class="text-sm font-medium text-zinc-700">邮箱地址</span>
              <input
                v-model="resetEmail"
                type="email"
                autocomplete="email"
                placeholder="输入邮箱地址"
                required
                class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                @blur="emit('syncPrimaryEmail', resetEmail)"
              >
            </label>
            <button
              class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              :disabled="props.resetSending"
            >
              {{ props.resetSending ? '发送中...' : '发送重置邮件' }}
            </button>
          </form>

          <form class="grid gap-3 rounded-xl border border-zinc-200 bg-white p-3.5" @submit.prevent="emit('resetPassword')">
            <h3 class="text-sm font-semibold text-zinc-900">
              第二步：完成密码重置
            </h3>
            <label class="grid gap-2">
              <span class="text-sm font-medium text-zinc-700">重置令牌</span>
              <input
                v-model="resetToken"
                type="text"
                placeholder="粘贴邮件中的重置令牌"
                required
                class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
            </label>
            <label class="grid gap-2">
              <span class="text-sm font-medium text-zinc-700">新密码（至少 8 位）</span>
              <input
                v-model="resetNewPassword"
                type="password"
                :minlength="minPasswordLength"
                placeholder="请输入新密码"
                required
                class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
            </label>
            <button
              class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              :disabled="props.resetSubmitting"
            >
              {{ props.resetSubmitting ? '提交中...' : '更新密码' }}
            </button>
          </form>
        </div>
      </template>

      <form v-else-if="props.authMode === 'register'" class="grid gap-3" @submit.prevent="emit('submitRegister')">
        <div class="mb-1">
          <p class="text-xs tracking-[0.16em] text-zinc-500">
            CREATE ACCOUNT
          </p>
          <h2 class="mt-1 text-lg font-semibold tracking-tight text-zinc-900">
            创建新账号
          </h2>
        </div>

        <label class="grid gap-2">
          <span class="text-sm font-medium text-zinc-700">邮箱地址</span>
          <input
            v-model="authEmail"
            type="email"
            autocomplete="email"
            placeholder="输入邮箱地址"
            required
            class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            @blur="emit('syncPrimaryEmail', authEmail)"
          >
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-medium text-zinc-700">密码（至少 8 位）</span>
          <input
            v-model="authPassword"
            type="password"
            autocomplete="new-password"
            placeholder="请输入密码"
            :minlength="minPasswordLength"
            required
            class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
        </label>

        <AuthOtpCodeField
          v-model="registerCode"
          label="6 位注册验证码"
          placeholder="输入 6 位验证码"
          :sending="props.codeSending"
          :can-resend="props.loginCodeCanResend"
          :cooldown-seconds="props.loginCodeCooldownSeconds"
          @send="emit('sendRegisterCode')"
        />

        <p class="text-xs text-zinc-500">
          创建账号前需要先完成邮箱验证码校验。
        </p>

        <button
          class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          :disabled="props.authLoading"
        >
          {{ props.authLoading ? '提交中...' : '创建账号' }}
        </button>
      </form>

      <form v-else-if="props.loginMethod === 'password'" class="grid gap-3" @submit.prevent="emit('submitAuth')">
        <div class="mb-1">
          <p class="text-xs tracking-[0.16em] text-zinc-500">
            SIGN IN
          </p>
          <h2 class="mt-1 text-lg font-semibold tracking-tight text-zinc-900">
            邮箱密码登录
          </h2>
        </div>

        <label class="grid gap-2">
          <span class="text-sm font-medium text-zinc-700">邮箱地址</span>
          <input
            v-model="authEmail"
            type="email"
            autocomplete="email"
            placeholder="输入邮箱地址"
            required
            class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            @blur="emit('syncPrimaryEmail', authEmail)"
          >
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-medium text-zinc-700">密码（至少 8 位）</span>
          <input
            v-model="authPassword"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码"
            :minlength="minPasswordLength"
            required
            class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
        </label>

        <button
          class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          :disabled="props.authLoading"
        >
          {{ props.authLoading ? '提交中...' : '登录' }}
        </button>

        <div class="mt-1 flex items-center justify-between gap-2 text-xs">
          <button
            class="inline-flex items-center rounded px-1 py-1 font-medium text-zinc-600 transition hover:text-zinc-900"
            type="button"
            @click="emit('setLoginMethod', 'code')"
          >
            使用邮箱验证码登录
          </button>
          <button
            class="inline-flex items-center rounded px-1 py-1 font-medium text-zinc-600 transition hover:text-zinc-900"
            type="button"
            @click="emit('openResetPanel')"
          >
            忘记密码？
          </button>
        </div>
      </form>

      <form v-else class="grid gap-3" @submit.prevent="emit('verifyLoginCode')">
        <div class="mb-1">
          <p class="text-xs tracking-[0.16em] text-zinc-500">
            EMAIL OTP
          </p>
          <h2 class="mt-1 text-lg font-semibold tracking-tight text-zinc-900">
            邮箱验证码登录
          </h2>
        </div>

        <label class="grid gap-2">
          <span class="text-sm font-medium text-zinc-700">邮箱地址</span>
          <input
            v-model="codeEmail"
            type="email"
            autocomplete="email"
            placeholder="输入邮箱地址"
            required
            class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            @blur="emit('syncPrimaryEmail', codeEmail)"
          >
        </label>

        <AuthOtpCodeField
          v-model="code"
          label="6 位登录验证码"
          placeholder="输入 6 位验证码"
          :sending="props.codeSending"
          :can-resend="props.loginCodeCanResend"
          :cooldown-seconds="props.loginCodeCooldownSeconds"
          @send="emit('sendLoginCode')"
        />

        <p class="text-xs text-zinc-500">
          验证码通常在 1 分钟内送达，首次使用该邮箱验证码登录会自动创建账号。
        </p>

        <button
          class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          :disabled="props.codeVerifying"
        >
          {{ props.codeVerifying ? '验证中...' : '验证并登录' }}
        </button>

        <div class="mt-1 flex items-center justify-between gap-2 text-xs">
          <button
            class="inline-flex items-center rounded px-1 py-1 font-medium text-zinc-600 transition hover:text-zinc-900"
            type="button"
            @click="emit('setLoginMethod', 'password')"
          >
            使用密码登录
          </button>
          <button
            class="inline-flex items-center rounded px-1 py-1 font-medium text-zinc-600 transition hover:text-zinc-900"
            type="button"
            @click="emit('openResetPanel')"
          >
            忘记密码？
          </button>
        </div>
      </form>
    </article>
  </div>
</template>
