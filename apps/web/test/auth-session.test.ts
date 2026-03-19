import type { AuthUserDto } from '@appstore-price-radar/contracts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import {
  SESSION_EXPIRES_AT_STORAGE_KEY,
  SESSION_USER_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
} from '../src/lib/auth-session'
import { fetchMock, jsonResponse, mountAppAt, settlePromises } from './setup'

const storedUser: AuthUserDto = {
  id: 'user-1',
  email: 'restore@example.com',
  createdAt: '2026-03-19T00:00:00.000Z',
  updatedAt: '2026-03-19T00:00:00.000Z',
}

function seedStoredSession(): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, 'session-token')
  localStorage.setItem(SESSION_USER_STORAGE_KEY, JSON.stringify(storedUser))
  localStorage.setItem(SESSION_EXPIRES_AT_STORAGE_KEY, '2026-04-19T00:00:00.000Z')
}

describe('auth session routes', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('redirects unauthenticated profile navigation to /auth', async () => {
    const { createAppRouter } = await import('../src/router')

    const router = createAppRouter(createMemoryHistory())
    await router.push('/profile')
    await router.isReady()

    expect(router.currentRoute.value.fullPath).toBe('/auth')
  })

  it('restores stored session on protected route and keeps the user in workbench', async () => {
    seedStoredSession()
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: storedUser }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }))

    const { router, wrapper } = await mountAppAt('/profile')

    await settlePromises()

    expect(router.currentRoute.value.fullPath).toBe('/profile')
    expect(wrapper.text()).toContain('监控工作台')
    expect(wrapper.text()).toContain(storedUser.email)

    const authRequest = fetchMock.mock.calls[0]
    const requestHeaders = new Headers(authRequest[1]?.headers)

    expect(authRequest[0]).toBe('/api/auth/me')
    expect(requestHeaders.get('authorization')).toBe('Bearer session-token')

    wrapper.unmount()
  })
})
