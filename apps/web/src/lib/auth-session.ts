// @env browser

export const TOKEN_STORAGE_KEY = 'price-radar-token'
export const AUTH_TOKEN_CHANGED_EVENT = 'price-radar-auth-token-changed'

function dispatchAuthChanged(token: string): void {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent(AUTH_TOKEN_CHANGED_EVENT, {
      detail: { token },
    }),
  )
}

export function getStoredToken(): string {
  if (typeof localStorage === 'undefined') {
    return ''
  }

  return localStorage.getItem(TOKEN_STORAGE_KEY) ?? ''
}

export function setStoredToken(token: string): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(TOKEN_STORAGE_KEY, token)
  dispatchAuthChanged(token)
}

export function clearStoredToken(): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.removeItem(TOKEN_STORAGE_KEY)
  dispatchAuthChanged('')
}
