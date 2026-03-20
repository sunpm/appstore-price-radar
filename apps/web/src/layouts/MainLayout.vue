<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useAuthSession } from '../composables/useAuthSession'
import AuthView from '../views/auth/AuthView.vue'

interface NavItem {
  label: string
  path: string
}

const route = useRoute()
const { token } = useAuthSession()
const showAuthModal = ref(false)
const showLoginAction = computed(() => !token.value && route.name !== 'auth')

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { label: '降价记录', path: '/' },
  ]

  if (token.value) {
    items.push(
      { label: '我的订阅', path: '/profile' },
      { label: '账号安全', path: '/security' },
    )
  }

  return items
})

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

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
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
  <div class="radar-page-shell">
    <header class="radar-view sticky top-0 z-40 border-b border-slate-200/70 bg-white/72 backdrop-blur-xl">
      <div class="radar-container">
        <div class="radar-topbar">
          <RouterLink to="/" class="group flex min-w-0 items-center gap-3">
            <span class="radar-brand-mark">
              ASPR
            </span>

            <span class="min-w-0">
              <span class="metric-mono block text-[0.66rem] font-semibold tracking-[0.24em] text-slate-500">
                APP STORE PRICE RADAR
              </span>
              <span class="mt-1 block truncate font-['Space_Grotesk'] text-lg font-bold tracking-[-0.04em] text-slate-950 md:text-[1.38rem]">
                降价记录与我的订阅
              </span>
            </span>
          </RouterLink>

          <div class="flex min-w-0 flex-wrap items-center justify-end gap-x-6 gap-y-3">
            <nav class="radar-top-nav">
              <RouterLink
                v-for="item in navItems"
                :key="item.path"
                :to="item.path"
                class="radar-focus radar-top-nav-link"
              >
                {{ item.label }}
              </RouterLink>
            </nav>

            <button
              v-if="showLoginAction"
              type="button"
              class="radar-focus radar-button-secondary px-4 py-2.5 text-sm"
              @click="openAuthModal"
            >
              登录
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="radar-view pb-8 md:pb-10">
      <RouterView />
    </main>

    <div v-if="showAuthModal" class="fixed inset-0 z-50 p-4 md:p-6">
      <button
        type="button"
        aria-label="关闭登录窗口"
        class="absolute inset-0 bg-slate-950/54 backdrop-blur-[4px]"
        @click="closeAuthModal"
      />

      <div class="relative mx-auto mt-[4vh] w-full max-w-[860px]">
        <button
          type="button"
          class="radar-button-secondary absolute right-3 top-3 z-20 px-3 py-1.5 text-xs"
          @click="closeAuthModal"
        >
          关闭窗口
        </button>

        <AuthView mode="modal" :redirect-on-success="false" @authenticated="handleAuthenticated" />
      </div>
    </div>
  </div>
</template>
