// @env browser

import type { AuthUserDto } from '@appstore-price-radar/contracts'

export const TOKEN_STORAGE_KEY = 'price-radar-token'
export const SESSION_USER_STORAGE_KEY = 'price-radar-auth-user'
export const SESSION_EXPIRES_AT_STORAGE_KEY = 'price-radar-auth-expires-at'
export const AUTH_TOKEN_CHANGED_EVENT = 'price-radar-auth-token-changed'

export interface StoredAuthSession {
  token: string
  user: AuthUserDto | null
  expiresAt: string
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

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
  if (!canUseLocalStorage()) {
    return ''
  }

  return localStorage.getItem(TOKEN_STORAGE_KEY) ?? ''
}

export function setStoredToken(token: string): void {
  if (!canUseLocalStorage()) {
    return
  }

  localStorage.setItem(TOKEN_STORAGE_KEY, token)
  dispatchAuthChanged(token)
}

export function clearStoredToken(): void {
  if (!canUseLocalStorage()) {
    return
  }

  localStorage.removeItem(TOKEN_STORAGE_KEY)
  dispatchAuthChanged('')
}

export function getStoredSessionUser(): AuthUserDto | null {
  if (!canUseLocalStorage()) {
    return null
  }

  const userText = localStorage.getItem(SESSION_USER_STORAGE_KEY)

  if (!userText) {
    return null
  }

  try {
    return JSON.parse(userText) as AuthUserDto
  }
  catch {
    return null
  }
}

export function setStoredSessionUser(user: AuthUserDto | null): void {
  if (!canUseLocalStorage()) {
    return
  }

  if (!user) {
    localStorage.removeItem(SESSION_USER_STORAGE_KEY)
    return
  }

  localStorage.setItem(SESSION_USER_STORAGE_KEY, JSON.stringify(user))
}

export function getStoredSessionExpiresAt(): string {
  if (!canUseLocalStorage()) {
    return ''
  }

  return localStorage.getItem(SESSION_EXPIRES_AT_STORAGE_KEY) ?? ''
}

export function setStoredSessionExpiresAt(expiresAt: string): void {
  if (!canUseLocalStorage()) {
    return
  }

  if (!expiresAt) {
    localStorage.removeItem(SESSION_EXPIRES_AT_STORAGE_KEY)
    return
  }

  localStorage.setItem(SESSION_EXPIRES_AT_STORAGE_KEY, expiresAt)
}

export function getStoredAuthSession(): StoredAuthSession {
  return {
    token: getStoredToken(),
    user: getStoredSessionUser(),
    expiresAt: getStoredSessionExpiresAt(),
  }
}

export function setStoredAuthSession(session: StoredAuthSession): void {
  setStoredSessionUser(session.user)
  setStoredSessionExpiresAt(session.expiresAt)
  setStoredToken(session.token)
}

export function clearStoredAuthSession(): void {
  setStoredSessionUser(null)
  setStoredSessionExpiresAt('')
  clearStoredToken()
}
