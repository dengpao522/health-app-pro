<template>
  <view class="page">
    <view class="top-bar">
      <view class="user-row">
        <view class="avatar">{{ avatarText }}</view>
        <view class="u-info">
          <text class="u-name">{{ user.nickname || user.username }}</text>
          <text class="u-meta">{{ user.gender === 'female' ? '女' : '男' }} · {{ user.age }}岁 · {{ user.height }}cm · {{ user.weight }}kg</text>
        </view>
      </view>
    </view>

    <!-- 每日目标卡片 -->
    <view class="card target-card">
      <view class="card-title">🎯 每日目标</view>
      <view class="target-grid">
        <view class="t-item"><text class="t-val">{{ user.target_calories }}</text><text class="t-lbl">热量 kcal</text></view>
        <view class="t-item"><text class="t-val">{{ user.target_protein }}</text><text class="t-lbl">蛋白 g</text></view>
        <view class="t-item"><text class="t-val">{{ user.target_fat }}</text><text class="t-lbl">脂肪 g</text></view>
        <view class="t-item"><text class="t-val">{{ user.target_carbs }}</text><text class="t-lbl">碳水 g</text></view>
      </view>
    </view>

    <!-- 身体数据编辑 -->
    <view class="card">
      <view class="card-title">⚙️ 身体数据</view>
      <view class="form-row">
        <text class="lbl">身高 (cm)</text>
        <input type="digit" v-model="form.height" class="inp" />
      </view>
      <view class="form-row">
        <text class="lbl">体重 (kg)</text>
        <input type="digit" v-model="form.weight" class="inp" />
      </view>
      <view class="form-row">
        <text class="lbl">年龄</text>
        <input type="number" v-model="form.age" class="inp" />
      </view>
      <view class="form-row">
        <text class="lbl">性别</text>
        <view class="seg">
          <text :class="['seg-item', form.gender==='male'?'active':'']" @click="form.gender='male'">男</text>
          <text :class="['seg-item', form.gender==='female'?'active':'']" @click="form.gender='female'">女</text>
        </view>
      </view>
      <view class="form-row">
        <text class="lbl">活动量</text>
        <picker :range="activityLabels" :value="activityIdx" @change="onActivity">
          <view class="picker">{{ activityLabels[activityIdx] }} ›</view>
        </picker>
      </view>
      <view class="form-row">
        <text class="lbl">目标</text>
        <picker :range="goalLabels" :value="goalIdx" @change="onGoal">
          <view class="picker">{{ goalLabels[goalIdx] }} ›</view>
        </picker>
      </view>
      <button class="save-btn" @click="saveProfile">保存并重算目标</button>
    </view>

    <!-- 记录体重 -->
    <view class="card">
      <view class="card-title">⚖️ 记录今日体重</view>
      <view class="weight-row">
        <input type="digit" v-model="weightInput" class="w-inp" placeholder="输入体重 kg" />
        <button class="w-btn" @click="recordWeight">记录</button>
      </view>
    </view>

    <button class="logout-btn" @click="logout">退出登录</button>
    <!-- 注销账号：跳转邮件客户端提交注销申请（应用商店审核要求的账号注销入口） -->
    <button class="logout-btn delete-btn" @click="deleteAccount">注销账号</button>
    <view style="height: 60rpx;"></view>
  </view>
</template>

