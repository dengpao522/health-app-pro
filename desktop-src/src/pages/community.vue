<template>
  <view class="page">
    <view class="top-bar">
      <text class="page-title">打卡圈子</text>
      <text class="page-sub">记录即打卡 · 每天进步一点点</text>
    </view>

    <!-- 每日一答：按日期轮换，答对涨知识 -->
    <view class="card quiz-card">
      <view class="card-head">
        <text class="ch-icon">🎯</text>
        <text class="ch-title">每日一答</text>
        <text class="ch-sub">{{ dateLabel }}</text>
      </view>
      <text class="quiz-q">{{ quiz.q }}</text>
      <view class="quiz-options">
        <view v-for="(opt, i) in quiz.options" :key="i"
              class="quiz-opt" :class="quizClass(i)"
              @click="pickQuiz(i)">{{ opt }}</view>
      </view>
      <view class="quiz-explain" v-if="quizPicked !== null">
        <text class="qe-icon">{{ quizPicked === quiz.answer ? '🎉' : '💡' }}</text>
        <text class="qe-text">{{ quizPicked === quiz.answer ? '答对了！' : '正确答案是「' + quiz.options[quiz.answer] + '」' }} {{ quiz.explain }}</text>
      </view>
    </view>

    <!-- 健康知识卡：按日期轮换 -->
    <view class="card tip-card">
      <view class="card-head">
        <text class="ch-icon">📚</text>
        <text class="ch-title">今日健康知识</text>
      </view>
      <text class="tip-text">{{ dailyTip }}</text>
    </view>

    <!-- 打卡动态流：个人打卡日志（本地数据，无网络依赖） -->
    <view class="feed-head">
      <text class="fh-title">🔥 打卡动态</text>
      <text class="fh-sub">最近 {{ feed.length }} 条</text>
    </view>
    <view class="card feed-card" v-if="feed.length">
      <view class="feed-item" v-for="f in feed" :key="f.id">
        <view class="fi-left">
          <text class="fi-icon">{{ mealIcon(f.meal_type) }}</text>
          <view class="fi-info">
            <text class="fi-name">{{ f.food_name }} <text class="fi-serving">{{ f.serving_size }}{{ f.serving_unit }}</text></text>
            <text class="fi-meta">{{ f.meal_name }} · {{ f.date.slice(5) }} {{ f.time }}</text>
          </view>
        </view>
        <text class="fi-cal">{{ Math.round(f.calories) }} kcal</text>
      </view>
    </view>
    <view class="card empty-card" v-else>
      <text class="empty-icon">🍽️</text>
      <text class="empty-text">还没有动态，记录一餐就会出现在这里</text>
    </view>

    <view style="height: 150rpx;"></view>

    <!-- 悬浮按钮：去首页记录 -->
    <view class="fab" @click="goHome">
      <text class="fab-icon">📷</text>
      <text class="fab-text">记一笔</text>
    </view>
  </view>
</template>

<script>
import { request } from '../js/request.js';

