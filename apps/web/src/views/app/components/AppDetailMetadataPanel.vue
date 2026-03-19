<script setup lang="ts">
import type { AppDecisionMetadataDto } from '../types'
import { computed } from 'vue'
import { formatDate, formatFileSize } from '../../../lib/format'
import { resolveAppStoreGenreLabels } from '../../../lib/app-store'

interface InfoCardItem {
  label: string
  value: string
}

const props = defineProps<{
  metadata: AppDecisionMetadataDto | null
  appName: string
}>()

const DEVICE_CATEGORY_RULES = [
  { label: 'iPhone', pattern: /iphone/i },
  { label: 'iPad', pattern: /ipad/i },
  { label: 'Mac', pattern: /(^|[^a-z])mac(book|mini|pro|studio)?|imac|macos/i },
  { label: 'Apple TV', pattern: /appletv|tvos/i },
  { label: 'Apple Watch', pattern: /watch/i },
  { label: 'Apple Vision', pattern: /vision|reality/i },
  { label: 'iPod touch', pattern: /ipod/i },
] as const

const FEATURE_LABELS: Record<string, string> = {
  iosUniversal: '通用应用',
  arm64: '64 位',
  gameCenter: 'Game Center',
  metal: 'Metal',
  bluetoothLE: '蓝牙',
  locationServices: '定位服务',
  nfc: 'NFC',
  wirelessGameController: '无线手柄',
}

const FALLBACK_LANGUAGE_LABELS: Record<string, string> = {
  AR: '阿拉伯语',
  CS: '捷克语',
  DA: '丹麦语',
  DE: '德语',
  EL: '希腊语',
  EN: '英语',
  ES: '西班牙语',
  FI: '芬兰语',
  FR: '法语',
  HE: '希伯来语',
  HI: '印地语',
  HR: '克罗地亚语',
  HU: '匈牙利语',
  ID: '印度尼西亚语',
  IT: '意大利语',
  JA: '日语',
  KO: '韩语',
  MS: '马来语',
  NL: '荷兰语',
  NO: '挪威语',
  PL: '波兰语',
  PT: '葡萄牙语',
  RO: '罗马尼亚语',
  RU: '俄语',
  SK: '斯洛伐克语',
  SV: '瑞典语',
  TH: '泰语',
  TR: '土耳其语',
  UK: '乌克兰语',
  VI: '越南语',
  ZH: '中文',
}

const CRLF_RE = /\r\n/g
const NBSP_RE = /\u00A0/g
const HEADING_PREFIX_RE = /^#{1,6}\s+/
const QUOTE_PREFIX_RE = /^>\s+/
const BULLET_PREFIX_RE = /^[-*+•·]\s+/
const ORDERED_LIST_PREFIX_RE = /^\d+[.)]\s+/
const EMPTY_LINE_SPLIT_RE = /\n{2,}/g
const TEXT_ITEM_SPLIT_RE = /\n/g
const WHITESPACE_RE = /\s+/g

const languageDisplayNames = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['zh-Hans'], { type: 'language' })
  : null

function uniqueItems(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))))
}

function formatMetadataDate(value: string | null | undefined): string {
  return value ? formatDate(value) : '暂无'
}

function normalizeText(raw: string | null | undefined): string {
  return raw
    ?.replace(CRLF_RE, '\n')
    .replace(NBSP_RE, ' ')
    .trim() ?? ''
}

function stripListPrefix(value: string): string {
  return value
    .replace(HEADING_PREFIX_RE, '')
    .replace(QUOTE_PREFIX_RE, '')
    .replace(BULLET_PREFIX_RE, '')
    .replace(ORDERED_LIST_PREFIX_RE, '')
    .trim()
}

function splitTextItems(raw: string | null | undefined): string[] {
  const normalized = normalizeText(raw)

  if (!normalized) {
    return []
  }

  const paragraphs = normalized
    .split(EMPTY_LINE_SPLIT_RE)
    .map(block => block
      .split(TEXT_ITEM_SPLIT_RE)
      .map(stripListPrefix)
      .filter(Boolean)
      .join('\n'))
    .map(block => block.replace(WHITESPACE_RE, ' ').trim())
    .filter(Boolean)

  if (paragraphs.length > 0) {
    return paragraphs
  }

  return normalized
    .split(TEXT_ITEM_SPLIT_RE)
    .map(stripListPrefix)
    .map(block => block.replace(WHITESPACE_RE, ' ').trim())
    .filter(Boolean)
}

