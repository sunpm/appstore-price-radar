import { getStoredToken } from './auth-session'
import { buildApiUrl, parseApiErrorText } from './http'

export interface ApiRequestOptions {
  auth?: boolean
  onUnauthorized?: () => Promise<void> | void
  signal?: AbortSignal
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(init.headers ?? {})

  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  if (options.auth) {
    const token = getStoredToken()

    if (!token) {
      await options.onUnauthorized?.()
      throw new Error('Unauthorized')
    }

    headers.set('authorization', `Bearer ${token}`)
  }

  const res = await fetch(buildApiUrl(path), {
    ...init,
    headers,
    signal: options.signal,
  })

  if (!res.ok) {
    if (options.auth && res.status === 401) {
      await options.onUnauthorized?.()
    }

    throw new Error(await parseApiErrorText(res))
  }

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}
