<template>
  <view class="page">
    <view class="hero">
      <view class="logo">🥗</view>
      <text class="title">健康饮食助手</text>
      <text class="subtitle">拍照识别 · 智能营养 · 科学塑形</text>
    </view>
    <view class="form">
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
    </view>
    <view class="tip">演示账号 demo / 123456，也可自行注册（数据仅保存在本机）</view>
  </view>
</template>

<script>
import { request } from '../js/request.js';
export default {
  data() {
    return { form: { username: '', password: '' } };
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
    toRegister(e) {
      if (e && e.preventDefault) e.preventDefault();
      uni.navigateTo({ url: '/pages/register/register' });
    }
  }
}
</script>

<style>
.page { min-height: 100vh; background: linear-gradient(160deg, #FF6B35 0%, #FF8F5E 60%, #FFB088 100%); padding: 0 48rpx; display: flex; flex-direction: column; }
.hero { padding-top: 180rpx; text-align: center; color: #fff; }
.logo { font-size: 120rpx; }
.title { display:block; font-size: 56rpx; font-weight: 800; margin-top: 20rpx; }
.subtitle { display:block; font-size: 26rpx; opacity: 0.9; margin-top: 16rpx; }
.form { margin-top: 100rpx; }
.input-box { background: #fff; border-radius: 20rpx; padding: 0 28rpx; height: 100rpx; display: flex; align-items: center; margin-bottom: 28rpx; box-shadow: 0 6rpx 20rpx rgba(0,0,0,0.08); }
.icon { font-size: 36rpx; margin-right: 20rpx; }
.input-box input { flex: 1; font-size: 30rpx; }
.btn { background: #fff; color: #FF6B35; border: none; border-radius: 20rpx; height: 96rpx; line-height: 96rpx; font-size: 34rpx; font-weight: 700; margin-top: 20rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.12); }
.link-row { text-align: center; margin-top: 40rpx; color: #fff; font-size: 26rpx; }
.link { color: #fff; font-size: 26rpx; text-decoration: underline; cursor: pointer; -webkit-tap-highlight-color: rgba(255,255,255,0.3); }
.tip { position: absolute; bottom: 40rpx; left: 0; right: 0; text-align: center; color: rgba(255,255,255,0.7); font-size: 22rpx; }
</style>

