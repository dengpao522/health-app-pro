<template>
  <view class="page">
    <view class="header">
      <view class="greeting">
        <text class="hello">{{ greeting }}，{{ nickname }}</text>
        <text class="date">{{ dateStr }}</text>
      </view>
      <view class="avatar" @click="toProfile">{{ avatarText }}</view>
    </view>

    <!-- 热量环形进度 -->
    <view class="ring-card">
      <view class="ring-wrap">
        <canvas canvas-id="calorieRing" design-width="220" design-height="220" class="ring-canvas"></canvas>
        <view class="ring-center">
          <text class="ring-num" :class="{ over: isOver }">{{ summary.calories }}</text>
          <text class="ring-label">已摄入 kcal</text>
          <text v-if="isOver" class="ring-remain over-text">超标 {{ summary.calories - target.calories }} kcal 🔥</text>
          <text v-else class="ring-remain">还可吃 {{ remain }} kcal</text>
        </view>
      </view>
      <view class="ring-stats">
        <view class="stat-item"><text class="stat-val">{{ summary.protein }}</text><text class="stat-lbl">蛋白质 g</text></view>
        <view class="stat-item"><text class="stat-val">{{ summary.fat }}</text><text class="stat-lbl">脂肪 g</text></view>
        <view class="stat-item"><text class="stat-val">{{ summary.carbs }}</text><text class="stat-lbl">碳水 g</text></view>
      </view>
    </view>

    <!-- 三大营养素进度 -->
    <view class="card macro-card">
      <view class="card-title">营养素摄入</view>
      <view class="macro-row" v-for="m in macros" :key="m.name">
        <view class="macro-head">
          <text class="macro-name" :style="{color:m.color}">{{ m.icon }} {{ m.name }}</text>
          <text class="macro-val" :class="{over: m.over}">{{ m.cur }} / {{ m.target }} g</text>
        </view>
        <view class="macro-bar"><view class="macro-fill" :style="{width:Math.min(m.pct,100)+'%',background:m.color}"></view></view>
      </view>
    </view>

    <!-- 饮水 -->
    <view class="card water-card">
      <text class="w-icon">💧</text>
      <view class="w-info">
        <text class="w-title">今日饮水</text>
        <text class="w-val">{{ summary.water }} / {{ target.water }} ml</text>
      </view>
      <view class="water-btns">
        <view class="w-cup" @click="addWater(200)">+200</view>
        <view class="w-cup primary" @click="addWater(250)">+250</view>
      </view>
    </view>

    <!-- 餐次 -->
    <view class="card meal-card">
      <view class="card-title">今日饮食</view>
      <view class="meal-type-row">
        <view v-for="t in mealTypes" :key="t.key"
              class="meal-type-item" :class="{active: activeType===t.key}"
              @click="activeType=t.key">
          <text class="mt-icon">{{ t.icon }}</text>
          <text class="mt-name">{{ t.name }}</text>
          <text class="mt-cal">{{ mealCal(t.key) }} kcal</text>
        </view>
      </view>
      <view class="meal-list">
        <view v-if="filteredMeals.length===0" class="empty">
          <text class="empty-icon">🍽️</text>
          <text class="empty-text">{{ activeTypeName }}还没有记录，点击下方拍照添加</text>
        </view>
        <view v-for="m in filteredMeals" :key="m.id" class="meal-item">
          <view class="m-info">
            <text class="m-name">{{ m.food_name }}</text>
            <text class="m-meta">{{ m.serving_size }}{{ m.serving_unit || 'g' }} · {{ m.protein }}蛋白/{{ m.fat }}脂肪/{{ m.carbs }}碳水</text>
          </view>
          <view class="m-right">
            <view class="m-cal">{{ m.calories }} kcal</view>
            <view class="m-del" @click="delMeal(m)">删除</view>
          </view>
        </view>
      </view>
    </view>

    <view style="height: 140rpx;"></view>

    <!-- 悬浮拍照按钮 -->
    <view class="fab" @click="toScan">
      <text class="fab-icon">📷</text>
      <text class="fab-text">拍照记录</text>
    </view>
  </view>
</template>

