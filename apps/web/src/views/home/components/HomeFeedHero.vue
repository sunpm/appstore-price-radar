<script setup lang="ts">
defineProps<{
  summary: {
    total: number;
    apps: number;
    maxDrop: number;
  };
}>();
</script>

<template>
  <article class="reveal rounded-[2rem] border border-zinc-200/70 bg-white/92 p-6 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)]">
    <p class="metric-mono text-xs tracking-[0.2em] text-zinc-500">PRICE DROP FEED</p>
    <h1 class="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 md:text-5xl">公开降价情报中心</h1>
    <p class="mt-4 max-w-[64ch] text-base leading-relaxed text-zinc-600">
      仅展示曾出现价格下调的公开记录。即使后续恢复原价，记录仍会保留，时间标记为系统首次捕捉到降价的时刻。
    </p>

    <div class="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
      <div class="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
        <p class="text-xs uppercase tracking-[0.14em] text-zinc-500">公开降价事件</p>
        <p class="metric-mono mt-2 text-2xl font-semibold">{{ summary.total }}</p>
      </div>
      <div class="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
        <p class="text-xs uppercase tracking-[0.14em] text-zinc-500">覆盖应用数</p>
        <p class="metric-mono mt-2 text-2xl font-semibold">{{ summary.apps }}</p>
      </div>
      <div class="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
        <p class="text-xs uppercase tracking-[0.14em] text-zinc-500">最高降幅</p>
        <p class="metric-mono mt-2 text-2xl font-semibold text-emerald-700">{{ summary.maxDrop.toFixed(2) }}%</p>
      </div>
    </div>
  </article>
</template>
