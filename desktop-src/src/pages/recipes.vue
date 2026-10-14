<template>
  <view class="page">
    <view class="top-bar">
      <view class="nav-row">
        <text class="back" @click="goBack">‹</text>
        <text class="page-title">食谱推荐</text>
      </view>
      <text class="page-sub">按你的{{ goalLabel }}目标搭配 · 家常做法</text>
    </view>

    <!-- 今日余量横幅：智能排序的依据，一眼知道还能吃多少 -->
    <view class="remain-banner" v-if="remain !== null">
      <text class="rb-icon">⚖️</text>
      <text class="rb-text">今天还可吃 <text class="rb-num">{{ remain }}</text> kcal，推荐已按余量排序</text>
    </view>

    <!-- 餐次切换 -->
    <view class="meal-tabs">
      <view v-for="t in mealTabs" :key="t.key"
            class="meal-tab" :class="{ active: activeMeal === t.key }"
            @click="activeMeal = t.key">
        {{ t.name }}
      </view>
    </view>

    <!-- 食谱卡片列表 -->
    <view class="recipe-card" v-for="r in list" :key="r.id">
      <view class="rc-head">
        <text class="rc-name">{{ r.name }}</text>
        <view class="rc-tags">
          <text class="rc-tag" v-for="g in r.goals" :key="g" :class="g">{{ GOAL_LABELS[g] }}</text>
        </view>
      </view>
      <!-- 营养速览（每份估算） -->
      <view class="rc-nutrition">
        <text class="rc-cal">🔥 {{ r.calories }} kcal</text>
        <text class="rc-macro">🥩 蛋白 {{ r.protein }}g</text>
        <text class="rc-macro">🥑 脂肪 {{ r.fat }}g</text>
        <text class="rc-macro">🍚 碳水 {{ r.carbs }}g</text>
      </view>
      <!-- 推荐理由：规则匹配后的一句话说明 -->
      <view class="rc-reason">
        <text class="rc-reason-icon">💬</text>
        <text class="rc-reason-text">{{ r.reason }}</text>
      </view>
      <!-- 收藏：右上角星标，存本机 -->
      <view class="rc-fav" :class="{ on: isFav(r.id) }" @click="toggleFav(r.id)">{{ isFav(r.id) ? '★ 已收藏' : '☆ 收藏' }}</view>
      <!-- 食材清单 -->
      <view class="rc-section">
        <text class="rc-section-title">🛒 食材</text>
        <view class="rc-ingredients">
          <text class="rc-ingredient" v-for="(it, i) in r.ingredients" :key="i">{{ it }}</text>
        </view>
      </view>
      <!-- 做法步骤 -->
      <view class="rc-section">
        <text class="rc-section-title">👨‍🍳 做法</text>
        <view class="rc-step" v-for="(s, i) in r.steps" :key="i">
          <text class="rc-step-num">{{ i + 1 }}</text>
          <text class="rc-step-text">{{ s }}</text>
        </view>
      </view>
    </view>

    <view style="height: 60rpx;"></view>
  </view>
</template>

<script>
import { recommendSmart, mealTypeByHour } from '../js/recipes.js';
import { request } from '../js/request.js';

const GOAL_LABELS = { lose: '减脂', maintain: '均衡', gain: '增肌' };
const FAV_KEY = 'health_pro_fav_recipes';

