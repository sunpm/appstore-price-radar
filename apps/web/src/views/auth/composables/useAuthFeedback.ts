import type { Ref } from 'vue'
import { ref, watch } from 'vue'

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
}

interface AuthFeedbackState {
  successText: Ref<string>
  errorText: Ref<string>
  resetMessages: () => void
}

export function useAuthFeedback(toast: ToastApi): AuthFeedbackState {
  const successText = ref('')
  const errorText = ref('')

  watch(successText, (next) => {
    if (!next) {
      return
    }

    toast.success(next)
  })

  watch(errorText, (next) => {
    if (!next) {
      return
    }

    toast.error(next)
  })

  const resetMessages = (): void => {
    successText.value = ''
    errorText.value = ''
  }

  return {
    successText,
    errorText,
    resetMessages,
  }
}
