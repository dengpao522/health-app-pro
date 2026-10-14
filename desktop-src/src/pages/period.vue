<template>
  <view class="page">
    <view class="top-bar">
      <view class="nav-row">
        <text class="back" @click="goBack">‹</text>
        <text class="page-title">生理期</text>
      </view>
      <text class="page-sub">记录经期，掌握自己的周期规律</text>
    </view>

    <!-- 周期状态卡：经期中 / 倒计时 -->
    <view class="status-card">
      <block v-if="info && info.latest">
        <block v-if="info.in_period">
          <text class="st-emoji">🌸</text>
          <text class="st-main">经期第 {{ periodDayNo }} 天</text>
          <text class="st-sub">注意保暖、避免剧烈运动，多喝温水</text>
        </block>
        <block v-else>
          <text class="st-emoji">🗓️</text>
          <text class="st-main" v-if="info.days_until > 0">距下次经期约 {{ info.days_until }} 天</text>
          <text class="st-main" v-else>经期临近或已推迟 {{ Math.abs(info.days_until) }} 天</text>
          <text class="st-sub">预计 {{ (info.next_start || '').slice(5).replace('-', ' 月 ') }} 日到来（平均周期 {{ info.avg_cycle }} 天）</text>
        </block>
        <view class="st-meta">
          <text>本周期第 {{ info.cycle_day }} 天</text>
          <text class="st-divider">·</text>
          <text>已记录 {{ info.records.length }} 次经期</text>
        </view>
      </block>
      <block v-else>
        <text class="st-emoji">🌸</text>
        <text class="st-main">还没有记录</text>
        <text class="st-sub">记录最近一次经期，开始预测周期</text>
      </block>
    </view>

    <!-- 记录一次经期 -->
    <view class="card">
      <view class="card-title">📝 记录经期</view>
      <view class="date-row">
        <view class="date-field">
          <text class="df-lbl">开始日期</text>
          <input type="date" v-model="form.start" class="df-inp" />
        </view>
        <view class="date-field">
          <text class="df-lbl">结束日期</text>
          <input type="date" v-model="form.end" class="df-inp" />
        </view>
      </view>
      <button class="save-btn" @click="save">保存记录</button>
      <text class="form-tip">周期 = 两次经期开始日的间隔；同一天重复保存会覆盖旧记录</text>
    </view>

    <!-- 历史记录 -->
    <view class="card" v-if="info && info.records.length">
      <view class="card-title">📋 历史经期</view>
      <view class="rec-row" v-for="r in info.records" :key="r.id">
        <view class="rr-info">
          <text class="rr-date">{{ r.start.slice(5).replace('-', '/') }} - {{ r.end.slice(5).replace('-', '/') }}</text>
          <text class="rr-days">共 {{ r.days }} 天</text>
        </view>
        <view class="rr-del" @click="del(r)">✕</view>
      </view>
    </view>

    <!-- 免责：健康记录工具，非医学诊断（上架审核友好） -->
    <view class="dis-card">
      <text class="dis-text">周期预测基于历史记录的平均间隔估算，仅供参考，不构成医疗建议；月经紊乱、痛经加剧等异常情况请及时就医。</text>
    </view>

    <view style="height: 60rpx;"></view>
  </view>
</template>

<script>
import { request } from '../js/request.js';