<script>
import { request } from '../js/request.js';
const MEAL_NAMES = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
export default {
  data() {
    return {
      nickname: '',
      avatarText: 'U',
      dateStr: '',
      greeting: '你好',
      activeType: '',
      mealTypes: [
        { key: 'breakfast', name: '早餐', icon: '🌅' },
        { key: 'lunch', name: '午餐', icon: '☀️' },
        { key: 'dinner', name: '晚餐', icon: '🌙' },
        { key: 'snack', name: '加餐', icon: '🍪' },
      ],
      summary: { calories: 0, protein: 0, fat: 0, carbs: 0, water: 0, meals: [] },
      target: { calories: 2000, protein: 120, fat: 60, carbs: 260, water: 2000 },
    };
  },
  computed: {
    remain() { return Math.max(0, this.target.calories - this.summary.calories); },
    isOver() { return this.summary.calories > this.target.calories; },
    activeTypeName() { return MEAL_NAMES[this.activeType] || ''; },
    macros() {
      const mk = (name, icon, cur, target, color) => ({
        name, icon, cur: Math.round(cur), target, color,
        pct: target > 0 ? cur / target * 100 : 0,
        over: cur > target,
      });
      return [
        mk('蛋白质', '🥩', this.summary.protein, this.target.protein, '#FF6B35'),
        mk('脂肪', '🥑', this.summary.fat, this.target.fat, '#FFB020'),
        mk('碳水化合物', '🍚', this.summary.carbs, this.target.carbs, '#4ECDC4'),
      ];
    },
    filteredMeals() {
      return (this.summary.meals || []).filter(m => m.meal_type === this.activeType);
    }
  },
  onShow() {
    // 根据当前时间自动选中餐次
    const h = new Date().getHours();
    if (h < 10) this.activeType = 'breakfast';
    else if (h < 14) this.activeType = 'lunch';
    else if (h < 18) this.activeType = 'snack';
    else this.activeType = 'dinner';
    this.loadData();
  },
  methods: {
    async loadData() {
      const user = uni.getStorageSync('userInfo')?.user || {};
      this.nickname = user.nickname || user.username || '朋友';
      this.avatarText = (this.nickname || 'U').charAt(0).toUpperCase();
      const h = new Date().getHours();
      this.greeting = h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
      this.dateStr = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
      try {
        const s = await request({ url: '/api/stats/today' });
        this.summary = { calories: 0, protein: 0, fat: 0, carbs: 0, water: 0, meals: [], ...s };
        this.target = s.target;
        this.drawRing();
      } catch (e) { console.error(e); }
    },
    drawRing() {
      const ctx = uni.createCanvasContext('calorieRing', this);
      const w = 220, cx = w / 2, cy = w / 2, r = 88, lineW = 18;
      const pct = this.target.calories > 0 ? Math.min(this.summary.calories / this.target.calories, 1) : 0;
      ctx.clearRect(0, 0, w, w);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.setStrokeStyle('#FFE8DD');
      ctx.setLineWidth(lineW);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      const grad = ctx.createLinearGradient(0, 0, w, w);
      grad.addColorStop(0, '#FF6B35');
      grad.addColorStop(1, '#FF8F5E');
      ctx.setStrokeStyle(grad);
      ctx.setLineWidth(lineW);
      ctx.setLineCap('round');
      ctx.stroke();
      ctx.draw();
    },
    mealCal(key) {
      return (this.summary.meals || []).filter(m => m.meal_type === key).reduce((s, m) => s + m.calories, 0).toFixed(0);
    },
    addWater(amount) {
      request({ url: '/api/water', method: 'POST', data: { amount } }).then(r => {
        this.summary.water = r.today_total;
        uni.showToast({ title: '已记录 ' + amount + 'ml', icon: 'success' });
      });
    },
    delMeal(m) {
      uni.showModal({
        title: '删除', content: `删除「${m.food_name}」这条记录？`,
        success: (res) => {
          if (res.confirm) {
            request({ url: `/api/meals/${m.id}`, method: 'DELETE' }).then(() => this.loadData());
          }
        }
      });
    },
    toScan() { uni.switchTab({ url: '/pages/scan/scan' }); },
    toProfile() { uni.switchTab({ url: '/pages/profile/profile' }); }
  }
}
</script>