function inferDeviceCategories(
  supportedDevices: string[],
  features: string[],
): string[] {
  const normalizedValues = uniqueItems([
    ...supportedDevices,
    ...features,
  ]).map(value => value.toLowerCase())

  const categories = DEVICE_CATEGORY_RULES
    .filter(rule => normalizedValues.some(value => rule.pattern.test(value)))
    .map(rule => rule.label)

  if (normalizedValues.includes('iosuniversal')) {
    if (!categories.includes('iPhone')) {
      categories.unshift('iPhone')
    }

    if (!categories.includes('iPad')) {
      categories.push('iPad')
    }
  }

  return categories
}

function buildSystemRequirementText(
  categories: string[],
  minimumOsVersion: string | null | undefined,
): string {
  if (!minimumOsVersion) {
    return '暂无'
  }

  const platforms: string[] = []

  if (categories.includes('iPhone')) {
    platforms.push('iOS')
  }

  if (categories.includes('iPad')) {
    platforms.push('iPadOS')
  }

  if (categories.includes('Mac')) {
    platforms.push('macOS')
  }

  if (categories.includes('Apple TV')) {
    platforms.push('tvOS')
  }

  if (categories.includes('Apple Watch')) {
    platforms.push('watchOS')
  }

  if (categories.includes('Apple Vision')) {
    platforms.push('visionOS')
  }

  if (platforms.length === 0) {
    return `最低系统版本 ${minimumOsVersion}+`
  }

  return `${platforms.join(' / ')} ${minimumOsVersion}+`
}

function formatFeatureTag(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature
}

function formatLanguageName(code: string): string {
  const normalized = code.trim().toUpperCase()
  const fromIntl = languageDisplayNames?.of(normalized.toLowerCase())

  if (fromIntl) {
    return fromIntl
  }

  return FALLBACK_LANGUAGE_LABELS[normalized] ?? normalized
}

const hasMetadata = computed(() => Boolean(props.metadata))

const genres = computed(() => {
  return resolveAppStoreGenreLabels([
    ...(props.metadata?.genres ?? []),
    props.metadata?.primaryGenreName ?? null,
  ])
})

const screenshotUrls = computed(() => {
  return uniqueItems([
    ...(props.metadata?.screenshotUrls ?? []),
    ...(props.metadata?.ipadScreenshotUrls ?? []),
  ]).slice(0, 12)
})

const overviewCards = computed<InfoCardItem[]>(() => {
  const metadata = props.metadata

  return [
    { label: '开发者', value: metadata?.sellerName ?? '暂无' },
    { label: '分类', value: genres.value.length > 0 ? genres.value.join(' / ') : '暂无' },
    { label: 'Bundle ID', value: metadata?.bundleId ?? '暂无' },
    { label: '当前版本', value: metadata?.version ?? '暂无' },
    { label: '文件大小', value: formatFileSize(metadata?.fileSizeBytes) },
    { label: '最近更新', value: formatMetadataDate(metadata?.currentVersionReleaseDate) },
  ]
})

const compatibilityCategories = computed(() => {
  return inferDeviceCategories(
    props.metadata?.supportedDevices ?? [],
    props.metadata?.features ?? [],
  )
})

const compatibilityCards = computed<InfoCardItem[]>(() => {
  const metadata = props.metadata

  return [
    {
      label: '系统要求',
      value: buildSystemRequirementText(
        compatibilityCategories.value,
        metadata?.minimumOsVersion,
      ),
    },
    { label: '首次上架', value: formatMetadataDate(metadata?.releaseDate) },
    {
      label: '支持语言',
      value: metadata?.languageCodesISO2A.length
        ? `${metadata.languageCodesISO2A.length} 种语言`
        : '暂无',
    },
  ]
})

const supportedLanguageNames = computed(() => {
  return uniqueItems(props.metadata?.languageCodesISO2A ?? []).map(formatLanguageName)
})

const compatibilityFeatureTags = computed(() => {
  return uniqueItems(props.metadata?.features ?? [])
    .map(formatFeatureTag)
    .slice(0, 10)
})

const advisories = computed(() => {
  return props.metadata?.advisories ?? []
})

const releaseNotesItems = computed(() => {
  return splitTextItems(props.metadata?.releaseNotes)
})

