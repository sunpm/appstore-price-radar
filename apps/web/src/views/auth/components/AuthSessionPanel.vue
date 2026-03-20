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
  <div class="mt-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4">
    <p class="text-sm text-zinc-700">
      当前账号：<strong>{{ props.currentUser.email }}</strong>
    </p>
    <p v-if="props.sessionExpiresAt" class="mt-1 text-xs text-zinc-500">
      会话有效期至：{{ props.toTime(props.sessionExpiresAt) }}
    </p>

    <div class="mt-4 flex flex-wrap items-center gap-2">
      <RouterLink
        to="/profile"
        class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px]"
      >
        进入我的订阅
      </RouterLink>
      <button
        class="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-400 hover:text-zinc-900 active:translate-y-[1px]"
        type="button"
        @click="emit('logout')"
      >
        退出当前账号
      </button>
    </div>
  </div>
</template>
