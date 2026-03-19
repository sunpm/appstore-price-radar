<script setup lang="ts">
import type { AppDecisionMetadataDto } from '../types'
import { computed } from 'vue'
import { formatDate, formatFileSize } from '../../../lib/format'

interface InfoCardItem {
  label: string
  value: string
}

const props = defineProps<{
  metadata: AppDecisionMetadataDto | null
  appName: string
  storeUrl: string | null
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

const CRLF_RE = /\r\n/g
const NBSP_RE = /\u00A0/g
const HEADING_PREFIX_RE = /^#{1,6}\s+/
const QUOTE_PREFIX_RE = /^>\s+/
const BULLET_PREFIX_RE = /^[-*+]\s+/
const ORDERED_LIST_PREFIX_RE = /^\d+[.)]\s+/
const EMPTY_LINE_SPLIT_RE = /\n+/g
const TEXT_ITEM_SPLIT_RE = /(?=\d+[.)]\s)|(?=•\s)|(?=·\s)/g
const WHITESPACE_RE = /\s+/g

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

  const byLine = normalized
    .split(EMPTY_LINE_SPLIT_RE)
    .map(stripListPrefix)
    .filter(Boolean)

  if (byLine.length > 1) {
    return byLine
  }

  return normalized
    .split(TEXT_ITEM_SPLIT_RE)
    .map(stripListPrefix)
    .filter(Boolean)
}

