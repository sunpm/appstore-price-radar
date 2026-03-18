import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { UNAUTHORIZED_MESSAGE } from '../../../composables/useAuthedApi'

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
}

interface AuthFeedbackState {
  successText: Ref<string>
  errorText: Ref<string>
  resetMessages: () => void
  resolveErrorMessage: (error: unknown, fallback: string) => string
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

  const resolveErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Please login first') {
        return UNAUTHORIZED_MESSAGE
      }

      return error.message
    }

    return fallback
  }

  return {
    successText,
    errorText,
    resetMessages,
    resolveErrorMessage,
  }
}
