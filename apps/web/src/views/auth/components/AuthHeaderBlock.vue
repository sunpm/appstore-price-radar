<script setup lang="ts">
defineProps<{
  isPageMode: boolean;
}>();
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <p class="text-xs tracking-[0.18em] text-zinc-500">AUTHENTICATION</p>
      <h1 class="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl">账号访问与安全验证</h1>
    </div>
    <div v-if="isPageMode" class="flex items-center gap-2">
      <RouterLink
        to="/"
        class="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-400 hover:text-zinc-900 active:translate-y-[1px]"
      >
        返回市场动态
      </RouterLink>
    </div>
  </div>
</template>
