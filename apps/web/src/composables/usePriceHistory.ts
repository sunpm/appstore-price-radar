import type {
  AppDecisionMetadataDto,
  AppDetailResponseDto,
  AppSnapshotDto,
  PriceChangeEventDto,
  PriceHistoryPageDto,
  PriceHistorySummaryDto,
  PriceHistoryWindow,
} from '@appstore-price-radar/contracts'
import { ref } from 'vue'
import { apiRequest } from '../lib/api-client'
import { useAuthedApi } from './useAuthedApi'

interface UsePriceHistoryOptions {
  auth?: boolean
  pageSize?: number
}

interface CachedHistoryState {
  history: PriceChangeEventDto[]
  snapshot: AppSnapshotDto | null
  page: PriceHistoryPageDto
  summary: PriceHistorySummaryDto
  metadata: AppDecisionMetadataDto | null
}

const DEFAULT_WINDOW: PriceHistoryWindow = '90d'
const DEFAULT_PAGE_SIZE = 60
const historyCache = new Map<string, CachedHistoryState>()

function buildEmptyPage(pageSize: number, window: PriceHistoryWindow): PriceHistoryPageDto {
  return {
    window,
    pageSize,
    nextCursor: null,
    hasMore: false,
  }
}

function buildEmptySummary(): PriceHistorySummaryDto {
  return {
    totalChanges: 0,
    latestChangeAt: null,
    earliestChangeAt: null,
  }
}

function cloneCachedState(state: CachedHistoryState): CachedHistoryState {
  return {
    history: state.history.slice(),
    snapshot: state.snapshot,
    page: { ...state.page },
    summary: { ...state.summary },
    metadata: state.metadata ? { ...state.metadata } : null,
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'
}

export function usePriceHistory(options: UsePriceHistoryOptions = {}) {
  const { request: authedRequest } = useAuthedApi()
  const auth = options.auth ?? false
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE

  const history = ref<PriceChangeEventDto[]>([])
  const snapshot = ref<AppSnapshotDto | null>(null)
  const page = ref<PriceHistoryPageDto>(buildEmptyPage(pageSize, DEFAULT_WINDOW))
  const summary = ref<PriceHistorySummaryDto>(buildEmptySummary())
  const metadata = ref<AppDecisionMetadataDto | null>(null)
  const loading = ref(false)
  const loadingMore = ref(false)
  const selectedWindow = ref<PriceHistoryWindow>(DEFAULT_WINDOW)

  let activeRequest: AbortController | null = null
  let currentAppId = ''
  let currentCountry = ''

  function buildCacheKey(appId: string, country: string, window: PriceHistoryWindow): string {
    return `${appId}:${country}:${window}`
  }

  function applyPayload(payload: CachedHistoryState): void {
    history.value = payload.history.slice()
    snapshot.value = payload.snapshot
    page.value = { ...payload.page }
    summary.value = { ...payload.summary }
    metadata.value = payload.metadata ? { ...payload.metadata } : null
  }

  function writeCache(
    key: string,
    payload: AppDetailResponseDto | CachedHistoryState,
  ): void {
    historyCache.set(key, cloneCachedState(payload))
  }

  function resetState(window: PriceHistoryWindow = selectedWindow.value): void {
    history.value = []
    snapshot.value = null
    page.value = buildEmptyPage(pageSize, window)
    summary.value = buildEmptySummary()
    metadata.value = null
  }

  function abortActiveRequest(): void {
    activeRequest?.abort()
    activeRequest = null
  }

  async function requestHistory(
    path: string,
    signal: AbortSignal,
  ): Promise<AppDetailResponseDto> {
    if (auth) {
      return authedRequest<AppDetailResponseDto>(path, {}, { signal })
    }

    return apiRequest<AppDetailResponseDto>(path, {}, { signal })
  }

  async function loadInitial(
    appId: string,
    country: string,
    window: PriceHistoryWindow = selectedWindow.value,
  ): Promise<void> {
    currentAppId = appId
    currentCountry = country
    selectedWindow.value = window
    abortActiveRequest()

    const cacheKey = buildCacheKey(appId, country, window)
    const cached = historyCache.get(cacheKey)

    if (cached) {
      applyPayload(cached)
      loading.value = false
      loadingMore.value = false
      return
    }

    resetState(window)

    const controller = new AbortController()
    activeRequest = controller
    loading.value = true
    loadingMore.value = false

    try {
      const payload = await requestHistory(
        `/api/prices/${encodeURIComponent(appId)}?country=${country}&window=${window}&pageSize=${pageSize}`,
        controller.signal,
      )

      if (activeRequest !== controller) {
        return
      }

      applyPayload(payload)
      writeCache(cacheKey, payload)
    }
    catch (error) {
      if (!isAbortError(error)) {
        throw error
      }
    }
    finally {
      if (activeRequest === controller) {
        activeRequest = null
        loading.value = false
      }
    }
  }

  async function loadMore(): Promise<void> {
    if (!currentAppId || !currentCountry || !page.value.hasMore || !page.value.nextCursor) {
      return
    }

    abortActiveRequest()

    const controller = new AbortController()
    activeRequest = controller
    loadingMore.value = true

    try {
      const payload = await requestHistory(
        `/api/prices/${encodeURIComponent(currentAppId)}?country=${currentCountry}&window=${selectedWindow.value}&pageSize=${pageSize}&cursor=${encodeURIComponent(page.value.nextCursor)}`,
        controller.signal,
      )

      if (activeRequest !== controller) {
        return
      }

      const nextState: CachedHistoryState = {
        history: payload.history.concat(history.value),
        snapshot: payload.snapshot,
        page: payload.page,
        summary: payload.summary,
        metadata: payload.metadata,
      }

      applyPayload(nextState)
      writeCache(buildCacheKey(currentAppId, currentCountry, selectedWindow.value), nextState)
    }
    catch (error) {
      if (!isAbortError(error)) {
        throw error
      }
    }
    finally {
      if (activeRequest === controller) {
        activeRequest = null
        loadingMore.value = false
      }
    }
  }

  return {
    history,
    snapshot,
    page,
    summary,
    metadata,
    loading,
    loadingMore,
    selectedWindow,
    loadInitial,
    loadMore,
    abortActiveRequest,
  }
}
