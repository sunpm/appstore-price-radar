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
        {{ showResetPanel ? 'RECOVERY DESK' : isPageMode ? 'AUTHENTICATION HUB' : 'QUICK ACCESS' }}
      </p>
      <h1 class="mt-2 font-['Space_Grotesk'] font-bold tracking-[-0.05em] text-slate-950" :class="isPageMode ? 'text-3xl md:text-[2.8rem]' : 'text-2xl md:text-[2.35rem]'">
        {{ showResetPanel ? '找回访问权限并安全重置密码' : isPageMode ? '账号访问、验证码与重置在同一入口完成' : '快速登录 App Store Price Radar' }}
      </h1>
      <p class="mt-3 text-sm leading-6 text-slate-500">
        {{ showResetPanel ? '先确认邮箱，再完成令牌与新密码提交。整个流程保持在当前页面内，不需要额外跳转。' : isPageMode ? '支持密码登录、邮箱验证码登录与注册校验，让工作台和安全页共享同一个会话入口。' : '你可以直接登录，也可以发送验证码完成快速访问。' }}
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
