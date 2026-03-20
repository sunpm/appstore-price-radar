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
  <div class="mt-6 inline-flex rounded-full border border-slate-200 bg-white/78 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
    <button
      type="button"
      class="rounded-full px-4 py-2.5 text-sm font-semibold transition duration-300"
      :class="props.mode === 'login' ? 'bg-slate-950 text-white shadow-[0_16px_30px_-18px_rgba(15,23,42,0.58)]' : 'text-slate-500 hover:text-slate-950'"
      @click="emit('change', 'login')"
    >
      账号登录
    </button>
    <button
      type="button"
      class="rounded-full px-4 py-2.5 text-sm font-semibold transition duration-300"
      :class="props.mode === 'register' ? 'bg-slate-950 text-white shadow-[0_16px_30px_-18px_rgba(15,23,42,0.58)]' : 'text-slate-500 hover:text-slate-950'"
      @click="emit('change', 'register')"
    >
      创建账号
    </button>
  </div>
</template>
