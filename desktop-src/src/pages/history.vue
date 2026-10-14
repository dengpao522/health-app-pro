<template>
  <view class="page">
    <view class="top-bar">
      <view class="nav-row">
        <text class="back" @click="goBack">‹</text>
        <text class="page-title">记录历史</text>
      </view>
      <!-- 日期导航：‹ 前一天 / 后一天 ›，未来日期不可进 -->
      <view class="date-nav">
        <text class="dn-btn" @click="shiftDay(-1)">‹</text>
        <text class="dn-date">{{ dateLabel }}</text>
        <text class="dn-btn" :class="{ disabled: isToday }" @click="shiftDay(1)">›</text>
      </view>
    </view>

    <!-- 当日摘要五格：摄入 / 运动 / 饮水 / 睡眠 / 体重 -->
    <view class="sum-card">
      <view class="sum-item">
        <text class="s-val orange">{{ day.calories }}</text>
        <text class="s-lbl">摄入 kcal</text>
      </view>
      <view class="sum-item">
        <text class="s-val green">{{ day.exercise_calories }}</text>
        <text class="s-lbl">运动 kcal</text>
      </view>
      <view class="sum-item">
        <text class="s-val blue">{{ day.water }}</text>
        <text class="s-lbl">饮水 ml</text>
      </view>
      <view class="sum-item">
        <text class="s-val purple">{{ day.sleep ? day.sleep.hours : '—' }}</text>
        <text class="s-lbl">睡眠 h</text>
      </view>
      <view class="sum-item">
        <text class="s-val teal">{{ day.weight || '—' }}</text>
        <text class="s-lbl">体重 kg</text>
      </view>
    </view>

    <!-- 饮食明细：按餐次分组，可删除（删除走今日同款接口，跨日期通用） -->
    <view class="card">
      <view class="card-title">🍽️ 饮食 <text class="ct-count">{{ day.meals.length }} 项</text></view>
      <view v-if="!day.meals.length" class="empty-hint">这一天没有饮食记录</view>
      <view v-for="g in mealGroups" :key="g.key" class="meal-group">
        <text class="mg-name">{{ g.name }}</text>
        <view v-for="m in g.items" :key="m.id" class="meal-row">
          <view class="mr-info">
            <text class="mr-name">{{ m.food_name }}</text>
            <text class="mr-meta">{{ m.serving_size }}{{ m.serving_unit || 'g' }} · 蛋白{{ m.protein }} 脂肪{{ m.fat }} 碳水{{ m.carbs }}</text>
          </view>
          <view class="mr-right">
            <text class="mr-cal">{{ Math.round(m.calories) }}</text>
            <view class="mr-del" @click="delMeal(m)">✕</view>
          </view>
        </view>
      </view>
    </view>

    <!-- 运动明细：可删除 -->
    <view class="card" v-if="day.exercises.length">
      <view class="card-title">🏃 运动 <text class="ct-count">{{ day.exercises.length }} 项</text></view>
      <view v-for="e in day.exercises" :key="e.id" class="ex-row">
        <text class="exr-text">{{ e.icon }} {{ e.type }} {{ e.minutes }} 分钟</text>
        <view class="mr-right">
          <text class="exr-cal">-{{ e.calories }} kcal</text>
          <view class="mr-del" @click="delExercise(e)">✕</view>
        </view>
      </view>
    </view>

    <!-- 睡眠/体重只读展示（记录入口在今日页） -->
    <view class="card" v-if="day.sleep || day.weight">
      <view class="card-title">📋 当日其他记录</view>
      <view class="oth-row" v-if="day.sleep">
        <text class="oth-label">😴 睡眠</text>
        <text class="oth-val">{{ day.sleep.bedtime }} → {{ day.sleep.waketime }}（{{ day.sleep.hours }} 小时）</text>
      </view>
      <view class="oth-row" v-if="day.weight">
        <text class="oth-label">⚖️ 体重</text>
        <text class="oth-val">{{ day.weight }} kg</text>
      </view>
    </view>

    <view style="height: 60rpx;"></view>
  </view>
</template>

<script>
import { request } from '../js/request.js';

const MEAL_NAMES = { breakfast: '🌅 早餐', lunch: '☀️ 午餐', dinner: '🌙 晚餐', snack: '🍪 加餐' };
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

