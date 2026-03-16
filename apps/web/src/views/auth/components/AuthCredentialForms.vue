<script setup lang="ts">
type AuthMode = 'login' | 'register' | 'code';

const props = defineProps<{
  authMode: AuthMode;
  redirectOnSuccess: boolean;
  showResetPanel: boolean;
  authLoading: boolean;
  codeSending: boolean;
  codeVerifying: boolean;
  resetSending: boolean;
  resetSubmitting: boolean;
  authEmail: string;
  authPassword: string;
  codeEmail: string;
  code: string;
  resetEmail: string;
  resetToken: string;
  resetNewPassword: string;
}>();

const emit = defineEmits<{
  'update:authEmail': [value: string];
  'update:authPassword': [value: string];
  'update:codeEmail': [value: string];
  'update:code': [value: string];
  'update:resetEmail': [value: string];
  'update:resetToken': [value: string];
  'update:resetNewPassword': [value: string];
  submitAuth: [];
  sendLoginCode: [];
  verifyLoginCode: [];
  toggleResetPanel: [];
  sendResetEmail: [];
  resetPassword: [];
  syncPrimaryEmail: [value: string];
}>();

const readInputValue = (event: Event) => {
  return (event.target as HTMLInputElement).value;
};

const onAuthEmailInput = (event: Event) => {
  emit('update:authEmail', readInputValue(event));
};

const onAuthPasswordInput = (event: Event) => {
  emit('update:authPassword', readInputValue(event));
};

const onCodeEmailInput = (event: Event) => {
  emit('update:codeEmail', readInputValue(event));
};

const onCodeInput = (event: Event) => {
  emit('update:code', readInputValue(event));
};

const onResetEmailInput = (event: Event) => {
  emit('update:resetEmail', readInputValue(event));
};

const onResetTokenInput = (event: Event) => {
  emit('update:resetToken', readInputValue(event));
};

const onResetNewPasswordInput = (event: Event) => {
  emit('update:resetNewPassword', readInputValue(event));
};
</script>

<template>
  <div class="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
    <article
      class="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4"
      :class="props.showResetPanel ? '' : 'md:col-span-2'"
    >
      <form
        v-if="props.authMode === 'login' || props.authMode === 'register'"
        class="grid gap-3"
        @submit.prevent="emit('submitAuth')"
      >
        <label class="grid gap-2">
          <span class="text-sm font-medium text-zinc-700">邮箱地址</span>
          <input
            :value="props.authEmail"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            required
            class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            @input="onAuthEmailInput"
            @blur="emit('syncPrimaryEmail', props.authEmail)"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-medium text-zinc-700">登录密码（至少 8 位）</span>
          <input
            :value="props.authPassword"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码"
            minlength="8"
            required
            class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            @input="onAuthPasswordInput"
          />
        </label>

        <button
          class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          :disabled="props.authLoading"
        >
          {{
            props.authLoading
              ? '提交中...'
              : props.authMode === 'login'
                ? props.redirectOnSuccess
                  ? '登录并进入工作台'
                  : '登录'
                : props.redirectOnSuccess
                  ? '创建账号并进入工作台'
                  : '创建账号'
          }}
        </button>

        <button
          v-if="props.authMode === 'login'"
          class="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-400 hover:text-zinc-900 active:translate-y-[1px]"
          type="button"
          @click="emit('toggleResetPanel')"
        >
          {{ props.showResetPanel ? '收起密码重置' : '忘记密码' }}
        </button>
      </form>

      <form v-else class="grid gap-3" @submit.prevent="emit('verifyLoginCode')">
        <label class="grid gap-2">
          <span class="text-sm font-medium text-zinc-700">邮箱地址</span>
          <input
            :value="props.codeEmail"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            required
            class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            @input="onCodeEmailInput"
            @blur="emit('syncPrimaryEmail', props.codeEmail)"
          />
        </label>

        <button
          class="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-400 hover:text-zinc-900 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          :disabled="props.codeSending"
          @click="emit('sendLoginCode')"
        >
          {{ props.codeSending ? '发送中...' : '发送邮箱验证码' }}
        </button>

        <label class="grid gap-2">
          <span class="text-sm font-medium text-zinc-700">6 位登录验证码</span>
          <input
            :value="props.code"
            type="text"
            maxlength="6"
            inputmode="numeric"
            placeholder="例如 123456"
            required
            class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            @input="onCodeInput"
          />
        </label>

        <button
          class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          :disabled="props.codeVerifying"
        >
          {{ props.codeVerifying ? '验证中...' : props.redirectOnSuccess ? '验证并进入工作台' : '验证码登录' }}
        </button>
      </form>
    </article>

    <article v-if="props.showResetPanel" class="grid gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-base font-semibold tracking-tight text-zinc-900">密码重置</h2>
        <button
          class="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-400 hover:text-zinc-900 active:translate-y-[1px]"
          type="button"
          @click="emit('toggleResetPanel')"
        >
          收起面板
        </button>
      </div>

      <form class="grid gap-3" @submit.prevent="emit('sendResetEmail')">
        <h3 class="text-sm font-semibold tracking-tight text-zinc-900">申请重置链接</h3>
        <label class="grid gap-2">
          <span class="text-sm font-medium text-zinc-700">邮箱地址</span>
          <input
            :value="props.resetEmail"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            required
            class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            @input="onResetEmailInput"
            @blur="emit('syncPrimaryEmail', props.resetEmail)"
          />
        </label>
        <button
          class="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-400 hover:text-zinc-900 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          :disabled="props.resetSending"
        >
          {{ props.resetSending ? '发送中...' : '发送重置邮件' }}
        </button>
      </form>

      <form class="grid gap-3" @submit.prevent="emit('resetPassword')">
        <h3 class="text-sm font-semibold tracking-tight text-zinc-900">完成密码重置</h3>
        <label class="grid gap-2">
          <span class="text-sm font-medium text-zinc-700">重置令牌</span>
          <input
            :value="props.resetToken"
            type="text"
            placeholder="粘贴邮件中的重置令牌"
            required
            class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            @input="onResetTokenInput"
          />
        </label>
        <label class="grid gap-2">
          <span class="text-sm font-medium text-zinc-700">新密码（至少 8 位）</span>
          <input
            :value="props.resetNewPassword"
            type="password"
            minlength="8"
            placeholder="请输入新密码"
            required
            class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            @input="onResetNewPasswordInput"
          />
        </label>
        <button
          class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          :disabled="props.resetSubmitting"
        >
          {{ props.resetSubmitting ? '提交中...' : '完成重置' }}
        </button>
      </form>
    </article>
  </div>
</template>
