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
  <section class="reveal reveal-delay-2 mt-4 radar-panel p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-400">
          PASSWORD POLICY
        </p>
        <h2 class="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-slate-950">
          修改登录密码
        </h2>
        <p class="mt-2 text-sm leading-6 text-slate-500">
          修改后其他设备会话将失效，当前设备保持登录。
        </p>
      </div>
    </div>

    <form class="mt-4 grid gap-3 md:grid-cols-3" @submit.prevent="emit('submit')">
      <label class="grid gap-2">
        <span class="text-sm font-semibold text-slate-700">当前密码</span>
        <input
          v-model="currentPassword"
          type="password"
          autocomplete="current-password"
          placeholder="请输入当前密码"
          required
          :minlength="props.minPasswordLength"
          class="radar-input"
        >
      </label>

      <label class="grid gap-2">
        <span class="text-sm font-semibold text-slate-700">新密码</span>
        <input
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          placeholder="请输入新密码"
          required
          :minlength="props.minPasswordLength"
          class="radar-input"
        >
      </label>

      <label class="grid gap-2">
        <span class="text-sm font-semibold text-slate-700">确认新密码</span>
        <input
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          placeholder="请再次输入新密码"
          required
          :minlength="props.minPasswordLength"
          class="radar-input"
        >
      </label>

      <div class="flex flex-wrap items-center justify-between gap-3 md:col-span-3">
        <p class="text-sm text-slate-500">
          忘记当前密码可前往
          <RouterLink
            :to="{ path: '/auth', query: { reset: '1' } }"
            class="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
          >
            重置密码
          </RouterLink>
          。
        </p>
        <button
          class="radar-button-primary"
          type="submit"
          :disabled="props.submitting"
        >
          {{ props.submitting ? '更新中...' : '更新密码' }}
        </button>
      </div>
    </form>
  </section>
</template>
