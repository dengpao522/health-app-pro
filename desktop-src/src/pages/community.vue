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

    <!-- 热门话题：3 天轮换一批，本地氛围组 -->
    <view class="card topic-card">
      <view class="card-head">
        <text class="ch-icon">🔥</text>
        <text class="ch-title">热门话题</text>
        <text class="ch-sub">每 3 天更新</text>
      </view>
      <view class="topic-row" v-for="t in topics" :key="t.tag">
        <view class="tp-info">
          <text class="tp-tag">{{ t.tag }}</text>
          <text class="tp-desc">{{ t.desc }}</text>
        </view>
        <text class="tp-hot">{{ t.hot }} 人参与</text>
      </view>
    </view>

    <!-- 打卡动态流：个人打卡日志（本地数据，无网络依赖），支持点赞/评论 -->
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
            <text class="fi-meta">{{ f.meal_name }} · {{ f.date.slice(5) }} {{ f.time }} · {{ mealScoreHint(f.calories) }}</text>
          </view>
        </view>
        <view class="fi-right">
          <text class="fi-cal">{{ Math.round(f.calories) }} kcal</text>
          <!-- 点赞：❤️ toggle -->
          <view class="fi-like" :class="{ on: likedMap[f.id] }" @click="toggleLike(f.id)">{{ likedMap[f.id] ? '❤️' : '🤍' }}</view>
        </view>
        <!-- 评论：展开收起 -->
        <view class="fi-comments" v-if="openComments === f.id">
          <view class="c-item" v-for="c in (commentMap[f.id] || [])" :key="c.id">
            <text class="c-author">{{ c.author }}</text>
            <text class="c-text">{{ c.text }}</text>
          </view>
          <view class="c-input-row">
            <input class="c-input" v-model="commentDraft" placeholder="写点鼓励的话…" maxlength="100"
                   @keyup.enter="sendComment(f.id)" />
            <view class="c-send" @click="sendComment(f.id)">发送</view>
          </view>
        </view>
        <view class="fi-cmt-btn" @click="toggleComments(f.id)">
          {{ openComments === f.id ? '收起评论' : '💬 评论' + (commentCount(f.id) ? ' ' + commentCount(f.id) : '') }}
        </view>
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

