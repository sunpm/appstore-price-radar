import type { RouteLocationNormalizedGeneric, Router, RouterHistory } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

import MainLayout from './layouts/MainLayout.vue'
import { hasStoredAuthSession } from './lib/auth-session'
import AppDetailView from './views/app/AppDetailView.vue'
import AuthView from './views/auth/AuthView.vue'
import HomeView from './views/home/HomeView.vue'
import ProfileView from './views/profile/ProfileView.vue'
import SecurityView from './views/security/SecurityView.vue'

const routes = [
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '',
        name: 'home',
        component: HomeView,
      },
      {
        path: 'apps/:appId/:country',
        name: 'app-detail',
        component: AppDetailView,
      },
      {
        path: 'profile',
        name: 'profile',
        component: ProfileView,
        meta: {
          requiresAuth: true,
        },
      },
      {
        path: 'security',
        name: 'security',
        component: SecurityView,
        meta: {
          requiresAuth: true,
        },
      },
      {
        path: 'auth',
        name: 'auth',
        component: AuthView,
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export function authGuard(to: RouteLocationNormalizedGeneric) {
  if (to.meta.requiresAuth && !hasStoredAuthSession()) {
    return { path: '/auth' }
  }

  return true
}

export function installAuthGuard(router: Router): Router {
  router.beforeEach(authGuard)
  return router
}

export function createAppRouter(history: RouterHistory = createWebHistory()): Router {
  return installAuthGuard(createRouter({
    history,
    routes,
  }))
}

const router = createAppRouter()

export default router