<script>
import { request } from '../js/request.js';
const ACTIVITIES = [
  { key: 'sedentary', label: '久坐（几乎不运动）' },
  { key: 'light', label: '轻度（每周1-3次）' },
  { key: 'moderate', label: '中度（每周3-5次）' },
  { key: 'active', label: '重度（每周6-7次）' },
];
const GOALS = [
  { key: 'lose', label: '减脂' },
  { key: 'maintain', label: '维持' },
  { key: 'gain', label: '增肌' },
];
export default {
  data() {
    return {
      user: {},
      form: { height: 175, weight: 70, age: 25, gender: 'male', activity_level: 'light', goal: 'maintain' },
      activityIdx: 1,
      goalIdx: 1,
      weightInput: '',
    };
  },
  computed: {
    avatarText() { return ((this.user.nickname || this.user.username || 'U').charAt(0) || 'U').toUpperCase(); },
    activityLabels() { return ACTIVITIES.map(a => a.label); },
    goalLabels() { return GOALS.map(g => g.label); },
  },
  onShow() {
    const u = uni.getStorageSync('userInfo')?.user || {};
    this.user = u;
    this.form = {
      height: u.height ?? 175,
      weight: u.weight ?? 70,
      age: u.age ?? 25,
      gender: u.gender ?? 'male',
      activity_level: u.activity_level ?? 'light',
      goal: u.goal ?? 'maintain',
    };
    const ai = ACTIVITIES.findIndex(a => a.key === u.activity_level);
    this.activityIdx = ai >= 0 ? ai : 1;
    const gi = GOALS.findIndex(g => g.key === u.goal);
    this.goalIdx = gi >= 0 ? gi : 1;
  },
  methods: {
    onActivity(e) { this.activityIdx = +e.detail.value; this.form.activity_level = ACTIVITIES[this.activityIdx].key; },
    onGoal(e) { this.goalIdx = +e.detail.value; this.form.goal = GOALS[this.goalIdx].key; },
    async saveProfile() {
      const h = +this.form.height, w = +this.form.weight, a = +this.form.age;
      if (!h || h < 80 || h > 250) { uni.showToast({ title: '身高请填 80~250cm', icon: 'none' }); return; }
      if (!w || w < 20 || w > 300) { uni.showToast({ title: '体重请填 20~300kg', icon: 'none' }); return; }
      if (!a || a < 5 || a > 120) { uni.showToast({ title: '年龄请填 5~120岁', icon: 'none' }); return; }
      uni.showLoading({ title: '保存中...' });
      try {
        const payload = {
          height: +this.form.height || 0,
          weight: +this.form.weight || 0,
          age: +this.form.age || 0,
          gender: this.form.gender,
          activity_level: this.form.activity_level,
          goal: this.form.goal,
        };
        const res = await request({ url: '/api/me', method: 'PUT', data: payload });
        const info = uni.getStorageSync('userInfo');
        info.user = res;
        uni.setStorageSync('userInfo', info);
        this.user = res;
        uni.hideLoading();
        uni.showToast({ title: '已保存，目标已重算', icon: 'success' });
      } catch (e) {
        uni.hideLoading();
        const msg = (e && e.data && e.data.detail) || (typeof e === 'string' ? e : '保存失败')
        uni.showToast({ title: msg, icon: 'none' });
      }
    },
    async recordWeight() {
      const w = parseFloat(this.weightInput);
      if (!w || w < 20 || w > 300) { uni.showToast({ title: '请输入有效体重', icon: 'none' }); return; }
      try {
        await request({ url: '/records/', method: 'POST', data: { weight: w, height: this.user.height, steps: 0, calories: 0, water: 0 } });
        this.user.weight = w;
        const info = uni.getStorageSync('userInfo'); info.user.weight = w; uni.setStorageSync('userInfo', info);
        this.weightInput = '';
        uni.showToast({ title: '已记录', icon: 'success' });
      } catch (e) {}
    },
    logout() {
      uni.showModal({ title: '退出登录', content: '确定退出当前账号？', success: (r) => {
        if (r.confirm) { uni.removeStorageSync('userInfo'); uni.reLaunch({ url: '/pages/login/login' }); }
      }});
    },
    // 注销账号：数据仅存本机，跳转邮件由用户确认后人工处理
    deleteAccount() {
      uni.showModal({
        title: '注销账号',
        content: '注销后您的账号及全部数据将被删除，且无法恢复。确认后将跳转邮件完成注销申请。',
        confirmText: '申请注销',
        success: (r) => {
          if (!r.confirm) return;
          const name = ((uni.getStorageSync('userInfo') || {}).user || {}).username || '未获取';
          location.href = 'mailto:3234199611@qq.com'
            + '?subject=' + encodeURIComponent('注销账号申请')
            + '&body=' + encodeURIComponent('请注销我的账号。用户名：' + name);
        }
      });
    }
  }
}
</script>

<style>
.page { min-height: 100vh; background: #F5F6FA; }
.top-bar { padding: 100rpx 32rpx 60rpx; background: linear-gradient(160deg, #FF6B35, #FF8F5E); }
.user-row { display: flex; align-items: center; }
.avatar { width: 120rpx; height: 120rpx; border-radius: 50%; background: rgba(255,255,255,0.3); color: #fff; font-size: 48rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-right: 24rpx; }
.u-info { color: #fff; }
.u-name { display: block; font-size: 40rpx; font-weight: 700; }
.u-meta { display: block; font-size: 26rpx; opacity: 0.9; margin-top: 6rpx; }

.card { background: #fff; border-radius: 24rpx; padding: 32rpx; margin: 20rpx 24rpx; }
.card-title { font-size: 30rpx; font-weight: 700; color: #333; margin-bottom: 24rpx; }

.target-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; }
.t-item { background: linear-gradient(135deg, #FFF0E8, #FFE0CC); border-radius: 16rpx; padding: 24rpx; text-align: center; }
.t-val { display: block; font-size: 40rpx; font-weight: 800; color: #FF6B35; }
.t-lbl { display: block; font-size: 22rpx; color: #999; margin-top: 6rpx; }

.form-row { display: flex; align-items: center; justify-content: space-between; padding: 18rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.form-row:last-of-type { border-bottom: none; }
.lbl { font-size: 28rpx; color: #666; }
.inp { text-align: right; font-size: 28rpx; width: 260rpx; }
.seg { display: flex; background: #f5f5f5; border-radius: 12rpx; padding: 4rpx; }
.seg-item { padding: 10rpx 28rpx; font-size: 26rpx; color: #666; border-radius: 10rpx; }
.seg-item.active { background: #FF6B35; color: #fff; }
.picker { font-size: 28rpx; color: #333; }
.save-btn { background: linear-gradient(135deg, #FF6B35, #FF8F5E); color: #fff; border: none; border-radius: 16rpx; height: 88rpx; line-height: 88rpx; font-size: 30rpx; font-weight: 700; margin-top: 24rpx; }

.weight-row { display: flex; gap: 20rpx; }
.w-inp { flex: 1; background: #f5f5f5; border-radius: 14rpx; padding: 0 24rpx; height: 76rpx; font-size: 28rpx; }
.w-btn { background: #4ECDC4; color: #fff; border: none; border-radius: 14rpx; height: 76rpx; line-height: 76rpx; padding: 0 36rpx; font-size: 28rpx; }

.logout-btn { margin: 30rpx 24rpx; background: #fff; color: #FF4D4F; border: none; border-radius: 16rpx; height: 88rpx; line-height: 88rpx; font-size: 30rpx; }
/* 注销按钮：与退出登录区分的更深警示色 */
.logout-btn.delete-btn { color: #d9363e; font-weight: 600; }
</style>