// 每日一答题库（营养常识，趣味+科普）
const QUIZ_BANK = [
  { q: '100 大卡大约等于几个中等苹果？', options: ['1 个', '2 个', '4 个'], answer: 0, explain: '一个中等苹果约 95 kcal，100 大卡还不到一个半。' },
  { q: '以下哪种食物蛋白质含量最高（每100克）？', options: ['鸡蛋', '米饭', '苹果'], answer: 0, explain: '鸡蛋约 13g/100g，米饭只有 2.6g，苹果几乎为 0。' },
  { q: '零度可乐真的几乎 0 热量吗？', options: ['是', '不是'], answer: 0, explain: '用代糖替代了蔗糖，每 100ml 约 0 kcal，但甜味剂也要适量。' },
  { q: '吃辣本身会让人长胖吗？', options: ['会', '基本不会'], answer: 1, explain: '辣椒本身热量极低，长胖的是重油重辣的烹饪方式。' },
  { q: '减脂期间完全不吃碳水科学吗？', options: ['科学', '不科学'], answer: 1, explain: '碳水是大脑主要能源，长期极低碳水会影响情绪和代谢。' },
  { q: '一杯 250ml 牛奶约多少热量？', options: ['约 135 kcal', '约 350 kcal', '约 60 kcal'], answer: 0, explain: '全脂奶约 54kcal/100ml，一杯 250ml 约 135 kcal。' },
  { q: '走路 30 分钟大约消耗多少热量（60kg）？', options: ['约 80 kcal', '约 300 kcal', '约 600 kcal'], answer: 0, explain: '快走 MET≈4.3，30 分钟约 129 kcal，比很多人想的少。' },
  { q: '晚上 8 点后吃东西一定会胖？', options: ['一定', '看全天总热量'], answer: 1, explain: '胖瘦取决于全天热量收支，与进食时刻关系不大，但晚餐宜清淡。' },
  { q: '以下哪种烹饪方式热量增加最少？', options: ['清蒸', '油炸', '红烧'], answer: 0, explain: '清蒸几乎不额外加油；油炸吸油、红烧加糖，热量显著上升。' },
  { q: '体重每天波动 1~2 斤正常吗？', options: ['正常', '不正常'], answer: 0, explain: '水分、食物残留都会引起短期波动，看周趋势才有意义。' },
];

// 健康知识库
const TIP_BANK = [
  '每天饮水 1500~2000ml 有助于代谢，少量多次比一次猛喝更好吸收。',
  '《中国居民膳食指南》建议每天盐摄入不超过 5g，大约一啤酒瓶盖的量。',
  '先喝汤再吃菜、后吃主食的进食顺序，能让饱腹感来得更早。',
  '睡眠不足会让饥饿素升高，是"熬夜想吃东西"的元凶，保证 7 小时睡眠也是减脂。',
  '蛋白质消化耗能更高，同样热量下多吃蛋、奶、瘦肉更抗饿。',
  '运动消耗常被高估：慢跑 30 分钟约 250 kcal，只相当于一小包薯片。',
  '全谷物比精米面多保留膳食纤维和B族维生素，升糖更平缓、更抗饿。',
  '每周减重 0.5~1kg 是安全速度，过快掉的多是水分和肌肉。',
];

function daySeed() {
  const d = new Date();
  return d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate();
}

