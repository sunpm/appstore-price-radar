<script setup lang="ts">
import type { ToastType } from '../../lib/toast'
import { computed } from 'vue'
import { useToast } from '../../lib/toast'

const toast = useToast()

function toneClass(type: ToastType) {
  if (type === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  }

  if (type === 'error') {
    return 'border-rose-200 bg-rose-50 text-rose-800'
  }

  return 'border-sky-200 bg-sky-50 text-sky-800'
}

function markerClass(type: ToastType) {
  if (type === 'success') {
    return 'bg-emerald-500'
  }

  if (type === 'error') {
    return 'bg-rose-500'
  }

  return 'bg-sky-500'
}

function splitMessage(message: string) {
  const text = message.trim()

  if (!text) {
    return { title: '', detail: '' }
  }

  const zhStop = text.indexOf('。')

  if (zhStop > 0 && zhStop < 36) {
    return {
      title: text.slice(0, zhStop + 1),
      detail: text.slice(zhStop + 1).trim(),
    }
  }

  const zhComma = text.indexOf('，')

  if (zhComma > 0 && text.length > 26 && zhComma < 32) {
    return {
      title: text.slice(0, zhComma + 1),
      detail: text.slice(zhComma + 1).trim(),
    }
  }

  return { title: text, detail: '' }
}

const list = computed(() => {
  return toast.items.value.map((item) => {
    const parts = splitMessage(item.message)
    return {
      ...item,
      title: parts.title,
      detail: parts.detail,
    }
  })
})
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-3 z-[120] mx-auto flex w-full max-w-[1400px] justify-center px-3 md:top-4 md:px-8">
    <TransitionGroup name="toast" tag="ul" class="flex w-full max-w-[620px] flex-col gap-2.5">
      <li
        v-for="item in list"
        :key="item.id"
        class="pointer-events-auto rounded-xl border px-4 py-3 shadow-[0_16px_36px_-20px_rgba(7,13,20,0.55)] backdrop-blur md:px-4.5"
        :class="toneClass(item.type)"
      >
        <div class="grid grid-cols-[12px_1fr_auto] items-start gap-3">
          <span class="mt-[0.47rem] h-2.5 w-2.5 flex-none rounded-full" :class="markerClass(item.type)" />
          <div class="min-w-0">
            <p class="break-words text-sm font-semibold leading-6 md:text-[15px]">
              {{ item.title }}
            </p>
            <p v-if="item.detail" class="mt-0.5 break-words text-xs leading-5 opacity-85 md:text-[13px]">
              {{ item.detail }}
            </p>
          </div>
          <button
            type="button"
            class="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-current/25 bg-white/60 text-zinc-700 opacity-90 transition hover:bg-white/90 hover:opacity-100 active:scale-[0.96]"
            aria-label="关闭提示"
            @click="toast.remove(item.id)"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" class="h-[18px] w-[18px]" stroke="currentColor" stroke-width="2.2">
              <path d="M5.5 5.5l9 9m0-9l-9 9" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </li>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate3d(0, -10px, 0) scale(0.98);
}
</style>
