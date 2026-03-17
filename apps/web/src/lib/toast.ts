import { readonly, ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
  duration: number
}

interface ToastInput {
  type?: ToastType
  message: string
  duration?: number
}

const itemsRef = ref<ToastItem[]>([])
let idSeed = 0
const maxVisible = 3

const defaultDurations: Record<ToastType, number> = {
  success: 2800,
  error: 4200,
  info: 3200,
}

function clampDuration(value: number) {
  return Math.min(6500, Math.max(2200, value))
}

function estimateReadDuration(message: string, type: ToastType) {
  const textLength = message.trim().length
  const base = defaultDurations[type]
  const extra = Math.ceil(textLength / 12) * 280
  return clampDuration(base + extra)
}

function remove(id: number) {
  itemsRef.value = itemsRef.value.filter(item => item.id !== id)
}

function push(input: ToastInput) {
  const type = input.type ?? 'info'
  const duration = input.duration ?? estimateReadDuration(input.message, type)
  const id = ++idSeed

  itemsRef.value = [
    ...itemsRef.value,
    {
      id,
      type,
      message: input.message,
      duration,
    },
  ].slice(-maxVisible)

  if (duration > 0) {
    setTimeout(remove, duration, id)
  }

  return id
}

export function useToast() {
  return {
    items: readonly(itemsRef),
    push,
    remove,
    success: (message: string, duration?: number) => push({ type: 'success', message, duration }),
    error: (message: string, duration?: number) => push({ type: 'error', message, duration }),
    info: (message: string, duration?: number) => push({ type: 'info', message, duration }),
  }
}
