<script setup lang="ts">
defineProps<{
  currentUserEmail: string;
  sessionExpiresAt: string;
  watchStats: {
    total: number;
    withTarget: number;
  };
  successText: string;
  errorText: string;
  toTime: (value: string) => string;
}>();

const emit = defineEmits<{
  logout: [];
}>();
</script>

<template>
  <section class="reveal rounded-[2rem] border border-zinc-200/70 bg-white/92 p-6 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)]">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="metric-mono text-xs tracking-[0.22em] text-zinc-500">PROFILE</p>
        <h1 class="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl">订阅策略工作台</h1>
        <p class="mt-2 text-sm text-zinc-600">当前账号：{{ currentUserEmail }}</p>
        <p class="mt-1 text-xs text-zinc-500" v-if="sessionExpiresAt">会话有效期至：{{ toTime(sessionExpiresAt) }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          class="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-[1px]"
          type="button"
          @click="emit('logout')"
        >
          退出账号
        </button>
      </div>
    </div>

    <div class="mt-6 grid gap-3 md:grid-cols-2">
      <div class="rounded-2xl border border-zinc-200/75 bg-zinc-50/85 p-4">
        <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">监控任务数</p>
        <p class="metric-mono mt-2 text-2xl font-semibold text-zinc-900">{{ watchStats.total }}</p>
      </div>
      <div class="rounded-2xl border border-zinc-200/75 bg-zinc-50/85 p-4">
        <p class="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">已设价格阈值</p>
        <p class="metric-mono mt-2 text-2xl font-semibold text-zinc-900">{{ watchStats.withTarget }}</p>
      </div>
    </div>

    <p v-if="successText" class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
      {{ successText }}
    </p>
    <p v-if="errorText" class="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
      {{ errorText }}
    </p>
  </section>
</template>
