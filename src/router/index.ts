// Composables
import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/views/Login.vue'
import Data from '@/store/modules/data'
import api from '@/plugins/api'

const routes = [
  {
    path: '/login',
    name: 'pages.login',
    component: Login,
  },
  {
    path: '/',
    component: () => import('@/layouts/default/Default.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '/',
        name: 'pages.home',
        component: () => import('@/views/Home.vue'),
      },
      {
        path: '/inbounds',
        name: 'pages.inbounds',
        component: () => import('@/views/Inbounds.vue'),
      },
      {
        path: '/clients',
        name: 'pages.clients',
        component: () => import('@/views/Clients.vue'),
      },  
      {
        path: '/outbounds',
        name: 'pages.outbounds',
        component: () => import('@/views/Outbounds.vue'),
      },
      {
        path: '/services',
        name: 'pages.services',
        component: () => import('@/views/Services.vue'),
      },
      {
        path: '/endpoints',
        name: 'pages.endpoints',
        component: () => import('@/views/Endpoints.vue'),
      },
      {
		path: '/config',
		name: 'pages.config',
		component: () => import('@/views/CoreConfig.vue'),
      },
      {
        path: '/tls',
        name: 'pages.tls',
        component: () => import('@/views/Tls.vue'),
      },
      {
		path: '/analytics',
		name: 'pages.analytics',
		component: () => import('@/views/Analytics.vue'),
      },
      {
		path: '/logs',
		redirect: '/analytics',
      },
      {
        path: '/admins',
        name: 'pages.admins',
        component: () => import('@/views/Admins.vue'),
      },
      {
        path: '/settings',
        name: 'pages.settings',
		component: () => import('@/views/SettingsTools.vue'),
      },
	  { path: '/basics', redirect: '/config' },
	  { path: '/dns', redirect: '/config' },
	  { path: '/rules', redirect: '/config' },
    ],
  },
]

const router = createRouter({
  history: createWebHistory((window as any).BASE_URL),
  routes,
})

let intervalId:any

// Navigation guard to check authentication state
const checkAuthenticated = async () => {
  try {
    const response = await api.get('api/auth-check')
    return response.data?.success === true && response.data?.obj?.authenticated === true
  } catch {
    return false
  }
}

router.beforeEach(async (to) => {
  const requiresAuth = to.matched.some(route => route.meta.requiresAuth)
  const isAuthenticated = await checkAuthenticated()

  // If the route requires authentication and the user is not authenticated, redirect to /login
  if (requiresAuth && !isAuthenticated) {
    return '/login'
  }
  if (to.path === '/login' && isAuthenticated) {
    // If already authenticated and visiting /login, redirect to '/'
    return '/'
  }

  // Load default data
  if (to.path !== '/login') {
    loadDataInterval()
  } else {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = undefined
    }
  }
})

const loadDataInterval = () => {
  if (intervalId) return
  Data().loadData()
  intervalId = setInterval(() => {
    Data().loadData()
  }, 10000)
}

export default router
