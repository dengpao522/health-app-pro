<template>
  <div class="app-shell">
    <router-view />
    <!-- TabBar：拍照项做中央凸起圆钮（Keep/薄荷同款交互） -->
    <nav v-if="showTab" class="tabbar">
      <div v-for="t in tabs" :key="t.path"
           class="tab-item" :class="{active: currentTab===t.path, camera: t.camera}"
           @click="$router.push(t.path)">
        <span v-if="t.camera" class="camera-btn">📷</span>
        <span v-else class="tab-icon">{{ t.icon }}</span>
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
        { path: '/scan', icon: '📷', text: '拍照', camera: true },
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
  background-color: #F4F5F7;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.app-shell { min-height: 100vh; padding-bottom: 120rpx; }

.tabbar {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: flex; background: #fff;
  box-shadow: 0 -4rpx 24rpx rgba(0,0,0,0.06);
  z-index: 100; max-width: 420px; margin: 0 auto;
  border-radius: 28rpx 28rpx 0 0;
}
.tab-item {
  flex: 1; text-align: center; padding: 12rpx 0 14rpx;
  display: flex; flex-direction: column; align-items: center; gap: 2rpx;
  cursor: pointer;
}
.tab-icon { font-size: 40rpx; }
.tab-text { font-size: 20rpx; color: #9CA3AF; }
.tab-item.active .tab-text { color: #FF6B35; font-weight: 700; }
.tab-item.active .tab-icon { transform: scale(1.12); transition: transform .2s; }

/* 中央凸起拍照钮：圆形渐变，上浮出 tabbar 边界 */
.tab-item.camera { position: relative; }
.camera-btn {
  width: 92rpx; height: 92rpx; border-radius: 50%;
  background: linear-gradient(135deg, #FF7A45, #FF5E3A);
  display: flex; align-items: center; justify-content: center;
  font-size: 42rpx;
  margin-top: -52rpx;
  border: 6rpx solid #fff;
  box-shadow: 0 8rpx 20rpx rgba(255,94,58,0.4);
  transition: transform .2s;
}
.tab-item.camera.active .camera-btn { transform: scale(1.06); }
.tab-item.camera .tab-text { color: #FF6B35; font-weight: 600; }
</style>
