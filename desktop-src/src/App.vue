<template>
  <div class="app-shell">
    <router-view />
    <!-- TabBar -->
    <nav v-if="showTab" class="tabbar">
      <div v-for="t in tabs" :key="t.path" class="tab-item" :class="{active: currentTab===t.path}" @click="$router.push(t.path)">
        <span class="tab-icon">{{ t.icon }}</span>
        <span class="tab-text">{{ t.text }}</span>
      </div>
    </nav>
  </div>
</template>

<script>
export default {
  data() {
    return {
      tabs: [
        { path: '/home', icon: '🏠', text: '今日' },
        { path: '/scan', icon: '📷', text: '拍照' },
        { path: '/trend', icon: '📊', text: '趋势' },
        { path: '/profile', icon: '👤', text: '我的' },
      ],
    }
  },
  computed: {
    currentTab() { return this.$route.path },
    showTab() {
      return ['/home', '/scan', '/trend', '/profile'].includes(this.$route.path)
    }
  }
}
</script>

<style>
@import './uni.css';
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app { height: 100%; overflow-y: auto; overflow-x: hidden; }
body {
  background-color: #F5F6FA;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.app-shell { min-height: 100vh; padding-bottom: 120rpx; }

.tabbar {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: flex; background: #fff; border-top: 1rpx solid #eee;
  z-index: 100; max-width: 420px; margin: 0 auto;
}
.tab-item {
  flex: 1; text-align: center; padding: 12rpx 0 16rpx;
  display: flex; flex-direction: column; align-items: center;
}
.tab-icon { font-size: 40rpx; }
.tab-text { font-size: 20rpx; color: #999; margin-top: 4rpx; }
.tab-item.active .tab-text { color: #FF6B35; font-weight: 600; }
.tab-item.active .tab-icon { filter: hue-rotate(0deg) saturate(2); }
</style>
