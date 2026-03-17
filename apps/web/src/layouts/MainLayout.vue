<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { AUTH_TOKEN_CHANGED_EVENT, getStoredToken, TOKEN_STORAGE_KEY } from '../lib/auth-session'
import AuthView from '../views/auth/AuthView.vue'

const route = useRoute()
const token = ref('')
const showAuthModal = ref(false)

function navClass(active: boolean) {
  return active
    ? 'border-zinc-900 bg-zinc-900 text-white'
    : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-900'
}

function isRouteActive(path: string) {
  if (path === '/') {
    return route.path === '/'
  }

  return route.path === path || route.path.startsWith(`${path}/`)
}

function syncToken() {
  token.value = getStoredToken()
}

function loadCurrentToken() {
  syncToken()
}

function handleAuthChanged() {
  loadCurrentToken()
}

function handleStorage(event: StorageEvent) {
  if (event.key !== TOKEN_STORAGE_KEY) {
    return
  }

  loadCurrentToken()
}

function openAuthModal() {
  showAuthModal.value = true
}

function closeAuthModal() {
  showAuthModal.value = false
}

function handleAuthenticated() {
  showAuthModal.value = false
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showAuthModal.value) {
    closeAuthModal()
  }
}

function loginEntryActive() {
  return showAuthModal.value
}

onMounted(() => {
  loadCurrentToken()
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handleAuthChanged)
  window.addEventListener('storage', handleStorage)
  window.addEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, handleAuthChanged)
  window.removeEventListener('storage', handleStorage)
  window.removeEventListener('keydown', handleWindowKeydown)
})

watch(
  () => route.fullPath,
  () => {
    closeAuthModal()
  },
)

watch(
  () => token.value,
  (next) => {
    if (next) {
      closeAuthModal()
    }
  },
)
</script>

<template>
  <div class="min-h-[100dvh] bg-zinc-100">
    <header class="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/85 backdrop-blur-md">
      <div class="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 md:px-8">
        <RouterLink to="/" class="text-sm font-semibold tracking-[0.16em] text-zinc-700">
          APP STORE PRICE RADAR
        </RouterLink>
        <nav class="flex items-center gap-2">
          <RouterLink
            to="/"
            class="inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-sm font-medium transition duration-300"
            :class="navClass(isRouteActive('/'))"
          >
            市场动态
          </RouterLink>

          <RouterLink
            v-if="!token && isRouteActive('/auth')"
            to="/auth"
            class="inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-sm font-medium transition duration-300"
            :class="navClass(true)"
          >
            登录
          </RouterLink>
          <button
            v-else-if="!token"
            type="button"
            class="inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-sm font-medium transition duration-300"
            :class="navClass(loginEntryActive())"
            @click="openAuthModal"
          >
            登录
          </button>
          <RouterLink
            v-else
            to="/profile"
            class="inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-sm font-medium transition duration-300"
            :class="navClass(isRouteActive('/profile'))"
          >
            我的工作台
          </RouterLink>
        </nav>
      </div>
    </header>

    <RouterView />

    <div v-if="showAuthModal" class="fixed inset-0 z-50 p-4 md:p-6">
      <button
        type="button"
        aria-label="关闭登录窗口"
        class="absolute inset-0 bg-zinc-950/45 backdrop-blur-[1.5px]"
        @click="closeAuthModal"
      />

      <div class="relative mx-auto mt-[4vh] w-full max-w-[760px]">
        <button
          type="button"
          class="absolute right-3 top-3 z-20 inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white/95 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-zinc-400 hover:text-zinc-900 active:translate-y-[1px]"
          @click="closeAuthModal"
        >
          关闭窗口
        </button>

        <AuthView mode="modal" :redirect-on-success="false" @authenticated="handleAuthenticated" />
      </div>
    </div>
  </div>
</template>