export default {
  data() {
    return {
      GOAL_LABELS,
      mealTabs: [
        { key: 'breakfast', name: '早餐' },
        { key: 'lunch', name: '午餐' },
        { key: 'dinner', name: '晚餐' },
      ],
      activeMeal: 'breakfast',
      goal: 'maintain',
      list: [],
      // 今日热量余量（null=还没加载出来，退回普通排序）
      remain: null,
      // 收藏的食谱 id 集合
      favs: [],
    };
  },
  computed: {
    goalLabel() { return GOAL_LABELS[this.goal] || '均衡'; },
  },
  onShow() {
    // 从本地登录信息里读用户目标，决定推荐过滤方向
    const user = uni.getStorageSync('userInfo')?.user || {};
    this.goal = user.goal || 'maintain';
    // 默认选中当前时段对应的餐次
    this.activeMeal = mealTypeByHour();
    // 恢复收藏
    try { this.favs = JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch (e) { this.favs = []; }
    this.loadRemain();
    this.refresh();
  },
  watch: {
    // 切换餐次时重新过滤推荐
    activeMeal() { this.refresh(); },
  },
  methods: {
    // 拉今日统计算余量：目标 - 摄入 + 运动×0.9（与首页同口径）
    async loadRemain() {
      try {
        const s = await request({ url: '/api/stats/today' });
        this.remain = Math.max(0, Math.round(s.target.calories - s.calories + (s.exercise_calories || 0) * 0.9));
      } catch (e) { this.remain = null; }
    },
    refresh() {
      this.list = recommendSmart(this.goal, this.activeMeal, this.remain);
    },
    isFav(id) { return this.favs.includes(id); },
    toggleFav(id) {
      this.favs = this.isFav(id) ? this.favs.filter(x => x !== id) : [...this.favs, id];
      localStorage.setItem(FAV_KEY, JSON.stringify(this.favs));
      uni.showToast({ title: this.isFav(id) ? '已收藏' : '已取消收藏', icon: 'none' });
    },
    goBack() { uni.navigateBack(); },
  }
}
</script>

<style>
.page { min-height: 100vh; background: var(--bg-page); }
.top-bar { padding: 100rpx 32rpx 30rpx; background: linear-gradient(160deg, #FF6B35, #FF8F5E); color: #fff; border-radius: 0 0 44rpx 44rpx; }
.nav-row { display: flex; align-items: center; }
.back { font-size: 60rpx; line-height: 1; margin-right: 20rpx; cursor: pointer; padding: 0 10rpx; }
.page-title { font-size: 44rpx; font-weight: 800; }
.page-sub { display: block; font-size: 26rpx; opacity: 0.9; margin-top: 8rpx; }

/* 今日余量横幅（与首页热量口径一致） */
.remain-banner { margin: -20rpx 24rpx 0; background: var(--bg-card); border-radius: 20rpx; padding: 18rpx 24rpx; display: flex; align-items: center; gap: 12rpx; box-shadow: 0 6rpx 20rpx rgba(255,107,53,0.10); position: relative; }
.rb-icon { font-size: 26rpx; }
.rb-text { font-size: 24rpx; color: var(--text-2); }
.rb-num { font-size: 30rpx; font-weight: 800; color: #FF6B35; }

.meal-tabs { display: flex; gap: 16rpx; margin: 24rpx 24rpx 0; }
.meal-tab { flex: 1; text-align: center; padding: 18rpx 0; border-radius: 40rpx; background: var(--bg-card); color: var(--text-2); font-size: 28rpx; font-weight: 600; cursor: pointer; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); }
.meal-tab.active { background: #FF6B35; color: #fff; }

.recipe-card { background: var(--bg-card); border-radius: 24rpx; padding: 32rpx; margin: 20rpx 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04); border-left: 8rpx solid #FF8F5E; position: relative; }
.rc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.rc-name { font-size: 32rpx; font-weight: 700; color: var(--text-1); }
.rc-tags { display: flex; gap: 8rpx; }
.rc-tag { font-size: 20rpx; padding: 4rpx 14rpx; border-radius: 16rpx; font-weight: 600; }
.rc-tag.lose { background: #E8FFF8; color: #1f8a70; }
.rc-tag.maintain { background: #FFF8E8; color: #8a6a1f; }
.rc-tag.gain { background: #FFF0E8; color: #d4552a; }

.rc-nutrition { display: flex; gap: 20rpx; flex-wrap: wrap; padding: 16rpx; background: var(--bg-soft); border-radius: 16rpx; margin-bottom: 16rpx; }
.rc-cal { font-size: 26rpx; font-weight: 700; color: #FF6B35; }
.rc-macro { font-size: 24rpx; color: var(--text-2); }

.rc-reason { display: flex; gap: 12rpx; background: rgba(255,107,53,0.08); border-radius: 16rpx; padding: 16rpx 20rpx; margin-bottom: 20rpx; align-items: flex-start; }
.rc-reason-icon { flex-shrink: 0; font-size: 24rpx; }
.rc-reason-text { font-size: 24rpx; color: var(--text-2); line-height: 1.6; }

/* 收藏星标：右上角浮动 */
.rc-fav { position: absolute; right: 24rpx; bottom: 24rpx; font-size: 22rpx; color: var(--text-3); background: var(--bg-input); padding: 8rpx 20rpx; border-radius: 26rpx; cursor: pointer; }
.rc-fav.on { color: #F59E0B; background: rgba(245,158,11,0.12); font-weight: 700; }

.rc-section { margin-bottom: 12rpx; }
.rc-section:last-child { margin-bottom: 0; }
.rc-section-title { display: block; font-size: 26rpx; font-weight: 700; color: var(--text-1); margin-bottom: 10rpx; }
.rc-ingredients { display: flex; flex-wrap: wrap; gap: 10rpx; }
.rc-ingredient { font-size: 22rpx; color: var(--text-2); background: var(--bg-input); padding: 6rpx 16rpx; border-radius: 12rpx; }
.rc-step { display: flex; gap: 14rpx; align-items: flex-start; margin-bottom: 8rpx; }
.rc-step-num { flex-shrink: 0; width: 34rpx; height: 34rpx; border-radius: 50%; background: #FFE0CC; color: #d4552a; font-size: 20rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 2rpx; }
.rc-step-text { font-size: 24rpx; color: var(--text-2); line-height: 1.6; }
</style>
