import { createRouter, createWebHistory } from 'vue-router';

import { getStoredToken } from './lib/auth-session';
import AuthView from './views/auth/AuthView.vue';
import HomeView from './views/home/HomeView.vue';
import MainLayout from './layouts/MainLayout.vue';
import ProfileView from './views/profile/ProfileView.vue';

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
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !getStoredToken()) {
    return { path: '/auth' };
  }

  return true;
});

export default router;