export default {
  data() {
    return {
      feed: [],
      quizPicked: null,
    };
  },
  computed: {
    // 按日期轮换出题，每天不同
    quiz() { return QUIZ_BANK[daySeed() % QUIZ_BANK.length]; },
    dailyTip() { return TIP_BANK[daySeed() % TIP_BANK.length]; },
    dateLabel() {
      const d = new Date();
      return d.getMonth() + 1 + '月' + d.getDate() + '日';
    },
  },
  onShow() { this.loadData(); },
  methods: {
    async loadData() {
      try {
        this.feed = await request({ url: '/api/community/feed' }) || [];
      } catch (e) { console.error(e); }
    },
    pickQuiz(i) {
      if (this.quizPicked !== null) return; // 已作答锁定
      this.quizPicked = i;
    },
    quizClass(i) {
      if (this.quizPicked === null) return {};
      if (i === this.quiz.answer) return { right: true };
      if (i === this.quizPicked) return { wrong: true };
      return { dim: true };
    },
    mealIcon(t) {
      return { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍪' }[t] || '🍽️';
    },
    goHome() { uni.switchTab({ url: '/pages/home/home' }); },
  }
}
</script>

<style>
.page { min-height: 100vh; background: var(--bg-page); padding-bottom: 40rpx; }
.top-bar { padding: 100rpx 32rpx 30rpx; background: linear-gradient(150deg, #34C77B 0%, #22A05F 100%); color: #fff; border-radius: 0 0 44rpx 44rpx; }
.page-title { display: block; font-size: 44rpx; font-weight: 800; }
.page-sub { display: block; font-size: 24rpx; opacity: 0.9; margin-top: 8rpx; }

.card { background: var(--bg-card); border-radius: 28rpx; padding: 30rpx 28rpx; margin: 22rpx 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04); animation: fadeUp .4s ease both; }
.card-head { display: flex; align-items: center; gap: 12rpx; margin-bottom: 20rpx; }
.ch-icon { font-size: 30rpx; }
.ch-title { font-size: 30rpx; font-weight: 800; color: var(--text-1); flex: 1; }
.ch-sub { font-size: 20rpx; color: var(--text-4); }

/* ===== 每日一答 ===== */
.quiz-card { margin-top: -30rpx; }
.quiz-q { display: block; font-size: 30rpx; font-weight: 700; color: var(--text-1); line-height: 1.6; margin-bottom: 22rpx; }
.quiz-options { display: flex; flex-direction: column; gap: 14rpx; }
.quiz-opt { padding: 22rpx 26rpx; background: var(--bg-input); border-radius: 18rpx; font-size: 27rpx; color: var(--text-1); cursor: pointer; transition: all .2s; }
.quiz-opt:active { background: #FFF0E8; }
.quiz-opt.right { background: #E8FBF0; color: #16A34A; font-weight: 700; box-shadow: inset 0 0 0 3rpx #22C55E; }
.quiz-opt.wrong { background: #FEF2F2; color: #DC2626; font-weight: 700; box-shadow: inset 0 0 0 3rpx #EF4444; }
.quiz-opt.dim { opacity: 0.45; }
.quiz-explain { display: flex; gap: 12rpx; margin-top: 20rpx; background: var(--bg-soft); border-radius: 16rpx; padding: 18rpx 20rpx; align-items: flex-start; }
.qe-icon { flex-shrink: 0; }
.qe-text { font-size: 23rpx; color: var(--text-2); line-height: 1.6; }

/* ===== 知识卡 ===== */
.tip-card { background: linear-gradient(135deg, #FFF8E8, var(--bg-card)); }
.tip-text { font-size: 25rpx; color: var(--text-2); line-height: 1.8; }

/* ===== 动态流 ===== */
.feed-head { display: flex; justify-content: space-between; align-items: center; margin: 26rpx 28rpx 6rpx; }
.fh-title { font-size: 32rpx; font-weight: 800; color: var(--text-1); }
.fh-sub { font-size: 20rpx; color: var(--text-4); }
.feed-item { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid var(--line); }
.feed-item:last-child { border-bottom: none; }
.fi-left { display: flex; align-items: center; gap: 18rpx; flex: 1; }
.fi-icon { font-size: 40rpx; }
.fi-info { flex: 1; }
.fi-name { display: block; font-size: 28rpx; font-weight: 600; color: var(--text-1); }
.fi-serving { font-size: 20rpx; color: var(--text-4); font-weight: 400; }
.fi-meta { display: block; font-size: 21rpx; color: var(--text-3); margin-top: 4rpx; }
.fi-cal { font-size: 27rpx; font-weight: 800; color: #FF6B35; }

.empty-card { text-align: center; padding: 70rpx 28rpx; }
.empty-icon { display: block; font-size: 64rpx; margin-bottom: 14rpx; }
.empty-text { font-size: 26rpx; color: var(--text-3); }

.fab { position: fixed; bottom: 130rpx; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #34C77B, #22A05F); color: #fff; padding: 22rpx 52rpx; border-radius: 60rpx; display: flex; align-items: center; box-shadow: 0 12rpx 32rpx rgba(34,160,95,0.4); z-index: 999; cursor: pointer; }
.fab:active { transform: translateX(-50%) scale(0.95); }
.fab-icon { font-size: 38rpx; margin-right: 12rpx; }
.fab-text { font-size: 29rpx; font-weight: 700; }

@keyframes fadeUp { from { opacity: 0; transform: translateY(24rpx); } to { opacity: 1; transform: translateY(0); } }
</style>
