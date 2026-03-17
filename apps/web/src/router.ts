import { createRouter, createWebHistory } from 'vue-router'

import MainLayout from './layouts/MainLayout.vue'
import { getStoredToken } from './lib/auth-session'
import AuthView from './views/auth/AuthView.vue'
import HomeView from './views/home/HomeView.vue'
import ProfileView from './views/profile/ProfileView.vue'

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
          path: 'profile',
          name: 'profile',
          component: ProfileView,
          meta: {
            requiresAuth: true,
          },
        },
        {
          path: 'profile/security',
          name: 'profile-security',
          component: ProfileView,
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
  const tabQuery = Array.isArray(to.query.tab) ? to.query.tab[0] : to.query.tab

  if (to.path === '/profile' && tabQuery === 'security') {
    const { tab: _tab, ...restQuery } = to.query

    return {
      path: '/profile/security',
      query: restQuery,
      hash: to.hash,
    }
  }

  if (to.meta.requiresAuth && !getStoredToken()) {
    return { path: '/auth' }
  }

  return true
})

export default router