const descriptionBlocks = computed(() => {
  return splitTextItems(props.metadata?.description)
})

const ratingCards = computed<InfoCardItem[]>(() => {
  return [
    { label: '年龄分级', value: props.metadata?.contentAdvisoryRating ?? props.metadata?.trackContentRating ?? '暂无' },
    {
      label: '综合评分',
      value: props.metadata?.averageUserRating === null || props.metadata?.averageUserRating === undefined
        ? '暂无'
        : props.metadata.averageUserRating.toFixed(1),
    },
    {
      label: '当前版本评分',
      value: props.metadata?.averageUserRatingForCurrentVersion === null || props.metadata?.averageUserRatingForCurrentVersion === undefined
        ? '暂无'
        : props.metadata.averageUserRatingForCurrentVersion.toFixed(1),
    },
    {
      label: '综合评价数',
      value: props.metadata?.userRatingCount === null || props.metadata?.userRatingCount === undefined
        ? '暂无'
        : props.metadata.userRatingCount.toLocaleString(),
    },
  ]
})
</script>

<template>
  <section class="rounded-[2rem] border border-zinc-200/70 bg-white/92 p-5 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-6">
    <div>
      <p class="text-sm font-medium tracking-[0.12em] text-zinc-500">
        App Store 信息
      </p>
      <h2 class="mt-2 text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl">
        {{ props.appName }} 的完整介绍
      </h2>
    </div>

    <div
      v-if="!hasMetadata"
      class="mt-4 rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/70 px-4 py-4 text-sm text-zinc-500"
    >
      当前还没有可展示的扩展元数据。
    </div>

    <template v-else>
      <article class="mt-5 rounded-[1.7rem] border border-zinc-200/80 bg-zinc-50/80 p-4 md:p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold tracking-tight text-zinc-900">
              应用截图
            </h3>
            <p class="mt-1 text-sm text-zinc-500">
              按 App Store 风格展示，左右滑动查看更多预览。
            </p>
          </div>
          <p class="text-sm text-zinc-500">
            {{ screenshotUrls.length > 0 ? `共 ${screenshotUrls.length} 张` : '暂无官方截图' }}
          </p>
        </div>

        <div
          v-if="screenshotUrls.length === 0"
          class="mt-4 rounded-[1.35rem] border border-dashed border-zinc-300 bg-white/80 px-4 py-4 text-sm leading-7 text-zinc-500"
        >
          当前 App Store 官方接口没有返回截图数据，所以这里不是跨域报错，而是源数据本身为空。
        </div>

        <div v-else class="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
          <figure
            v-for="(url, index) in screenshotUrls"
            :key="url"
            class="w-[13.5rem] shrink-0 snap-start overflow-hidden rounded-[2.2rem] bg-zinc-950 p-1 shadow-[0_26px_50px_-28px_rgba(15,23,42,0.65)] transition duration-300 hover:-translate-y-1 sm:w-[15rem]"
          >
            <div class="overflow-hidden rounded-[1.9rem] bg-zinc-100">
              <img
                :src="url"
                :alt="`${props.appName} 截图 ${index + 1}`"
                class="aspect-[9/19.5] w-full object-cover"
              >
            </div>
          </figure>
        </div>
      </article>

      <article class="mt-4 rounded-[1.7rem] border border-zinc-200/80 bg-zinc-50/80 p-4 md:p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold tracking-tight text-zinc-900">
              应用简介
            </h3>
          </div>
        </div>

        <div
          v-if="descriptionBlocks.length === 0"
          class="mt-4 rounded-[1.2rem] border border-dashed border-zinc-300 bg-white/75 px-4 py-4 text-sm text-zinc-500"
        >
          暂无应用简介。
        </div>

        <div v-else class="mt-4 space-y-4">
          <p
            v-for="(paragraph, index) in descriptionBlocks"
            :key="`${index}-${paragraph}`"
            class="text-[0.95rem] leading-8 text-zinc-700 whitespace-pre-line"
          >
            {{ paragraph }}
          </p>
        </div>
      </article>

      <article
        v-if="releaseNotesItems.length > 0"
        class="mt-4 rounded-[1.7rem] border border-zinc-200/80 bg-zinc-50/80 p-4 md:p-5"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold tracking-tight text-zinc-900">
              更新说明
            </h3>
            <p class="mt-1 text-sm text-zinc-500">
              版本 {{ props.metadata?.version ?? '暂无' }}
            </p>
          </div>
        </div>

        <ul class="mt-4 space-y-3">
          <li
            v-for="(item, index) in releaseNotesItems"
            :key="`${index}-${item}`"
            class="rounded-[1.2rem] border border-zinc-200/80 bg-white/90 px-4 py-3 text-sm leading-7 text-zinc-700"
          >
            {{ item }}
          </li>
        </ul>
      </article>

      <article class="mt-4 rounded-[1.7rem] border border-zinc-200/80 bg-zinc-50/80 p-4 md:p-5">
        <h3 class="text-lg font-semibold tracking-tight text-zinc-900">
          基础信息
        </h3>

        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <div
            v-for="item in overviewCards"
            :key="item.label"
            class="rounded-[1.25rem] border border-zinc-200/80 bg-white/90 p-4"
          >
            <p class="text-sm font-medium tracking-[0.08em] text-zinc-500">
              {{ item.label }}
            </p>
            <p class="mt-3 break-words text-base font-semibold leading-8 text-zinc-900">
              {{ item.value }}
            </p>
          </div>
        </div>
      </article>

      <article class="mt-4 rounded-[1.7rem] border border-zinc-200/80 bg-zinc-50/80 p-4 md:p-5">
        <h3 class="text-lg font-semibold tracking-tight text-zinc-900">
          兼容性
        </h3>

        <div class="mt-4 grid gap-3 md:grid-cols-3">
          <div
            v-for="item in compatibilityCards"
            :key="item.label"
            class="rounded-[1.25rem] border border-zinc-200/80 bg-white/90 p-4"
          >
            <p class="text-sm font-medium tracking-[0.08em] text-zinc-500">
              {{ item.label }}
            </p>
            <p class="mt-3 text-base font-semibold leading-8 text-zinc-900">
              {{ item.value }}
            </p>
          </div>
        </div>

        <div v-if="compatibilityCategories.length > 0" class="mt-5">
          <p class="text-sm font-medium tracking-[0.08em] text-zinc-500">
            适用设备
          </p>
          <div class="mt-3 flex flex-wrap gap-2.5">
            <span
              v-for="category in compatibilityCategories"
              :key="category"
              class="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700"
            >
              {{ category }}
            </span>
          </div>
        </div>

        <div v-if="supportedLanguageNames.length > 0" class="mt-5">
          <p class="text-sm font-medium tracking-[0.08em] text-zinc-500">
            支持语言
          </p>
          <div class="mt-3 flex flex-wrap gap-2.5">
            <span
              v-for="language in supportedLanguageNames"
              :key="language"
              class="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700"
            >
              {{ language }}
            </span>
          </div>
        </div>

        <div v-if="compatibilityFeatureTags.length > 0" class="mt-5">
          <p class="text-sm font-medium tracking-[0.08em] text-zinc-500">
            系统 / 硬件能力
          </p>
          <div class="mt-3 flex flex-wrap gap-2.5">
            <span
              v-for="feature in compatibilityFeatureTags"
              :key="feature"
              class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-sm font-medium text-emerald-700"
            >
              {{ feature }}
            </span>
          </div>
        </div>
      </article>

      <article class="mt-4 rounded-[1.7rem] border border-zinc-200/80 bg-zinc-50/80 p-4 md:p-5">
        <h3 class="text-lg font-semibold tracking-tight text-zinc-900">
          评分与分级
        </h3>

        <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div
            v-for="item in ratingCards"
            :key="item.label"
            class="rounded-[1.25rem] border border-zinc-200/80 bg-white/90 p-4"
          >
            <p class="text-sm font-medium tracking-[0.08em] text-zinc-500">
              {{ item.label }}
            </p>
            <p class="mt-3 text-xl font-semibold text-zinc-900">
              {{ item.value }}
            </p>
          </div>
        </div>

        <div v-if="advisories.length > 0" class="mt-5">
          <p class="text-sm font-medium tracking-[0.08em] text-zinc-500">
            分级说明
          </p>
          <div class="mt-3 flex flex-wrap gap-2.5">
            <span
              v-for="item in advisories"
              :key="item"
              class="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700"
            >
              {{ item }}
            </span>
          </div>
        </div>
      </article>
    </template>
  </section>
</template>
