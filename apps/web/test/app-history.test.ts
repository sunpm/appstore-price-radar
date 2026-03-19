import type { AppDetailResponseDto } from '@appstore-price-radar/contracts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchMock, jsonResponse, mountAppAt, settlePromises } from './setup'

function buildPayload(
  overrides: Partial<AppDetailResponseDto> = {},
): AppDetailResponseDto {
  return {
    snapshot: {
      appId: '123456789',
      country: 'US',
      appName: 'History Radar',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      iconUrl: null,
      currency: 'USD',
      lastPrice: 1.99,
      updatedAt: '2026-03-19T10:00:00.000Z',
    },
    history: [{
      id: 2,
      changedAt: '2026-03-18T10:00:00.000Z',
      oldAmount: 3.99,
      newAmount: 1.99,
      currency: 'USD',
      source: 'scheduled',
    }],
    page: {
      window: '90d',
      pageSize: 60,
      nextCursor: null,
      hasMore: false,
    },
    summary: {
      totalChanges: 1,
      latestChangeAt: '2026-03-18T10:00:00.000Z',
      earliestChangeAt: '2026-03-18T10:00:00.000Z',
    },
    metadata: {
      primaryGenreName: 'Utilities',
      averageUserRating: 4.7,
      userRatingCount: 3210,
    },
    ...overrides,
  }
}

describe('app detail view price history', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('loads initial history and reuses cached payload on remount', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(buildPayload()))

    const firstMount = await mountAppAt('/apps/123456789/us')

    expect(firstMount.wrapper.text()).toContain('历史趋势与变化明细')
    expect(firstMount.wrapper.text()).toContain('已加载 1 / 1 条变化事件。')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    firstMount.wrapper.unmount()

    const secondMount = await mountAppAt('/apps/123456789/us')

    expect(secondMount.wrapper.text()).toContain('History Radar')
    expect(secondMount.wrapper.text()).toContain('已加载 1 / 1 条变化事件。')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    secondMount.wrapper.unmount()
  })

  it('appends older history on loadMore and surfaces loadMore errors', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(buildPayload({
      page: {
        window: '90d',
        pageSize: 60,
        nextCursor: 'cursor-1',
        hasMore: true,
      },
      summary: {
        totalChanges: 3,
        latestChangeAt: '2026-03-18T10:00:00.000Z',
        earliestChangeAt: '2026-03-10T10:00:00.000Z',
      },
    })))
    fetchMock.mockResolvedValueOnce(jsonResponse(buildPayload({
      history: [{
        id: 1,
        changedAt: '2026-03-10T10:00:00.000Z',
        oldAmount: 5.99,
        newAmount: 3.99,
        currency: 'USD',
        source: 'manual',
      }],
      page: {
        window: '90d',
        pageSize: 60,
        nextCursor: 'cursor-2',
        hasMore: true,
      },
      summary: {
        totalChanges: 3,
        latestChangeAt: '2026-03-18T10:00:00.000Z',
        earliestChangeAt: '2026-03-10T10:00:00.000Z',
      },
    })))
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: '历史分页失败。' }, { status: 500 }))

    const { wrapper } = await mountAppAt('/apps/123456789/us')

    const loadMoreButton = () => wrapper.findAll('button').find(button => button.text() === '加载更多')

    expect(wrapper.text()).toContain('已加载 1 / 3 条变化事件。')
    expect(loadMoreButton()).toBeTruthy()

    await loadMoreButton()!.trigger('click')
    await settlePromises()

    expect(wrapper.text()).toContain('已加载 2 / 3 条变化事件。')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await loadMoreButton()!.trigger('click')
    await settlePromises()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(wrapper.text()).toContain('历史分页失败。')

    wrapper.unmount()
  })
})
