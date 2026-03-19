import type { AuthUserDto } from '@appstore-price-radar/contracts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SESSION_EXPIRES_AT_STORAGE_KEY,
  SESSION_USER_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
} from '../src/lib/auth-session'
import { fetchMock, jsonResponse, mountAppAt, settlePromises } from './setup'

const currentUser: AuthUserDto = {
  id: 'user-2',
  email: 'profile@example.com',
  createdAt: '2026-03-19T00:00:00.000Z',
  updatedAt: '2026-03-19T00:00:00.000Z',
}

function seedStoredSession(): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, 'profile-token')
  localStorage.setItem(SESSION_USER_STORAGE_KEY, JSON.stringify(currentUser))
  localStorage.setItem(SESSION_EXPIRES_AT_STORAGE_KEY, '2026-04-19T00:00:00.000Z')
}

describe('profile view subscriptions', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('creates a subscription from ProfileView and shows success feedback', async () => {
    seedStoredSession()

    fetchMock.mockResolvedValueOnce(jsonResponse({ user: currentUser }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }))
    fetchMock.mockResolvedValueOnce(jsonResponse({
      subscription: {
        id: 'sub-1',
        appId: '123456789',
        appName: 'Radar Pro',
        country: 'US',
        currentPrice: 1.99,
        targetPrice: 0.99,
        currency: 'USD',
        iconUrl: null,
        createdAt: '2026-03-19T00:00:00.000Z',
        updatedAt: '2026-03-19T00:10:00.000Z',
      },
    }))
    fetchMock.mockResolvedValueOnce(jsonResponse({
      items: [{
        id: 'sub-1',
        appId: '123456789',
        appName: 'Radar Pro',
        country: 'US',
        currentPrice: 1.99,
        targetPrice: 0.99,
        currency: 'USD',
        iconUrl: null,
        createdAt: '2026-03-19T00:00:00.000Z',
        updatedAt: '2026-03-19T00:10:00.000Z',
      }],
    }))

    const { wrapper } = await mountAppAt('/profile')

    await wrapper.get('input[placeholder*="123456789"]').setValue('123456789')
    await wrapper.get('input[placeholder="示例：0.99"]').setValue('0.99')

    const submitButton = wrapper
      .findAll('button')
      .find(button => button.text() === '创建并开始监控')

    expect(submitButton).toBeTruthy()

    await submitButton!.trigger('click')
    await settlePromises()

    expect(wrapper.text()).toContain('监控任务已创建：123456789')
    expect(wrapper.text()).toContain('Radar Pro')
    expect(wrapper.text()).toContain('App ID: 123456789')

    const createRequest = fetchMock.mock.calls[2]
    const createHeaders = new Headers(createRequest[1]?.headers)

    expect(createRequest[0]).toBe('/api/subscriptions')
    expect(createHeaders.get('authorization')).toBe('Bearer profile-token')
    expect(createRequest[1]?.method).toBe('POST')

    wrapper.unmount()
  })

  it('shows error feedback when subscription creation fails', async () => {
    seedStoredSession()

    fetchMock.mockResolvedValueOnce(jsonResponse({ user: currentUser }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: '该监控任务已存在。' }, { status: 409 }))

    const { wrapper } = await mountAppAt('/profile')

    await wrapper.get('input[placeholder*="123456789"]').setValue('123456789')

    const submitButton = wrapper
      .findAll('button')
      .find(button => button.text() === '创建并开始监控')

    expect(submitButton).toBeTruthy()

    await submitButton!.trigger('click')
    await settlePromises()

    expect(wrapper.text()).toContain('该监控任务已存在。')

    wrapper.unmount()
  })

  it('redirects to /auth when protected subscriptions request becomes unauthorized', async () => {
    seedStoredSession()

    fetchMock.mockResolvedValueOnce(jsonResponse({ user: currentUser }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Please login first' }, { status: 401 }))

    const { router, wrapper } = await mountAppAt('/profile')

    await settlePromises()

    expect(router.currentRoute.value.fullPath).toBe('/auth')
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()

    wrapper.unmount()
  })
})