<style>
.page { min-height: 100vh; background: #F5F6FA; padding-bottom: 40rpx; }
.header { padding: 100rpx 32rpx 30rpx; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(160deg, #FF6B35, #FF8F5E); }
.greeting { color: #fff; }
.hello { display: block; font-size: 40rpx; font-weight: 700; }
.date { display: block; font-size: 24rpx; opacity: 0.85; margin-top: 6rpx; }
.avatar { width: 80rpx; height: 80rpx; border-radius: 50%; background: rgba(255,255,255,0.3); color: #fff; font-size: 36rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; }

.ring-card { margin: -20rpx 24rpx 0; background: #fff; border-radius: 28rpx; padding: 40rpx 32rpx; box-shadow: 0 10rpx 40rpx rgba(255,107,53,0.15); position: relative; }
.ring-wrap { position: relative; width: 440rpx; height: 440rpx; margin: 0 auto; }
.ring-canvas { width: 440rpx; height: 440rpx; }
.ring-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); text-align: center; }
.ring-num { display: block; font-size: 72rpx; font-weight: 800; color: #FF6B35; }
.ring-num.over { color: #FF4D4F; }
.ring-label { display: block; font-size: 24rpx; color: #999; margin-top: 4rpx; }
.ring-remain { display: block; font-size: 24rpx; color: #4ECDC4; margin-top: 12rpx; font-weight: 600; }
.ring-remain.over-text { color: #FF4D4F; }
.ring-stats { display: flex; justify-content: space-around; margin-top: 30rpx; padding-top: 30rpx; border-top: 1rpx solid #f0f0f0; }
.stat-item { text-align: center; }
.stat-val { display: block; font-size: 40rpx; font-weight: 700; color: #333; }
.stat-lbl { display: block; font-size: 22rpx; color: #999; margin-top: 4rpx; }

.card { background: #fff; border-radius: 24rpx; padding: 32rpx; margin: 20rpx 24rpx; }
.card-title { font-size: 30rpx; font-weight: 700; color: #333; margin-bottom: 24rpx; }

.macro-row { margin-bottom: 24rpx; }
.macro-row:last-child { margin-bottom: 0; }
.macro-head { display: flex; justify-content: space-between; margin-bottom: 10rpx; }
.macro-name { font-size: 26rpx; font-weight: 600; }
.macro-val { font-size: 24rpx; color: #999; }
.macro-val.over { color: #FF4D4F; font-weight: 600; }
.macro-bar { height: 16rpx; background: #f3f3f3; border-radius: 8rpx; overflow: hidden; }
.macro-fill { height: 100%; border-radius: 8rpx; transition: width .4s; }

.water-card { display: flex; align-items: center; }
.w-icon { font-size: 48rpx; margin-right: 20rpx; }
.w-info { flex: 1; }
.w-title { display: block; font-size: 26rpx; color: #666; }
.w-val { display: block; font-size: 32rpx; font-weight: 700; color: #4ECDC4; }
.water-btns { display: flex; gap: 12rpx; }
.w-cup { background: #f0f0f0; color: #666; padding: 10rpx 20rpx; border-radius: 30rpx; font-size: 24rpx; font-weight: 600; }
.w-cup.primary { background: #4ECDC4; color: #fff; }

.meal-type-row { display: flex; justify-content: space-between; margin-bottom: 24rpx; }
.meal-type-item { flex: 1; text-align: center; padding: 16rpx 0; border-radius: 16rpx; background: #f8f8f8; margin: 0 6rpx; }
.meal-type-item.active { background: #FFF0E8; }
.mt-icon { display: block; font-size: 32rpx; }
.mt-name { display: block; font-size: 24rpx; color: #333; margin-top: 4rpx; }
.meal-type-item.active .mt-name { color: #FF6B35; font-weight: 700; }
.mt-cal { display: block; font-size: 20rpx; color: #999; margin-top: 2rpx; }

.meal-list { }
.empty { text-align: center; color: #bbb; padding: 60rpx 0; }
.empty-icon { display: block; font-size: 60rpx; margin-bottom: 16rpx; }
.empty-text { display: block; font-size: 26rpx; }
.meal-item { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.meal-item:last-child { border-bottom: none; }
.m-info { flex: 1; }
.m-name { display: block; font-size: 28rpx; font-weight: 600; color: #333; }
.m-meta { display: block; font-size: 22rpx; color: #999; margin-top: 4rpx; }
.m-right { display: flex; align-items: center; gap: 16rpx; }
.m-cal { font-size: 30rpx; font-weight: 700; color: #FF6B35; }
.m-del { font-size: 22rpx; color: #FF4D4F; background: #FFF0F0; padding: 6rpx 16rpx; border-radius: 12rpx; }

.fab { position: fixed; bottom: 40rpx; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #FF6B35, #FF8F5E); color: #fff; padding: 24rpx 56rpx; border-radius: 60rpx; display: flex; align-items: center; box-shadow: 0 10rpx 30rpx rgba(255,107,53,0.4); z-index: 999; }
.fab-icon { font-size: 40rpx; margin-right: 12rpx; }
.fab-text { font-size: 30rpx; font-weight: 700; }
</style>
