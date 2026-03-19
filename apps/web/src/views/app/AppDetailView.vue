<script setup lang="ts">
import type { PriceHistoryWindow } from '@appstore-price-radar/contracts'
import type { AppDetailPayload } from './types'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePriceHistory } from '../../composables/usePriceHistory'
import { resolveCountryLabel } from '../../constants/countries'
import { useToast } from '../../lib/toast'
import AppDetailHeroCard from './components/AppDetailHeroCard.vue'
import AppDetailMetadataPanel from './components/AppDetailMetadataPanel.vue'
import AppDetailTrendPanel from './components/AppDetailTrendPanel.vue'

const COUNTRY_CODE_RE = /^[A-Z]{2}$/
const DEFAULT_DETAIL_WINDOW: PriceHistoryWindow = 'all'
const MAC_DEVICE_RE = /(?:^|[^a-z])mac(?:book|mini|pro|studio)?|imac|macos/
const IOS_DEVICE_RE = /iphone|ipad|ipod|iosuniversal/

const route = useRoute()
const toast = useToast()
const errorText = ref('')
const hasLoaded = ref(false)

const {
  history,
  metadata,
  snapshot,
  page,
  summary,
  loading,
  loadingMore,
  loadInitial,
  loadMore,
} = usePriceHistory()

const appId = computed<string>(() => {
  const raw = route.params.appId
  return typeof raw === 'string' ? raw.trim() : ''
})

const country = computed<string>(() => {
  const raw = route.params.country
  const value = typeof raw === 'string' ? raw.trim().toUpperCase() : 'US'
  return COUNTRY_CODE_RE.test(value) ? value : 'US'
})

const countryLabel = computed(() => {
  return resolveCountryLabel(country.value)
})

const detail = computed<AppDetailPayload | null>(() => {
  if (!hasLoaded.value) {
    return null
  }

  return {
    snapshot: snapshot.value,
    history: history.value,
    page: page.value,
    summary: summary.value,
    metadata: metadata.value,
  }
})

watch(errorText, (next): void => {
  if (!next) {
    return
  }

  toast.error(next)
})

async function loadDetail(window: PriceHistoryWindow = DEFAULT_DETAIL_WINDOW): Promise<void> {
  if (!appId.value) {
    errorText.value = '应用 ID 无效。'
    hasLoaded.value = true
    return
  }

  errorText.value = ''
  hasLoaded.value = false

  try {
    await loadInitial(appId.value, country.value, window)
  }
  catch (error) {
    errorText.value = error instanceof Error ? error.message : '详情加载失败，请稍后重试。'
  }
  finally {
    hasLoaded.value = true
  }
}

async function loadMoreHistory(): Promise<void> {
  try {
    await loadMore()
  }
  catch (error) {
    errorText.value = error instanceof Error ? error.message : '更多历史数据加载失败，请稍后重试。'
  }
}

const appTitle = computed(() => {
  return detail.value?.snapshot?.appName ?? `App ${appId.value}`
})

const storePlatformLabel = computed(() => {
  const normalizedValues = [
    ...(detail.value?.metadata?.supportedDevices ?? []),
    ...(detail.value?.metadata?.features ?? []),
  ].map(item => item.toLowerCase())

  const hasMac = normalizedValues.some(item => MAC_DEVICE_RE.test(item))
  const hasIOS = normalizedValues.some(item => IOS_DEVICE_RE.test(item))

  if (hasIOS && hasMac) {
    return 'iOS / macOS'
  }

  if (hasMac) {
    return 'macOS'
  }

  if (hasIOS) {
    return 'iOS'
  }

  return 'iOS'
})

const canLoadMore = computed(() => Boolean(detail.value?.page.hasMore))

watch(
  () => [appId.value, country.value],
  async () => {
    await loadDetail(DEFAULT_DETAIL_WINDOW)
  },
  { immediate: true },
)
</script>

<template>
  <main class="min-h-[100dvh] bg-zinc-100 text-zinc-900">
    <div class="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_8%,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_90%_5%,rgba(20,83,45,0.1),transparent_34%),linear-gradient(158deg,#f3f7f6_0%,#edf3f3_48%,#f8f8f9_100%)]" />

    <div class="mx-auto max-w-[1200px] px-4 py-6 md:px-8 md:py-10">
      <section v-if="loading" class="grid gap-4">
        <div class="skeleton-box h-48 rounded-[2rem]" />
        <div class="skeleton-box h-[34rem] rounded-[2rem]" />
        <div class="skeleton-box h-72 rounded-[2rem]" />
        <div class="skeleton-box h-[40rem] rounded-[2rem]" />
      </section>

      <p
        v-else-if="errorText"
        class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
      >
        {{ errorText }}
      </p>

      <template v-else-if="detail">
        <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.08fr)_23rem] xl:gap-5">
          <div class="space-y-4">
            <AppDetailHeroCard
              :app-id="appId"
              :country-label="countryLabel"
              :app-name="appTitle"
              :icon-url="detail.snapshot?.iconUrl ?? null"
              :store-platform-label="storePlatformLabel"
              :seller-name="detail.metadata?.sellerName ?? null"
              :primary-genre-name="detail.metadata?.primaryGenreName ?? null"
              :version="detail.metadata?.version ?? null"
              :content-advisory-rating="detail.metadata?.contentAdvisoryRating ?? detail.metadata?.trackContentRating ?? null"
              :updated-at="detail.snapshot?.updatedAt ?? null"
            />

            <AppDetailMetadataPanel
              :metadata="detail.metadata"
              :app-name="appTitle"
            />
          </div>

          <aside class="xl:sticky xl:top-8">
            <AppDetailTrendPanel
              :snapshot="detail.snapshot"
              :history="detail.history"
              :summary="detail.summary"
              :loading-more="loadingMore"
              :can-load-more="canLoadMore"
              :store-url="detail.snapshot?.storeUrl ?? null"
              :store-platform-label="storePlatformLabel"
              @load-more="loadMoreHistory"
            />
          </aside>
        </div>
      </template>
    </div>
  </main>
</template>
