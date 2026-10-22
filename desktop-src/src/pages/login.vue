<template>
  <view class="page">
    <!-- 顶部品牌区：渐变背景 + 装饰圆 -->
    <view class="hero">
      <view class="deco d1"></view>
      <view class="deco d2"></view>
      <view class="logo-ring"><text class="logo">🥗</text></view>
      <text class="title">健康饮食助手</text>
      <text class="subtitle">拍照识别 · 智能营养 · 科学塑形</text>
    </view>
    <!-- 表单浮层卡：上移压住渐变，制造层次 -->
    <view class="form-card">
      <view class="input-box">
        <text class="icon">👤</text>
        <input v-model="form.username" placeholder="用户名" placeholder-style="color:#bbb" />
      </view>
      <view class="input-box">
        <text class="icon">🔒</text>
        <input v-model="form.password" password placeholder="密码" placeholder-style="color:#bbb" />
      </view>
      <button class="btn" @click="login">登 录</button>
      <view class="link-row">
        <a class="link" href="#/register" @click="toRegister">还没账号？立即注册</a>
      </view>
      <!-- 一键体验：生成随机凭据的演示账号（凭据不硬编码进代码，历史 demo/123456 已废弃） -->
      <button class="guest-btn" :disabled="guestLoading" @click="guestLogin">
        {{ guestLoading ? '准备演示数据中...' : '🚀 一键体验（免注册）' }}
      </button>
    </view>
    <text class="tip">数据仅保存在本机 · 可在「我的」页导出备份</text>
  </view>
</template>

<script>
import { request } from '../js/request.js';
export default {
  data() {
    return { form: { username: '', password: '' }, guestLoading: false };
  },
  onLoad() {
    // 已登录直接进首页
    if (uni.getStorageSync('userInfo') && uni.getStorageSync('userInfo').access_token) {
      uni.switchTab({ url: '/pages/home/home' });
    }
  },
  methods: {
    async login() {
      if (!this.form.username || !this.form.password) {
        uni.showToast({ title: '请填写用户名和密码', icon: 'none' });
        return;
      }
      uni.showLoading({ title: '登录中...' });
      try {
        const res = await request({ url: '/login/', method: 'POST', data: this.form });
        uni.setStorageSync('userInfo', res);
        uni.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => uni.switchTab({ url: '/pages/home/home' }), 600);
      } catch (e) {
        uni.showToast({ title: (e && e.detail) || '登录失败，请重试', icon: 'none' });
      } finally {
        // 无论成功失败必须关闭 loading，否则遮罩会锁死整个页面
        uni.hideLoading();
      }
    },
    // 一键体验：服务端生成随机凭据的演示账号（含 7 天演示数据），前端只拿登录态
    async guestLogin() {
      if (this.guestLoading) return;
      this.guestLoading = true;
      try {
        const res = await request({ url: '/api/demo-account', method: 'POST', data: {} });
        uni.setStorageSync('userInfo', res);
        uni.showToast({ title: '欢迎体验！', icon: 'success' });
        setTimeout(() => uni.switchTab({ url: '/pages/home/home' }), 600);
      } catch (e) {
        uni.showToast({ title: '体验入口异常，请重试', icon: 'none' });
      } finally {
        this.guestLoading = false;
      }
    },
    toRegister(e) {
      if (e && e.preventDefault) e.preventDefault();
      uni.navigateTo({ url: '/pages/register/register' });
    }
  }
}
</script>

<style>
.page { min-height: 100vh; background: #F4F5F7; display: flex; flex-direction: column; }
/* 品牌区：更饱和的双色渐变 + 半透明装饰圆制造层次 */
.hero { position: relative; padding: 160rpx 0 140rpx; text-align: center; color: #fff; background: linear-gradient(150deg, #FF7A45 0%, #FF6B35 45%, #FF5E3A 100%); border-radius: 0 0 60rpx 60rpx; overflow: hidden; }
.deco { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.12); }
.d1 { width: 320rpx; height: 320rpx; top: -100rpx; right: -80rpx; }
.d2 { width: 200rpx; height: 200rpx; bottom: -60rpx; left: -50rpx; background: rgba(255,255,255,0.08); }
/* 图标外圈：白色半透明圆环，品牌感 */
.logo-ring { width: 160rpx; height: 160rpx; margin: 0 auto; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; border: 4rpx solid rgba(255,255,255,0.4); position: relative; }
.logo { font-size: 90rpx; line-height: 1; }
.title { display:block; font-size: 52rpx; font-weight: 800; margin-top: 24rpx; letter-spacing: 2rpx; position: relative; }
.subtitle { display:block; font-size: 25rpx; opacity: 0.9; margin-top: 14rpx; position: relative; }
/* 表单卡：白卡上浮，投影 + 负边距压住渐变 */
.form-card { margin: -70rpx 48rpx 0; background: #fff; border-radius: 32rpx; padding: 44rpx 36rpx; box-shadow: 0 16rpx 48rpx rgba(0,0,0,0.08); position: relative; }
.input-box { background: #F7F8FA; border-radius: 20rpx; padding: 0 28rpx; height: 100rpx; display: flex; align-items: center; margin-bottom: 26rpx; }
.input-box input { flex: 1; font-size: 30rpx; }
.icon { font-size: 36rpx; margin-right: 20rpx; }
.btn { background: linear-gradient(135deg, #FF7A45, #FF5E3A); color: #fff; border: none; border-radius: 24rpx; height: 96rpx; line-height: 96rpx; font-size: 34rpx; font-weight: 700; margin-top: 12rpx; box-shadow: 0 10rpx 26rpx rgba(255,94,58,0.35); }
/* 一键体验：描边幽灵按钮，弱于主按钮的视觉层级 */
.guest-btn { background: transparent; color: #FF6B35; border: 2rpx solid #FFB088; border-radius: 24rpx; height: 84rpx; line-height: 80rpx; font-size: 28rpx; font-weight: 600; margin-top: 20rpx; }
.guest-btn[disabled] { opacity: 0.6; color: #FF6B35; background: transparent; }
.btn:active { transform: scale(0.98); }
.link-row { text-align: center; margin-top: 34rpx; color: #999; font-size: 26rpx; }
.link { color: #FF6B35; font-size: 26rpx; font-weight: 600; text-decoration: underline; cursor: pointer; }
.tip { text-align: center; color: #b9b9b9; font-size: 22rpx; margin-top: auto; padding: 40rpx 0; }
</style>

