<template>
  <div class="app-shell" :data-theme="theme">
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
// 主题三态：light 浅色 / dark 深色 / auto 跟随系统（存 localStorage 全局生效）
const THEME_KEY = 'health_pro_theme';

function resolveTheme() {
  const pref = localStorage.getItem(THEME_KEY) || 'light';
  if (pref === 'auto') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref === 'dark' ? 'dark' : 'light';
}

export default {
  data() {
    return {
      theme: 'light',
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
  },
  mounted() {
    this.applyTheme();
    // 系统深色模式切换时实时响应（仅 auto 模式有意义）
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        this.theme = resolveTheme();
      });
    }
    // 全局提供主题切换入口：任意页面调 window.__setTheme('dark'|'light'|'auto')
    window.__setTheme = (pref) => {
      localStorage.setItem(THEME_KEY, pref);
      this.theme = resolveTheme();
    };
    window.__getThemePref = () => localStorage.getItem(THEME_KEY) || 'light';
  },
  methods: {
    applyTheme() { this.theme = resolveTheme(); },
  }
}
</script>

<style>
@import './uni.css';
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app { height: 100%; overflow-y: auto; overflow-x: hidden; }

/* ============ 主题变量系统：浅色默认，dark 覆盖 ============ */
/* 页面里所有颜色统一走变量，切换主题只换变量值 */
.app-shell {
  --bg-page: #F4F5F7;        /* 页面底色 */
  --bg-card: #ffffff;        /* 卡片底色 */
  --bg-input: #F7F8FA;       /* 输入框/浅底块 */
  --bg-soft: #FAFBFC;        /* 更浅的嵌套块 */
  --text-1: #1a1a1a;         /* 主文字 */
  --text-2: #555555;         /* 次级文字 */
  --text-3: #999999;         /* 弱文字 */
  --text-4: #c9c9c9;         /* 极弱/占位 */
  --line: #F4F5F7;           /* 分隔线 */
  --accent: #FF6B35;         /* 品牌主色（两主题通用） */
  --tabbar-bg: #ffffff;
  background-color: var(--bg-page);
  color: var(--text-1);
  min-height: 100vh;
  padding-bottom: 120rpx;
  transition: background-color .3s;
}
.app-shell[data-theme="dark"] {
  --bg-page: #121417;
  --bg-card: #1E2126;
  --bg-input: #262A30;
  --bg-soft: #262A30;
  --text-1: #F2F3F5;
  --text-2: #B8BCC2;
  --text-3: #7A7F87;
  --text-4: #4E5259;
  --line: #2A2E34;
  --tabbar-bg: #1E2126;
}

body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; }

.tabbar {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: flex; background: var(--tabbar-bg);
  box-shadow: 0 -4rpx 24rpx rgba(0,0,0,0.08);
  z-index: 100; max-width: 420px; margin: 0 auto;
  border-radius: 28rpx 28rpx 0 0;
}
.tab-item {
  flex: 1; text-align: center; padding: 12rpx 0 14rpx;
  display: flex; flex-direction: column; align-items: center; gap: 2rpx;
  cursor: pointer;
}
.tab-icon { font-size: 40rpx; }
.tab-text { font-size: 20rpx; color: var(--text-3); }
.tab-item.active .tab-text { color: var(--accent); font-weight: 700; }
.tab-item.active .tab-icon { transform: scale(1.12); transition: transform .2s; }

/* 中央凸起拍照钮：圆形渐变，上浮出 tabbar 边界 */
.tab-item.camera { position: relative; }
.camera-btn {
  width: 92rpx; height: 92rpx; border-radius: 50%;
  background: linear-gradient(135deg, #FF7A45, #FF5E3A);
  display: flex; align-items: center; justify-content: center;
  font-size: 42rpx;
  margin-top: -52rpx;
  border: 6rpx solid var(--tabbar-bg);
  box-shadow: 0 8rpx 20rpx rgba(255,94,58,0.4);
  transition: transform .2s;
}
.tab-item.camera.active .camera-btn { transform: scale(1.06); }
.tab-item.camera .tab-text { color: var(--accent); font-weight: 600; }
</style>
