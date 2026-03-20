<script setup lang="ts">
import type { AuthUser } from '../types'

const props = defineProps<{
  currentUser: AuthUser
  sessionExpiresAt: string
  toTime: (value: string) => string
}>()

const emit = defineEmits<{
  logout: []
}>()
</script>

<template>
  <div class="mt-6 grid gap-4">
    <article class="radar-panel-dark p-5">
      <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-300">
        ACTIVE SESSION
      </p>
      <h2 class="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-white">
        当前会话已恢复
      </h2>
      <p class="mt-3 text-sm leading-6 text-slate-300">
        登录账号：{{ props.currentUser.email }}
      </p>
      <p v-if="props.sessionExpiresAt" class="mt-2 text-sm text-slate-300">
        会话有效期至：{{ props.toTime(props.sessionExpiresAt) }}
      </p>
    </article>

    <div class="grid gap-3 md:grid-cols-2">
      <RouterLink
        to="/profile"
        class="radar-button-primary w-full"
      >
        进入我的订阅
      </RouterLink>
      <button
        type="button"
        class="radar-button-secondary w-full"
        @click="emit('logout')"
      >
        退出当前账号
      </button>
    </div>
  </div>
</template>
