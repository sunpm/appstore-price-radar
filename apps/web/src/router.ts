import { createRouter, createWebHistory } from 'vue-router'

import MainLayout from './layouts/MainLayout.vue'
import { getStoredToken } from './lib/auth-session'
import AppDetailView from './views/app/AppDetailView.vue'
import AuthView from './views/auth/AuthView.vue'
import HomeView from './views/home/HomeView.vue'
import ProfileView from './views/profile/ProfileView.vue'
import SecurityView from './views/security/SecurityView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
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
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !getStoredToken()) {
    return { path: '/auth' }
  }

  return true
})

export default router
