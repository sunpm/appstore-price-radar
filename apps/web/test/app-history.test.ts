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
      sellerName: 'Sunset Studio',
      primaryGenreName: 'Utilities',
      genres: ['Utilities', 'Productivity'],
      description: '## Major improvements\n- Track prices with confidence.\n- Compare before you buy.\n- This paragraph is intentionally long so the detail page shows a short summary instead of dumping the full App Store description directly into the page body.',
      averageUserRating: 4.7,
      averageUserRatingForCurrentVersion: 4.8,
      userRatingCount: 3210,
      userRatingCountForCurrentVersion: 980,
      bundleId: 'com.example.historyradar',
      version: '1.2.3',
      minimumOsVersion: '16.0',
      releaseNotes: '1. Bug fixes\n2. Better charts\n3. Faster refresh',
      fileSizeBytes: '169496576',
      contentAdvisoryRating: '4+',
      trackContentRating: '4+',
      releaseDate: '2025-01-10T10:00:00.000Z',
      currentVersionReleaseDate: '2026-03-18T10:00:00.000Z',
      sellerUrl: 'https://example.com',
      artistViewUrl: 'https://apps.apple.com/us/developer/example/id1',
      supportedDevices: [
        'iPhone16-iPhone16',
        'iPadAir11M3-iPadAir11M3',
        'Mac14,2-Mac14,2',
      ],
      languageCodesISO2A: ['EN', 'ZH'],
      advisories: [],
      features: ['iosUniversal', 'arm64'],
      screenshotUrls: [
        'https://example.com/shot-1.png',
        'https://example.com/shot-2.png',
      ],
      ipadScreenshotUrls: [],
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
    expect(firstMount.wrapper.text()).toContain('已加载 1 / 1 条')
    expect(firstMount.wrapper.text()).toContain('截图预览')
    expect(firstMount.wrapper.text()).toContain('更新记录')
    expect(firstMount.wrapper.text()).toContain('应用简介')
    expect(firstMount.wrapper.text()).toContain('iPhone')
    expect(firstMount.wrapper.text()).toContain('iPad')
    expect(firstMount.wrapper.text()).toContain('Mac')
    expect(firstMount.wrapper.text()).toContain('iOS / iPadOS / macOS 16.0+')
    expect(firstMount.wrapper.text()).toContain('Bug fixes')
    expect(firstMount.wrapper.text()).not.toContain('iPhone16-iPhone16')
    expect(firstMount.wrapper.text()).not.toContain('## Major improvements')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    firstMount.wrapper.unmount()

    const secondMount = await mountAppAt('/apps/123456789/us')

    expect(secondMount.wrapper.text()).toContain('History Radar')
    expect(secondMount.wrapper.text()).toContain('已加载 1 / 1 条')
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

    const loadMoreButton = () => wrapper.findAll('button').find(button => button.text() === '加载更多记录')

    expect(wrapper.text()).toContain('已加载 1 / 3 条')
    expect(loadMoreButton()).toBeTruthy()

    await loadMoreButton()!.trigger('click')
    await settlePromises()

    expect(wrapper.text()).toContain('已加载 2 / 3 条')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await loadMoreButton()!.trigger('click')
    await settlePromises()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(wrapper.text()).toContain('历史分页失败。')

    wrapper.unmount()
  })
})
