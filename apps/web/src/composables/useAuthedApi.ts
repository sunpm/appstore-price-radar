import type { ApiRequestOptions } from '../lib/api-client'
import { useRouter } from 'vue-router'
import { apiRequest } from '../lib/api-client'
import { useAuthSession } from './useAuthSession'

type AuthedRequestOptions = Pick<ApiRequestOptions, 'signal'>

export const UNAUTHORIZED_MESSAGE = '登录状态已失效，请重新登录。'

export function useAuthedApi() {
  const router = useRouter()
  const { clearSession } = useAuthSession()

  async function onUnauthorized(): Promise<void> {
    clearSession()

    if (router.currentRoute.value.path !== '/auth') {
      await router.replace('/auth')
    }
  }

  async function request<T>(
    path: string,
    init: RequestInit = {},
    options: AuthedRequestOptions = {},
  ): Promise<T> {
    return apiRequest<T>(path, init, {
      auth: true,
      onUnauthorized,
      signal: options.signal,
    })
  }

  function toAuthedErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Please login first') {
        return UNAUTHORIZED_MESSAGE
      }

      return error.message
    }

    return fallback
  }

  return {
    request,
    onUnauthorized,
    toAuthedErrorMessage,
    unauthorizedMessage: UNAUTHORIZED_MESSAGE,
  }
}