export default {
  data() {
    return {
      // 当前查看的日期（YYYY-MM-DD），默认今天
      date: '',
      day: { meals: [], exercises: [], water: 0, sleep: null, weight: null, calories: 0, exercise_calories: 0 },
      today: '',
    };
  },
  computed: {
    isToday() { return this.date === this.today; },
    // 日期徽标文案：今天 / 昨天 / MM-DD
    dateLabel() {
      if (this.isToday) return '今天';
      if (this.date === this.offsetStr(1)) return '昨天';
      return this.date.slice(5).replace('-', ' 月 ') + ' 日';
    },
    // 按餐次顺序分组（空餐次不显示）
    mealGroups() {
      return MEAL_ORDER
        .map(k => ({ key: k, name: MEAL_NAMES[k], items: this.day.meals.filter(m => m.meal_type === k) }))
        .filter(g => g.items.length);
    },
  },
  onLoad(query) {
    this.today = this.fmt(new Date());
    // 打卡日历点击带日期跳转（query.date），非法/未来日期兜底回今天
    const q = (query && query.date) || '';
    this.date = /^\d{4}-\d{2}-\d{2}$/.test(q) && q <= this.today ? q : this.today;
  },
  onShow() {
    // 从历史页删完记录返回时刷新当天数据
    this.load();
  },
  methods: {
    fmt(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    offsetStr(n) {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return this.fmt(d);
    },
    async load() {
      try {
        this.day = await request({ url: '/api/history', data: { date: this.date } });
      } catch (e) { /* mock 层已 toast，这里保持旧数据不闪空 */ }
    },
    // 前后翻日：不能超过今天
    shiftDay(n) {
      if (n > 0 && this.isToday) return;
      const d = new Date(this.date + 'T00:00:00');
      d.setDate(d.getDate() + n);
      const next = this.fmt(d);
      if (next > this.today) return;
      this.date = next;
      this.load();
    },
    delMeal(m) {
      uni.showModal({
        title: '删除记录', content: `删除「${m.food_name}」这条记录？`,
        success: (r) => {
          if (r.confirm) {
            request({ url: `/api/meals/${m.id}`, method: 'DELETE' }).then(() => this.load());
          }
        },
      });
    },
    delExercise(e) {
      uni.showModal({
        title: '删除记录', content: `删除「${e.type} ${e.minutes} 分钟」这条记录？`,
        success: (r) => {
          if (r.confirm) {
            request({ url: `/api/exercises/${e.id}`, method: 'DELETE' }).then(() => this.load());
          }
        },
      });
    },
    goBack() { uni.navigateBack(); },
  },
};
</script>

<style>
/* 本页全部走主题变量：浅色/深色自动适配 */
.page { min-height: 100vh; background: var(--bg-page); padding-bottom: 40rpx; }
.top-bar { padding: 100rpx 32rpx 26rpx; background: linear-gradient(160deg, #FF6B35, #FF8F5E); color: #fff; border-radius: 0 0 44rpx 44rpx; }
.nav-row { display: flex; align-items: center; }
.back { font-size: 60rpx; line-height: 1; margin-right: 20rpx; cursor: pointer; padding: 0 10rpx; }
.page-title { font-size: 44rpx; font-weight: 800; }

/* 日期导航：胶囊居中 */
.date-nav { margin-top: 20rpx; display: flex; align-items: center; justify-content: center; gap: 28rpx; }
.dn-btn { width: 64rpx; height: 64rpx; line-height: 60rpx; text-align: center; font-size: 40rpx; background: rgba(255,255,255,0.2); border-radius: 50%; cursor: pointer; }
.dn-btn.disabled { opacity: 0.35; }
.dn-date { font-size: 32rpx; font-weight: 700; min-width: 140rpx; text-align: center; }

/* 当日摘要：五格横排 */
.sum-card { margin: -6rpx 24rpx 0; background: var(--bg-card); border-radius: 28rpx; padding: 28rpx 16rpx; display: flex; box-shadow: 0 8rpx 30rpx rgba(0,0,0,0.06); position: relative; }
.sum-item { flex: 1; text-align: center; }
.s-val { display: block; font-size: 34rpx; font-weight: 800; font-variant-numeric: tabular-nums; }
.s-val.orange { color: #FF6B35; }
.s-val.green { color: #16A34A; }
.s-val.blue { color: #3D9BFF; }
.s-val.purple { color: #8B7CF6; }
.s-val.teal { color: #14B8A6; }
.s-lbl { display: block; font-size: 19rpx; color: var(--text-3); margin-top: 6rpx; }

.card { background: var(--bg-card); border-radius: 24rpx; padding: 30rpx 28rpx; margin: 20rpx 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04); }
.card-title { font-size: 30rpx; font-weight: 800; color: var(--text-1); margin-bottom: 20rpx; }
.ct-count { font-size: 22rpx; color: var(--text-4); font-weight: 400; }
.empty-hint { text-align: center; font-size: 25rpx; color: var(--text-4); padding: 30rpx 0; }

/* 餐次分组 */
.meal-group { margin-bottom: 10rpx; }
.mg-name { display: block; font-size: 23rpx; font-weight: 700; color: var(--text-3); margin: 14rpx 0 4rpx; }
.meal-row { display: flex; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid var(--line); }
.meal-row:last-child { border-bottom: none; }
.mr-info { flex: 1; }
.mr-name { display: block; font-size: 28rpx; font-weight: 600; color: var(--text-1); }
.mr-meta { display: block; font-size: 21rpx; color: var(--text-3); margin-top: 4rpx; }
.mr-right { display: flex; align-items: center; gap: 16rpx; }
.mr-cal { font-size: 28rpx; font-weight: 800; color: #FF6B35; }
.mr-cal::after { content: ' kcal'; font-size: 16rpx; color: var(--text-4); font-weight: 400; }
.mr-del { font-size: 22rpx; color: var(--text-4); background: var(--bg-input); width: 44rpx; height: 44rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.mr-del:active { background: rgba(255,77,79,0.14); color: #FF4D4F; }

/* 运动行 */
.ex-row { display: flex; justify-content: space-between; align-items: center; padding: 14rpx 0; border-bottom: 1rpx solid var(--line); }
.ex-row:last-child { border-bottom: none; }
.exr-text { font-size: 26rpx; color: var(--text-1); }
.exr-cal { font-size: 26rpx; color: #16A34A; font-weight: 700; }

/* 其他记录 */
.oth-row { display: flex; justify-content: space-between; align-items: center; padding: 14rpx 0; border-bottom: 1rpx solid var(--line); }
.oth-row:last-child { border-bottom: none; }
.oth-label { font-size: 25rpx; color: var(--text-2); }
.oth-val { font-size: 25rpx; font-weight: 600; color: var(--text-1); }
</style>