export default {
  data() {
    return {
      info: null,
      // 默认：开始=今天，结束=今天+4（典型 5 天经期）
      form: { start: '', end: '' },
    };
  },
  computed: {
    // 经期第几天：今天 - 开始日 + 1（in_period 时展示）
    periodDayNo() {
      if (!this.info || !this.info.latest) return 1;
      const diff = Math.round((new Date(this.todayStr()) - new Date(this.info.latest.start)) / 86400000) + 1;
      return Math.max(1, diff);
    },
  },
  onShow() {
    const today = this.todayStr();
    const plus4 = new Date();
    plus4.setDate(plus4.getDate() + 4);
    // 默认结束日兜底：开始日 +4 天（跨月由 Date 自动进位）
    this.form.start = this.form.start || today;
    this.form.end = this.form.end || this.fmt(plus4);
    this.load();
  },
  methods: {
    fmt(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    todayStr() { return this.fmt(new Date()); },
    async load() {
      try {
        this.info = await request({ url: '/api/period' });
      } catch (e) {}
    },
    async save() {
      try {
        await request({ url: '/api/period', method: 'POST', data: { start: this.form.start, end: this.form.end } });
        uni.showToast({ title: '已记录', icon: 'success' });
        this.load();
      } catch (e) {
        // 校验类错误（日期非法/超14天）mock 已带 detail 提示
      }
    },
    del(r) {
      uni.showModal({
        title: '删除记录', content: `删除 ${r.start} 这次的经期记录？`,
        success: (res) => {
          if (res.confirm) {
            request({ url: `/api/period/${r.id}`, method: 'DELETE' }).then(() => this.load());
          }
        },
      });
    },
    goBack() { uni.navigateBack(); },
  },
};
</script>

<style>
/* 本页全部走主题变量：浅色/深色自动适配；粉玫瑰色系贴合生理期主题 */
.page { min-height: 100vh; background: var(--bg-page); padding-bottom: 40rpx; }
.top-bar { padding: 100rpx 32rpx 30rpx; background: linear-gradient(150deg, #FB7185, #F43F5E); color: #fff; border-radius: 0 0 44rpx 44rpx; }
.nav-row { display: flex; align-items: center; }
.back { font-size: 60rpx; line-height: 1; margin-right: 20rpx; cursor: pointer; padding: 0 10rpx; }
.page-title { font-size: 44rpx; font-weight: 800; }
.page-sub { display: block; font-size: 24rpx; opacity: 0.9; margin-top: 8rpx; }

/* 周期状态大卡 */
.status-card { margin: -30rpx 24rpx 0; background: var(--bg-card); border-radius: 32rpx; padding: 44rpx 32rpx 36rpx; text-align: center; box-shadow: 0 12rpx 40rpx rgba(244,63,94,0.12); position: relative; }
.st-emoji { display: block; font-size: 72rpx; margin-bottom: 14rpx; }
.st-main { display: block; font-size: 40rpx; font-weight: 800; color: var(--text-1); }
.st-sub { display: block; font-size: 24rpx; color: var(--text-3); margin-top: 12rpx; line-height: 1.6; }
.st-meta { display: flex; justify-content: center; gap: 14rpx; margin-top: 20rpx; font-size: 22rpx; color: var(--text-4); }
.st-divider { color: var(--text-4); }

.card { background: var(--bg-card); border-radius: 24rpx; padding: 30rpx 28rpx; margin: 20rpx 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04); }
.card-title { font-size: 30rpx; font-weight: 800; color: var(--text-1); margin-bottom: 22rpx; }

/* 日期双栏 */
.date-row { display: flex; gap: 16rpx; }
.date-field { flex: 1; background: var(--bg-input); border-radius: 16rpx; padding: 14rpx 18rpx; }
.df-lbl { display: block; font-size: 20rpx; color: var(--text-3); margin-bottom: 6rpx; }
.df-inp { font-size: 28rpx; font-weight: 700; color: #F43F5E; width: 100%; background: transparent; border: none; padding: 0; }
.save-btn { margin-top: 24rpx; background: linear-gradient(135deg, #FB7185, #F43F5E); color: #fff; border: none; border-radius: 40rpx; height: 88rpx; line-height: 88rpx; font-size: 30rpx; font-weight: 700; width: 100%; box-shadow: 0 8rpx 24rpx rgba(244,63,94,0.25); }
.save-btn:active { transform: scale(0.98); }
.form-tip { display: block; font-size: 20rpx; color: var(--text-4); margin-top: 14rpx; text-align: center; }

/* 历史记录行 */
.rec-row { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid var(--line); }
.rec-row:last-child { border-bottom: none; }
.rr-info { flex: 1; }
.rr-date { display: block; font-size: 27rpx; font-weight: 700; color: var(--text-1); }
.rr-days { display: block; font-size: 21rpx; color: var(--text-3); margin-top: 4rpx; }
.rr-del { font-size: 22rpx; color: var(--text-4); background: var(--bg-input); width: 44rpx; height: 44rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.rr-del:active { background: rgba(255,77,79,0.14); color: #FF4D4F; }

/* 免责声明 */
.dis-card { margin: 24rpx 24rpx 0; }
.dis-text { font-size: 20rpx; color: var(--text-4); line-height: 1.7; }
</style>
