<script setup lang="ts">
import type { AppDecisionMetadataDto } from '../types'
import { computed, ref } from 'vue'

const props = defineProps<{
  metadata: AppDecisionMetadataDto | null
}>()

const expanded = ref(false)

const summaryFields = computed(() => {
  const metadata = props.metadata

  return [
    { label: '开发者', value: metadata?.sellerName ?? null },
    { label: 'Bundle ID', value: metadata?.bundleId ?? null },
    { label: '当前版本', value: metadata?.version ?? null },
    { label: '最低系统版本', value: metadata?.minimumOsVersion ?? null },
  ].filter(item => item.value)
})

const descriptionText = computed(() => {
  return props.metadata?.description?.trim() ?? ''
})

const releaseNotesText = computed(() => {
  return props.metadata?.releaseNotes?.trim() ?? ''
})
</script>

<template>
  <section class="rounded-[2rem] border border-zinc-200/70 bg-white/92 p-5 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)] md:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="metric-mono text-xs tracking-[0.18em] text-zinc-500">
          EXTENDED METADATA
        </p>
        <h2 class="mt-2 text-xl font-semibold tracking-tight text-zinc-900">
          扩展信息默认折叠，避免干扰核心判断
        </h2>
      </div>

      <button
        type="button"
        class="inline-flex items-center rounded-xl border border-zinc-900 px-4 py-2.5 text-sm font-medium transition duration-300"
        :class="expanded ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'bg-white text-zinc-900 hover:-translate-y-0.5'"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收起扩展信息' : '展开更多应用信息' }}
      </button>
    </div>

    <div v-if="!expanded" class="mt-4 rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/70 px-4 py-4 text-sm text-zinc-600">
      描述摘要、发行说明和技术字段已折叠。需要核对版本、兼容系统或发行说明时再展开查看。
    </div>

    <div v-else class="mt-4 space-y-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="item in summaryFields"
          :key="item.label"
          class="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4"
        >
          <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            {{ item.label }}
          </p>
          <strong class="mt-2 block break-all text-sm font-semibold text-zinc-900">{{ item.value }}</strong>
        </article>
      </div>

      <article v-if="releaseNotesText" class="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4">
        <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
          发行说明
        </p>
        <p class="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-700">
          {{ releaseNotesText }}
        </p>
      </article>

      <article v-if="descriptionText" class="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4">
        <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
          描述摘要
        </p>
        <p class="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-700">
          {{ descriptionText }}
        </p>
      </article>

      <div
        v-if="summaryFields.length === 0 && !releaseNotesText && !descriptionText"
        class="rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/70 px-4 py-4 text-sm text-zinc-500"
      >
        当前还没有可展示的扩展元数据。
      </div>
    </div>
  </section>
</template>
