<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    submitting: boolean
    minPasswordLength?: number
  }>(),
  {
    minPasswordLength: 8,
  },
)

const emit = defineEmits<{
  submit: []
}>()

const currentPassword = defineModel<string>('currentPassword', { required: true })
const newPassword = defineModel<string>('newPassword', { required: true })
const confirmPassword = defineModel<string>('confirmPassword', { required: true })
</script>

<template>
  <section class="reveal reveal-delay-2 mt-4 rounded-[2rem] border border-zinc-200/70 bg-white/92 p-6 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)]">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="metric-mono text-xs tracking-[0.2em] text-zinc-500">
          SECURITY
        </p>
        <h2 class="mt-1 text-xl font-semibold tracking-tight text-zinc-900">
          修改登录密码
        </h2>
        <p class="mt-2 text-sm text-zinc-600">
          修改后其他设备会话将失效，当前设备保持登录。
        </p>
      </div>
    </div>

    <form class="mt-4 grid gap-3 md:grid-cols-3" @submit.prevent="emit('submit')">
      <label class="grid gap-2">
        <span class="text-sm font-medium text-zinc-700">当前密码</span>
        <input
          v-model="currentPassword"
          type="password"
          autocomplete="current-password"
          placeholder="请输入当前密码"
          required
          :minlength="props.minPasswordLength"
          class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        >
      </label>

      <label class="grid gap-2">
        <span class="text-sm font-medium text-zinc-700">新密码</span>
        <input
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          placeholder="请输入新密码"
          required
          :minlength="props.minPasswordLength"
          class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        >
      </label>

      <label class="grid gap-2">
        <span class="text-sm font-medium text-zinc-700">确认新密码</span>
        <input
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          placeholder="请再次输入新密码"
          required
          :minlength="props.minPasswordLength"
          class="w-full rounded-xl border border-zinc-300/80 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        >
      </label>

      <div class="md:col-span-3 flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-zinc-500">
          忘记当前密码可前往
          <RouterLink
            :to="{ path: '/auth', query: { reset: '1' } }"
            class="font-medium text-zinc-700 underline decoration-zinc-400 underline-offset-2 hover:text-zinc-900"
          >
            重置密码
          </RouterLink>
          。
        </p>
        <button
          class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          :disabled="props.submitting"
        >
          {{ props.submitting ? '更新中...' : '更新密码' }}
        </button>
      </div>
    </form>
  </section>
</template>
