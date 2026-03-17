import type { ComputedRef, Ref } from 'vue'
import { computed, onBeforeUnmount, ref } from 'vue'

interface CooldownTimerState {
  seconds: Ref<number>
  canTrigger: ComputedRef<boolean>
  start: (nextSeconds: number) => void
  stop: () => void
}

export function useCooldownTimer(initialSeconds = 0): CooldownTimerState {
  const seconds = ref(Math.max(0, Math.floor(initialSeconds)))
  const canTrigger = computed(() => seconds.value <= 0)

  let timer: ReturnType<typeof setInterval> | null = null

  const stop = (): void => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  const start = (nextSeconds: number): void => {
    stop()

    seconds.value = Math.max(0, Math.floor(nextSeconds))

    if (seconds.value <= 0) {
      return
    }

    timer = setInterval(() => {
      seconds.value = Math.max(0, seconds.value - 1)

      if (seconds.value <= 0) {
        stop()
      }
    }, 1000)
  }

  onBeforeUnmount(() => {
    stop()
  })

  return {
    seconds,
    canTrigger,
    start,
    stop,
  }
}
