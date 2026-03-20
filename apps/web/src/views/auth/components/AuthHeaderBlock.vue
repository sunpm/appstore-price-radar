<script setup lang="ts">
defineProps<{
  isPageMode: boolean
}>()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <p class="text-xs tracking-[0.18em] text-zinc-500">
        {{ isPageMode ? 'AUTHENTICATION' : 'SIGN IN' }}
      </p>
      <h1 class="mt-2 font-semibold tracking-tight text-zinc-900" :class="isPageMode ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'">
        {{ isPageMode ? '登录、注册与密码重置' : '登录账号' }}
      </h1>
      <p class="mt-2 text-sm text-zinc-500">
        {{ isPageMode ? '支持密码登录、邮箱验证码登录、注册和密码重置。' : '支持密码登录和邮箱验证码登录。' }}
      </p>
    </div>
    <div v-if="isPageMode" class="flex items-center gap-2">
      <RouterLink
        to="/"
        class="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-400 hover:text-zinc-900 active:translate-y-[1px]"
      >
        返回降价记录
      </RouterLink>
    </div>
  </div>
</template>
