<script setup lang="ts">
defineProps<{
  isPageMode: boolean
  showResetPanel: boolean
}>()
</script>

<template>
  <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
    <div class="max-w-2xl">
      <p class="metric-mono text-[0.68rem] tracking-[0.24em] text-slate-400">
        {{ showResetPanel ? 'PASSWORD RESET' : isPageMode ? 'AUTHENTICATION' : 'SIGN IN' }}
      </p>
      <h1 class="mt-2 font-['Space_Grotesk'] font-bold tracking-[-0.05em] text-slate-950" :class="isPageMode ? 'text-3xl md:text-[2.8rem]' : 'text-2xl md:text-[2.35rem]'">
        {{ showResetPanel ? '重置密码' : isPageMode ? '登录、注册与密码重置' : '登录账号' }}
      </h1>
      <p class="mt-3 text-sm leading-6 text-slate-500">
        {{ showResetPanel ? '先确认邮箱，再提交令牌和新密码。' : isPageMode ? '支持密码登录、邮箱验证码登录、注册和密码重置。' : '支持密码登录和邮箱验证码登录。' }}
      </p>
    </div>

    <div class="flex flex-wrap gap-2 md:justify-end">
      <span class="radar-chip">
        邮箱验证码
      </span>
      <span class="radar-chip">
        密码登录
      </span>
      <span class="radar-chip">
        安全重置
      </span>
    </div>
  </div>
</template>
