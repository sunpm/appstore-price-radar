<script setup lang="ts">
import type { DropEventItem, HomeFeedSummary } from './types'
import { computed, onMounted, ref, watch } from 'vue'
import { ALL_COUNTRY_CODE, COUNTRY_OPTIONS_WITH_ALL, resolveCountryLabel } from '../../constants/countries'
import { formatDateTime, formatMoney } from '../../lib/format'
import { buildApiUrl, parseApiErrorText } from '../../lib/http'
import { useToast } from '../../lib/toast'
import HomeFeedFilters from './components/HomeFeedFilters.vue'
import HomeFeedHero from './components/HomeFeedHero.vue'
import HomeFeedList from './components/HomeFeedList.vue'

const countryOptions = COUNTRY_OPTIONS_WITH_ALL
const FAILED_TO_FETCH_RE = /Failed to fetch/i
const HTML_RESPONSE_RE = /Unexpected token </i

function countryLabel(country: string): string {
  return resolveCountryLabel(country)
}

const loading = ref(false)
const errorText = ref('')
const keyword = ref('')
const selectedCountry = ref(ALL_COUNTRY_CODE)
const drops = ref<DropEventItem[]>([])
const toast = useToast()

watch(errorText, (next): void => {
  if (!next) {
    return
  }

  toast.error(next)
})

function toMoney(value: number | null | undefined, currency = 'USD'): string {
  return formatMoney(value, currency)
}

function toRelativeText(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()

  if (diff <= 0) {
    return '刚刚'
  }

  const minutes = Math.floor(diff / 60_000)

  if (minutes < 1) {
    return '刚刚'
  }

  if (minutes < 60) {
    return `${minutes} 分钟前`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours} 小时前`
  }

  const days = Math.floor(hours / 24)

  if (days === 1) {
    return '昨天'
  }

  if (days === 2) {
    return '前天'
  }

  if (days <= 10) {
    return `${days} 天前`
  }

  return `${days} 天前（历史记录保留）`
}

function toTime(iso: string): string {
  return formatDateTime(iso)
}

function toFriendlyLoadError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message || ''

    if (FAILED_TO_FETCH_RE.test(message)) {
      return '请求失败：请检查 Worker 的 CORS_ORIGIN 是否包含当前前端域名，以及 VITE_API_BASE 是否正确。'
    }

    if (HTML_RESPONSE_RE.test(message)) {
      return '请求返回了 HTML 而不是 JSON：请检查 VITE_API_BASE 是否指向 Worker API 域名。'
    }

    return message
  }

  return '公开记录加载失败，请稍后重试。'
}

async function loadDrops(): Promise<void> {
  loading.value = true
  errorText.value = ''

  try {
    const params = new URLSearchParams({ limit: '120', dedupe: '1' })

    if (selectedCountry.value !== ALL_COUNTRY_CODE) {
      params.set('country', selectedCountry.value)
    }

    const res = await fetch(buildApiUrl(`/api/public/drops?${params.toString()}`))

    if (!res.ok) {
      throw new Error(await parseApiErrorText(res))
    }

    const data = (await res.json()) as { items: DropEventItem[] }
    drops.value = data.items
  }
  catch (error) {
    errorText.value = toFriendlyLoadError(error)
  }
  finally {
    loading.value = false
  }
}

const filteredDrops = computed<DropEventItem[]>(() => {
  const key = keyword.value.trim().toLowerCase()

  if (!key) {
    return drops.value
  }

  return drops.value.filter((item) => {
    const text = `${item.appName} ${item.appId} ${item.country}`.toLowerCase()
    return text.includes(key)
  })
})

const summary = computed<HomeFeedSummary>(() => {
  const total = drops.value.length
  const apps = new Set(drops.value.map(item => `${item.appId}:${item.country}`)).size
  const countries = new Set(drops.value.map(item => item.country)).size
  const maxDrop = drops.value.reduce((max, item) => {
    if (item.dropPercent === null) {
      return max
    }

    return Math.max(max, item.dropPercent)
  }, 0)
  const newestAt = drops.value.reduce<string | null>((latest, item) => {
    if (!latest) {
      return item.detectedAt
    }

    return new Date(item.detectedAt).getTime() > new Date(latest).getTime()
      ? item.detectedAt
      : latest
  }, null)

  return {
    total,
    apps,
    maxDrop,
    countries,
    newestAt,
  }
})

const selectedCountryLabel = computed(() => countryLabel(selectedCountry.value))

onMounted(async (): Promise<void> => {
  await loadDrops()
})
</script>

<template>
  <main class="radar-view">
    <div class="radar-container pb-12 pt-5 md:pb-14 md:pt-6">
      <section class="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_340px] xl:items-start">
        <HomeFeedHero :summary="summary" />

        <aside class="xl:sticky xl:top-24">
          <HomeFeedFilters
            v-model:selected-country="selectedCountry"
            v-model:keyword="keyword"
            :country-options="countryOptions"
            :loading="loading"
            :result-count="filteredDrops.length"
            :selected-country-label="selectedCountryLabel"
            :total-count="drops.length"
            @refresh="loadDrops"
          />
        </aside>
      </section>

      <HomeFeedList
        :loading="loading"
        :error-text="errorText"
        :items="filteredDrops"
        :country-label="countryLabel"
        :to-money="toMoney"
        :to-relative-text="toRelativeText"
        :to-time="toTime"
      />
    </div>
  </main>
</template>