// 热门话题库：按天轮换展示 3 个（本地模拟社区氛围，无网络依赖）
const TOPIC_BANK = [
  { tag: '#16:8轻断食打卡', desc: '分享你的断食窗口和时间表', hot: '2.1万' },
  { tag: '#宿舍减脂餐', desc: '不做饭也能吃好的 N 种方案', hot: '1.8万' },
  { tag: '#戒奶茶第7天', desc: '一起用无糖茶替代下午茶', hot: '9.6千' },
  { tag: '#今晚吃啥', desc: '晒出你的晚餐，互相抄作业', hot: '3.4万' },
  { tag: '#体重秤上的惊喜', desc: '掉秤/围度变化都值得庆祝', hot: '1.2万' },
  { tag: '#办公室健康零食', desc: '工位抽屉里的低卡宝藏', hot: '7.8千' },
  { tag: '#周末轻断食挑战', desc: '从 14:10 开始的温和入门', hot: '6.5千' },
  { tag: '#跑步装备党', desc: '跑鞋/手环/腰包讨论区', hot: '5.2千' },
  { tag: '#高蛋白食谱互换', desc: '鸡胸肉的一百种做法', hot: '2.7万' },
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
      // 点赞状态映射 { [feedId]: true }
      likedMap: {},
      // 评论缓存 { [feedId]: [评论] }，展开过的动态才拉取
      commentMap: {},
      // 当前展开评论的动态 id（同一时间只展开一个）
      openComments: null,
      commentDraft: '',
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
    // 热门话题：按 daySeed 轮换 3 个（每 3 天换一批，制造"在变化"的感觉）
    topics() {
      const all = TOPIC_BANK;
      const start = (daySeed() / 3 | 0) % all.length;
      return [all[start % all.length], all[(start + 1) % all.length], all[(start + 2) % all.length]];
    },
  },
  onShow() { this.loadData(); },
  methods: {
    async loadData() {
      try {
        this.feed = await request({ url: '/api/community/feed' }) || [];
      } catch (e) { console.error(e); }
      // 动态就绪后恢复我点过的赞（一次查询拿到全部 id）
      try {
        const ids = await request({ url: '/api/community/likes' }) || [];
        const map = {};
        ids.forEach(id => { map[id] = true; });
        this.likedMap = map;
      } catch (e) {}
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
    // 单餐热量轻评语：给动态流一点"社区感"的点缀
    mealScoreHint(cal) {
      if (cal <= 300) return '轻食模范 👏';
      if (cal <= 600) return '恰到好处';
      if (cal <= 850) return '吃得挺扎实';
      return '豪华一餐 🎉';
    },
    // ===== 点赞 =====
    async toggleLike(feedId) {
      try {
        const r = await request({ url: '/api/community/like', method: 'POST', data: { feed_id: feedId } });
        this.likedMap = { ...this.likedMap, [feedId]: r.liked };
      } catch (e) {}
    },
    // ===== 评论 =====
    commentCount(feedId) { return (this.commentMap[feedId] || []).length; },
    async toggleComments(feedId) {
      if (this.openComments === feedId) { this.openComments = null; return; }
      this.openComments = feedId;
      this.commentDraft = '';
      try {
        const list = await request({ url: '/api/community/comments', data: { feed_id: feedId } });
        this.commentMap = { ...this.commentMap, [feedId]: list || [] };
      } catch (e) {}
    },
    async sendComment(feedId) {
      const text = (this.commentDraft || '').trim();
      if (!text) { uni.showToast({ title: '先写点什么吧', icon: 'none' }); return; }
      try {
        const c = await request({ url: '/api/community/comments', method: 'POST', data: { feed_id: feedId, text } });
        this.commentMap = { ...this.commentMap, [feedId]: [...(this.commentMap[feedId] || []), c] };
        this.commentDraft = '';
      } catch (e) {}
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
.tip-card { background: linear-gradient(135deg, rgba(255,215,64,0.10), var(--bg-card)); }
.tip-text { font-size: 25rpx; color: var(--text-2); line-height: 1.8; }

/* ===== 热门话题 ===== */
.topic-row { display: flex; justify-content: space-between; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid var(--line); }
.topic-row:last-child { border-bottom: none; }
.tp-info { flex: 1; }
.tp-tag { display: block; font-size: 27rpx; font-weight: 700; color: #FF6B35; }
.tp-desc { display: block; font-size: 21rpx; color: var(--text-3); margin-top: 4rpx; }
.tp-hot { font-size: 20rpx; color: var(--text-4); flex-shrink: 0; margin-left: 16rpx; }

/* ===== 动态流 ===== */
.feed-head { display: flex; justify-content: space-between; align-items: center; margin: 26rpx 28rpx 6rpx; }
.fh-title { font-size: 32rpx; font-weight: 800; color: var(--text-1); }
.fh-sub { font-size: 20rpx; color: var(--text-4); }
.feed-item { display: flex; flex-wrap: wrap; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid var(--line); }
.feed-item:last-child { border-bottom: none; }
.fi-left { display: flex; align-items: center; gap: 18rpx; flex: 1; min-width: 0; }
.fi-icon { font-size: 40rpx; }
.fi-info { flex: 1; min-width: 0; }
.fi-name { display: block; font-size: 28rpx; font-weight: 600; color: var(--text-1); }
.fi-serving { font-size: 20rpx; color: var(--text-4); font-weight: 400; }
.fi-meta { display: block; font-size: 21rpx; color: var(--text-3); margin-top: 4rpx; }
.fi-right { display: flex; align-items: center; gap: 16rpx; flex-shrink: 0; }
.fi-cal { font-size: 27rpx; font-weight: 800; color: #FF6B35; }
.fi-like { font-size: 34rpx; cursor: pointer; padding: 4rpx; }
.fi-like:active { transform: scale(1.25); }
/* 评论按钮：整行可点 */
.fi-cmt-btn { width: 100%; margin-top: 12rpx; font-size: 21rpx; color: var(--text-3); cursor: pointer; }
.fi-cmt-btn:active { color: #FF6B35; }
/* 评论区 */
.fi-comments { width: 100%; margin-top: 14rpx; background: var(--bg-soft); border-radius: 16rpx; padding: 16rpx 20rpx; }
.c-item { padding: 10rpx 0; border-bottom: 1rpx solid var(--line); }
.c-item:last-of-type { border-bottom: none; }
.c-author { font-size: 22rpx; font-weight: 700; color: #16A34A; margin-right: 12rpx; }
.c-text { font-size: 23rpx; color: var(--text-2); line-height: 1.6; }
.c-input-row { display: flex; align-items: center; gap: 12rpx; margin-top: 12rpx; }
.c-input { flex: 1; background: var(--bg-card); border-radius: 26rpx; padding: 12rpx 24rpx; font-size: 24rpx; color: var(--text-1); }
.c-send { font-size: 24rpx; font-weight: 700; color: #fff; background: linear-gradient(135deg, #34C77B, #22A05F); padding: 12rpx 28rpx; border-radius: 26rpx; cursor: pointer; }
.c-send:active { transform: scale(0.95); }

.empty-card { text-align: center; padding: 70rpx 28rpx; }
.empty-icon { display: block; font-size: 64rpx; margin-bottom: 14rpx; }
.empty-text { font-size: 26rpx; color: var(--text-3); }

.fab { position: fixed; bottom: 130rpx; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #34C77B, #22A05F); color: #fff; padding: 22rpx 52rpx; border-radius: 60rpx; display: flex; align-items: center; box-shadow: 0 12rpx 32rpx rgba(34,160,95,0.4); z-index: 999; cursor: pointer; }
.fab:active { transform: translateX(-50%) scale(0.95); }
.fab-icon { font-size: 38rpx; margin-right: 12rpx; }
.fab-text { font-size: 29rpx; font-weight: 700; }

@keyframes fadeUp { from { opacity: 0; transform: translateY(24rpx); } to { opacity: 1; transform: translateY(0); } }
</style>
