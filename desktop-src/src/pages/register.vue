<template>
  <view class="page">
    <view class="hero">
      <text class="title">创建账号</text>
      <text class="subtitle">开启你的健康管理之旅</text>
    </view>
    <view class="form">
      <view class="input-box"><text class="icon">👤</text><input v-model="form.username" placeholder="用户名" placeholder-style="color:#bbb" /></view>
      <view class="input-box"><text class="icon">📧</text><input v-model="form.email" placeholder="邮箱（选填）" placeholder-style="color:#bbb" /></view>
      <view class="input-box"><text class="icon">🔒</text><input v-model="form.password" password placeholder="密码" placeholder-style="color:#bbb" /></view>
      <button class="btn" @click="register">注 册</button>
      <view class="link-row"><a class="link" href="#/login" @click="toLogin">已有账号？去登录</a></view>
    </view>
  </view>
</template>

<script>
import { request } from '../js/request.js';
export default {
  data() { return { form: { username: '', email: '', password: '' } }; },
  methods: {
    async register() {
      if (!this.form.username || !this.form.password) {
        uni.showToast({ title: '请填写用户名和密码', icon: 'none' });
        return;
      }
      if (this.form.username.length < 2) {
        uni.showToast({ title: '用户名至少 2 个字符', icon: 'none' });
        return;
      }
      if (this.form.password.length < 6) {
        uni.showToast({ title: '密码至少 6 位', icon: 'none' });
        return;
      }
      uni.showLoading({ title: '注册中...' });
      try {
        await request({ url: '/users/', method: 'POST', data: this.form });
        uni.showToast({ title: '注册成功，请登录', icon: 'success' });
        // 用 reLaunch 而不是 navigateBack，兼容直接打开注册页（无历史记录）的情况
        setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 800);
      } catch (e) {
        uni.showToast({ title: (e && e.detail) || '注册失败，请重试', icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    },
    toLogin(e) {
      if (e && e.preventDefault) e.preventDefault();
      uni.reLaunch({ url: '/pages/login/login' });
    }
  }
}
</script>

<style>
.page { min-height: 100vh; background: linear-gradient(160deg, #FF6B35 0%, #FF8F5E 100%); padding: 0 48rpx; }
.hero { padding-top: 160rpx; color: #fff; }
.title { display:block; font-size: 52rpx; font-weight: 800; }
.subtitle { display:block; font-size: 26rpx; opacity: 0.9; margin-top: 12rpx; }
.form { margin-top: 80rpx; }
.input-box { background: #fff; border-radius: 20rpx; padding: 0 28rpx; height: 100rpx; display: flex; align-items: center; margin-bottom: 28rpx; }
.icon { font-size: 36rpx; margin-right: 20rpx; }
.input-box input { flex: 1; font-size: 30rpx; }
.btn { background: #fff; color: #FF6B35; border: none; border-radius: 20rpx; height: 96rpx; line-height: 96rpx; font-size: 34rpx; font-weight: 700; margin-top: 20rpx; }
.link-row { text-align: center; margin-top: 40rpx; color: #fff; font-size: 26rpx; }
.link { color: #fff; font-size: 26rpx; text-decoration: underline; cursor: pointer; -webkit-tap-highlight-color: rgba(255,255,255,0.3); }
</style>