function summarizeDescription(raw: string | null | undefined): string[] {
  const items = splitTextItems(raw)

  if (items.length === 0) {
    return []
  }

  const paragraphs: string[] = []
  let totalLength = 0

  for (const item of items) {
    const compact = item.replace(WHITESPACE_RE, ' ').trim()

    if (!compact) {
      continue
    }

    const clipped = compact.length > 220
      ? `${compact.slice(0, 217).trimEnd()}...`
      : compact

    if (paragraphs.length > 0 && totalLength + clipped.length > 420) {
      break
    }

    paragraphs.push(clipped)
    totalLength += clipped.length

    if (paragraphs.length >= 3) {
      break
    }
  }

  return paragraphs
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

const hasMetadata = computed(() => Boolean(props.metadata))

const genres = computed(() => {
  return uniqueItems([
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
      label: '适用设备',
      value: compatibilityCategories.value.length > 0
        ? compatibilityCategories.value.join(' / ')
        : '暂无',
    },
    {
      label: '系统要求',
      value: buildSystemRequirementText(
        compatibilityCategories.value,
        metadata?.minimumOsVersion,
      ),
    },
    {
      label: '支持语言',
      value: metadata?.languageCodesISO2A.length
        ? `${metadata.languageCodesISO2A.length} 种`
        : '暂无',
    },
    { label: '首次上架', value: formatMetadataDate(metadata?.releaseDate) },
  ]
})

const languageCodes = computed(() => {
  return (props.metadata?.languageCodesISO2A ?? []).slice(0, 12)
})

const compatibilityFeatureTags = computed(() => {
  return uniqueItems(props.metadata?.features ?? [])
    .map(formatFeatureTag)
    .slice(0, 8)
})

const advisories = computed(() => {
  return props.metadata?.advisories ?? []
})

const links = computed(() => {
  return [
    { label: 'App Store', href: props.storeUrl },
    { label: '开发者页面', href: props.metadata?.artistViewUrl ?? null },
    { label: '开发者网站', href: props.metadata?.sellerUrl ?? null },
  ].filter((item): item is { label: string, href: string } => Boolean(item.href))
})

const releaseNotesItems = computed(() => {
  return splitTextItems(props.metadata?.releaseNotes).slice(0, 8)
})

const descriptionSummary = computed(() => {
  return summarizeDescription(props.metadata?.description)
})

const hasTrimmedDescription = computed(() => {
  const fullText = normalizeText(props.metadata?.description)
  const summaryText = descriptionSummary.value.join(' ')

  return Boolean(fullText && summaryText && summaryText.length < fullText.length)
})

const contentRatingText = computed(() => {
  return props.metadata?.contentAdvisoryRating ?? props.metadata?.trackContentRating ?? '暂无'
})
</script>

<template>
  <section class="rounded-[2rem] border border-zinc-200/70 bg-white/92 p-5 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="metric-mono text-xs tracking-[0.18em] text-zinc-500">
          STORE METADATA
        </p>
        <h2 class="mt-2 text-xl font-semibold tracking-tight text-zinc-900">
          应用详情信息
        </h2>
      </div>

      <a
        v-if="props.storeUrl"
        :href="props.storeUrl"
        target="_blank"
        rel="noreferrer"
        class="inline-flex items-center rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800"
      >
        前往 App Store
      </a>
    </div>

    <div
      v-if="!hasMetadata"
      class="mt-4 rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/70 px-4 py-4 text-sm text-zinc-500"
    >
      当前还没有可展示的扩展元数据。
    </div>

    <template v-else>
      <div class="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.14fr)_minmax(20rem,0.86fr)]">
        <div class="space-y-4">
          <article
            v-if="screenshotUrls.length > 0"
            class="rounded-[1.6rem] border border-zinc-200/80 bg-zinc-50/75 p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="text-lg font-semibold tracking-tight text-zinc-900">
                截图预览
              </h3>
              <p class="text-sm text-zinc-500">
                共 {{ screenshotUrls.length }} 张
              </p>
            </div>

            <div class="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
              <figure
                v-for="(url, index) in screenshotUrls"
                :key="url"
                class="min-w-[78%] snap-start overflow-hidden rounded-[1.4rem] border border-zinc-200/80 bg-white/90 shadow-[0_18px_35px_-22px_rgba(15,23,42,0.35)] sm:min-w-[56%] xl:min-w-[48%]"
              >
                <img
                  :src="url"
                  :alt="`${props.appName} 截图 ${index + 1}`"
                  class="h-full max-h-[22rem] w-full object-cover"
                >
              </figure>
            </div>
          </article>

          <article
            v-if="releaseNotesItems.length > 0"
            class="rounded-[1.6rem] border border-zinc-200/80 bg-zinc-50/75 p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="text-lg font-semibold tracking-tight text-zinc-900">
                更新记录
              </h3>
              <p class="text-sm text-zinc-500">
                版本 {{ props.metadata?.version ?? '暂无' }}
              </p>
            </div>

            <ul class="mt-4 space-y-3">
              <li
                v-for="(item, index) in releaseNotesItems"
                :key="`${index}-${item}`"
                class="rounded-[1.2rem] border border-zinc-200/80 bg-white/85 px-4 py-3 text-sm leading-6 text-zinc-700"
              >
                {{ item }}
              </li>
            </ul>
          </article>

          <article
            v-if="descriptionSummary.length > 0"
            class="rounded-[1.6rem] border border-zinc-200/80 bg-zinc-50/75 p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="text-lg font-semibold tracking-tight text-zinc-900">
                应用简介
              </h3>
              <p class="text-sm text-zinc-500">
                精简展示
              </p>
            </div>

            <div class="mt-4 space-y-3">
              <p
                v-for="(paragraph, index) in descriptionSummary"
                :key="`${index}-${paragraph}`"
                class="text-sm leading-7 text-zinc-700"
              >
                {{ paragraph }}
              </p>
            </div>

            <a
              v-if="hasTrimmedDescription && props.storeUrl"
              :href="props.storeUrl"
              target="_blank"
              rel="noreferrer"
              class="mt-4 inline-flex items-center text-sm font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-4 transition duration-300 hover:text-zinc-900"
            >
              查看完整商店说明
            </a>
          </article>
        </div>

        <aside class="space-y-4">
          <article class="rounded-[1.6rem] border border-zinc-200/80 bg-zinc-50/75 p-4">
            <h3 class="text-lg font-semibold tracking-tight text-zinc-900">
              基础信息
            </h3>
            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div
                v-for="item in overviewCards"
                :key="item.label"
                class="rounded-[1.2rem] border border-zinc-200/80 bg-white/85 p-3"
              >
                <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  {{ item.label }}
                </p>
                <p class="mt-2 break-words text-sm font-medium text-zinc-800">
                  {{ item.value }}
                </p>
              </div>
            </div>
          </article>

          <article class="rounded-[1.6rem] border border-zinc-200/80 bg-zinc-50/75 p-4">
            <h3 class="text-lg font-semibold tracking-tight text-zinc-900">
              兼容性
            </h3>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div
                v-for="item in compatibilityCards"
                :key="item.label"
                class="rounded-[1.2rem] border border-zinc-200/80 bg-white/85 p-3"
              >
                <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  {{ item.label }}
                </p>
                <p class="mt-2 text-sm font-medium text-zinc-800">
                  {{ item.value }}
                </p>
              </div>
            </div>

            <div v-if="compatibilityCategories.length > 0" class="mt-4">
              <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                设备类别
              </p>
              <div class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="category in compatibilityCategories"
                  :key="category"
                  class="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700"
                >
                  {{ category }}
                </span>
              </div>
            </div>

            <div v-if="compatibilityFeatureTags.length > 0" class="mt-4">
              <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                系统 / 硬件要求
              </p>
              <div class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="feature in compatibilityFeatureTags"
                  :key="feature"
                  class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                >
                  {{ feature }}
                </span>
              </div>
            </div>

            <div v-if="languageCodes.length > 0" class="mt-4">
              <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                语言代码
              </p>
              <div class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="code in languageCodes"
                  :key="code"
                  class="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600"
                >
                  {{ code }}
                </span>
              </div>
            </div>
          </article>

          <article class="rounded-[1.6rem] border border-zinc-200/80 bg-zinc-50/75 p-4">
            <h3 class="text-lg font-semibold tracking-tight text-zinc-900">
              分级与官方链接
            </h3>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-[1.2rem] border border-zinc-200/80 bg-white/85 p-3">
                <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  年龄分级
                </p>
                <p class="mt-2 text-sm font-medium text-zinc-800">
                  {{ contentRatingText }}
                </p>
              </div>

              <div class="rounded-[1.2rem] border border-zinc-200/80 bg-white/85 p-3">
                <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  综合评价数
                </p>
                <p class="mt-2 text-sm font-medium text-zinc-800">
                  {{ props.metadata?.userRatingCount?.toLocaleString() ?? '暂无' }}
                </p>
              </div>
            </div>

            <div v-if="advisories.length > 0" class="mt-4">
              <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                内容提示
              </p>
              <div class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="advisory in advisories"
                  :key="advisory"
                  class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
                >
                  {{ advisory }}
                </span>
              </div>
            </div>

            <div v-if="links.length > 0" class="mt-4 flex flex-wrap gap-2">
              <a
                v-for="link in links"
                :key="link.label"
                :href="link.href"
                target="_blank"
                rel="noreferrer"
                class="inline-flex items-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-400 hover:text-zinc-900"
              >
                {{ link.label }}
              </a>
            </div>
          </article>
        </aside>
      </div>
    </template>
  </section>
</template>
