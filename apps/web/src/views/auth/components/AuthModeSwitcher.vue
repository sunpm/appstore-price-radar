<script setup lang="ts">
import type { AuthMode } from '../types'

const props = defineProps<{
  mode: AuthMode
}>()

const emit = defineEmits<{
  change: [mode: AuthMode]
}>()
</script>

<template>
  <div class="mt-4 inline-flex flex-wrap gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1">
    <button
      type="button"
      class="rounded-full px-4 py-2 text-sm font-medium transition"
      :class="props.mode === 'login' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900'"
      @click="emit('change', 'login')"
    >
      账号登录
    </button>
    <button
      type="button"
      class="rounded-full px-4 py-2 text-sm font-medium transition"
      :class="props.mode === 'register' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900'"
      @click="emit('change', 'register')"
    >
      创建账号
    </button>
  </div>
</template>
