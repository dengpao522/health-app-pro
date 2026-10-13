import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { View, Text, Image, Button, Input, Picker, Canvas, Block, ScrollView } from './uni/components.js'
import { uni } from './uni/polyfill.js'
import App from './App.vue'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: () => import('./pages/login.vue') },
  { path: '/register', component: () => import('./pages/register.vue') },
  { path: '/home', component: () => import('./pages/home.vue') },
  { path: '/community', component: () => import('./pages/community.vue') },
  { path: '/scan', component: () => import('./pages/scan.vue') },
  { path: '/trend', component: () => import('./pages/trend.vue') },
  { path: '/recipes', component: () => import('./pages/recipes.vue') },
  { path: '/fasting', component: () => import('./pages/fasting.vue') },
  { path: '/food-detail', component: () => import('./pages/food-detail.vue') },
  { path: '/profile', component: () => import('./pages/profile.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// 路由守卫：未登录只能访问 login/register
router.beforeEach((to, from, next) => {
  const loggedIn = uni.getStorageSync('userInfo') && uni.getStorageSync('userInfo').access_token
  if (!loggedIn && !['/login', '/register'].includes(to.path)) {
    next('/login')
  } else if (loggedIn && ['/login', '/register', '/'].includes(to.path)) {
    next('/home')
  } else {
    next()
  }
})

uni.setRouter(router)

const app = createApp(App)
app.use(router)

// 注册 uni 组件
app.component('view', View)
app.component('text', Text)
app.component('image', Image)
app.component('button', Button)
app.component('input', Input)
app.component('picker', Picker)
app.component('canvas', Canvas)
app.component('block', Block)
app.component('scroll-view', ScrollView)

// 全局 uni 对象
app.config.globalProperties.uni = uni

// 映射 uni 生命周期到 Vue 生命周期
// onLoad: 组件首次挂载时调用（只一次）
// onShow: 组件挂载时 + 路由切回该页时都调用（模拟 uni-app tab 切换）
app.mixin({
  mounted() {
    const onLoad = this.$options.onLoad
    if (typeof onLoad === 'function') {
      try { onLoad.call(this) } catch (e) { console.error(e) }
    }
    const onShow = this.$options.onShow
    if (typeof onShow === 'function') {
      try { onShow.call(this) } catch (e) { console.error(e) }
    }
  },
  // 路由复用同组件时（如从 scan 切回 home）触发 onShow
  beforeRouteEnter(to, from, next) {
    next(vm => {
      const onShow = vm.$options.onShow
      if (typeof onShow === 'function') {
        try { onShow.call(vm) } catch (e) { console.error(e) }
      }
    })
  },
  beforeRouteUpdate(to, from, next) {
    const onShow = this.$options.onShow
    if (typeof onShow === 'function') {
      try { onShow.call(this) } catch (e) { console.error(e) }
    }
    next()
  }
})

app.mount('#app')
