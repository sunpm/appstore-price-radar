import type { AuthResponseDto, AuthUserDto } from '@appstore-price-radar/contracts'
import { computed, readonly, ref } from 'vue'
import { apiRequest } from '../lib/api-client'
import {
  AUTH_TOKEN_CHANGED_EVENT,
  clearStoredAuthSession,
  getStoredAuthSession,
  SESSION_EXPIRES_AT_STORAGE_KEY,
  SESSION_USER_STORAGE_KEY,
  setStoredAuthSession,
  setStoredSessionUser,
  TOKEN_STORAGE_KEY,
} from '../lib/auth-session'

const tokenState = ref('')
const currentUserState = ref<AuthUserDto | null>(null)
const sessionExpiresAtState = ref('')
const isAuthenticated = computed(() => Boolean(tokenState.value))

let syncInitialized = false
let restorePromise: Promise<void> | null = null

function syncSessionFromStorage(): void {
  const storedSession = getStoredAuthSession()
  tokenState.value = storedSession.token
  currentUserState.value = storedSession.user
  sessionExpiresAtState.value = storedSession.expiresAt
}

function handleAuthTokenChanged(): void {
  syncSessionFromStorage()
}

function handleStorage(event: StorageEvent): void {
  if (
    event.key !== TOKEN_STORAGE_KEY
    && event.key !== SESSION_USER_STORAGE_KEY
    && event.key !== SESSION_EXPIRES_AT_STORAGE_KEY
  ) {
    return
  }

  syncSessionFromStorage()
}

function ensureSessionSync(): void {
  if (typeof window === 'undefined' || syncInitialized) {
    return
  }

  syncInitialized = true
  syncSessionFromStorage()
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handleAuthTokenChanged)
  window.addEventListener('storage', handleStorage)
}

function applySession(next: AuthResponseDto): void {
  tokenState.value = next.token
  currentUserState.value = next.user
  sessionExpiresAtState.value = next.expiresAt
  setStoredAuthSession({
    token: next.token,
    user: next.user,
    expiresAt: next.expiresAt,
  })
}

function clearSession(): void {
  tokenState.value = ''
  currentUserState.value = null
  sessionExpiresAtState.value = ''
  clearStoredAuthSession()
}

async function restoreSession(): Promise<void> {
  ensureSessionSync()

  if (!tokenState.value) {
    currentUserState.value = null
    sessionExpiresAtState.value = ''
    return
  }

  if (restorePromise) {
    await restorePromise
    return
  }

  restorePromise = (async () => {
    try {
      const data = await apiRequest<{ user: AuthUserDto }>(
        '/api/auth/me',
        {},
        {
          auth: true,
          onUnauthorized: clearSession,
        },
      )
      currentUserState.value = data.user
      setStoredSessionUser(data.user)
    }
    catch {
      clearSession()
    }
    finally {
      restorePromise = null
    }
  })()

  await restorePromise
}

export function useAuthSession() {
  ensureSessionSync()

  return {
    token: readonly(tokenState),
    currentUser: readonly(currentUserState),
    sessionExpiresAt: readonly(sessionExpiresAtState),
    restoreSession,
    applySession,
    clearSession,
    isAuthenticated,
  }
}
