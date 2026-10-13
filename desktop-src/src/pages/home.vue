<template>
  <view class="page">
    <!-- 顶部渐变头部：问候 + 打卡火焰徽章 -->
    <view class="header">
      <view class="greeting">
        <text class="hello">{{ greeting }}，{{ nickname }}</text>
        <text class="date">{{ dateStr }}</text>
      </view>
      <view class="header-right">
        <view class="streak-badge" v-if="streak.streak > 0">
          <text class="streak-flame">🔥</text>
          <text class="streak-num">{{ streak.streak }}</text>
        </view>
        <view class="avatar" @click="toProfile">{{ avatarText }}</view>
      </view>
    </view>

    <!-- 体重管理方案（薄荷同款：初始 → 已减 → 目标） -->
    <view class="plan-card" v-if="weightPlan">
      <view class="plan-head">
        <text class="plan-title">⚖️ 体重管理方案</text>
        <text class="plan-goal-tag">目标 {{ weightPlan.target_weight }} kg</text>
      </view>
      <view class="plan-nums">
        <view class="pn-item">
          <text class="pn-val">{{ weightPlan.start_weight }}</text>
          <text class="pn-lbl">初始 kg</text>
        </view>
        <view class="pn-mid">
          <text class="pn-lost" :class="{ zero: weightPlan.lost <= 0 }">{{ weightPlan.lost > 0 ? '-' : '' }}{{ weightPlan.lost }}</text>
          <text class="pn-lbl">已减 kg</text>
        </view>
        <view class="pn-item">
          <text class="pn-val">{{ weightPlan.target_weight }}</text>
          <text class="pn-lbl">目标 kg</text>
        </view>
      </view>
    </view>

    <!-- ============ 热量仪表盘卡（薄荷风：大环 + 四迷你环） ============ -->
    <view class="dash-card">
      <view class="ring-wrap">
        <canvas canvas-id="calorieRing" design-width="220" design-height="220" class="ring-canvas"></canvas>
        <view class="ring-center">
          <text class="ring-num" :class="{ over: isOver }">{{ displayCal }}</text>
          <text class="ring-label">已摄入 / {{ target.calories }} kcal</text>
          <view class="remain-pill" :class="{ over: isOver }">
            <text>{{ isOver ? '超标 ' + (summary.calories - target.calories) : '还可吃 ' + remain }} kcal</text>
          </view>
        </view>
      </view>
      <!-- 四个 CSS 锥形渐变迷你环：蛋白/脂肪/碳水/饮水 -->
      <view class="mini-row">
        <view class="mini-item" v-for="m in miniRings" :key="m.name">
          <view class="mini-ring" :style="ringStyle(m.pct, m.color)">
            <text class="mini-emoji">{{ m.icon }}</text>
          </view>
          <text class="mini-val" :class="{ over: m.over }">{{ Math.round(m.cur) }}<text class="mini-unit">/{{ m.target }}g</text></text>
          <text class="mini-name">{{ m.name }}</text>
        </view>
      </view>
    </view>

    <!-- ============ 健康评分 + 打卡（渐变横幅风） ============ -->
    <view class="score-banner" :style="{ background: scoreBg }">
      <view class="sb-left">
        <view class="sb-ring">
          <view class="sb-ring-inner">
            <text class="sb-num">{{ score.score }}</text>
            <text class="sb-max">/100</text>
          </view>
        </view>
        <view class="sb-info">
          <text class="sb-grade">{{ score.grade }}</text>
          <text class="sb-streak" v-if="streak.todayLogged">已连续打卡 {{ streak.streak }} 天</text>
          <text class="sb-streak dim" v-else>已连 {{ streak.streak }} 天 · 今天记一笔续上</text>
        </view>
      </view>
      <view class="sb-tips">
        <text class="sb-tip" v-for="(t, i) in scoreTips" :key="i">{{ t }}</text>
        <text class="sb-tip good" v-if="!scoreTips.length && score.logged">各项达标，继续保持！</text>
      </view>
    </view>

    <!-- 轻断食入口（对标薄荷 16:8 主推位） -->
    <view class="fast-entry" @click="toFasting">
      <view class="fe-left">
        <text class="fe-title">⏱️ 轻断食</text>
        <text class="fe-sub">16:8 限时进食，给身体休息窗口</text>
      </view>
      <text class="fe-go">开始 ›</text>
    </view>

    <!-- ============ 常吃食物：彩色 emoji 网格 ============ -->
    <view class="card frequent-card" v-if="frequent.length">
      <view class="card-head">
        <text class="ch-icon">⚡</text>
        <text class="ch-title">常吃 · 一键记录</text>
        <text class="ch-sub">点击记入{{ activeTypeName }}</text>
      </view>
      <view class="freq-grid">
        <view class="freq-cell" v-for="f in frequent" :key="f.food_name" @click="quickAdd(f)">
          <view class="freq-emoji" :class="catClass(f.cat)">{{ f.emoji }}</view>
          <text class="freq-name">{{ shortName(f.food_name) }}</text>
          <text class="freq-cal">{{ Math.round(f.calories) }} kcal</text>
          <view class="freq-count">{{ f.count }}次</view>
        </view>
      </view>
    </view>

    <!-- ============ 食谱推荐横幅入口 ============ -->
    <view class="recipe-banner" @click="toRecipes">
      <view class="rb-text">
        <text class="rb-title">今日吃什么？</text>
        <text class="rb-sub">{{ goalLabel }}食谱已搭配好 →</text>
      </view>
      <text class="rb-emoji">🥗</text>
    </view>

    <!-- 饮水：波浪进度条 + 快捷按钮 -->
    <view class="card water-card2">
      <view class="card-head">
        <text class="ch-icon">💧</text>
        <text class="ch-title">饮水</text>
        <text class="ch-val">{{ summary.water }} / {{ target.water }} ml</text>
      </view>
      <view class="water-bar">
        <view class="water-fill" :style="{ width: waterPct + '%' }"></view>
      </view>
      <view class="water-actions">
        <view class="w-btn2" @click="addWater(200)">+200ml</view>
        <view class="w-btn2 primary" @click="addWater(250)">+250ml</view>
        <view class="w-btn2" @click="addWater(500)">+500ml</view>
      </view>
    </view>

    <!-- 运动：MET 库快捷记录，消耗参与热量平衡（运动×0.9 抵扣） -->
    <view class="card ex-card">
      <view class="card-head">
        <text class="ch-icon">🏃</text>
        <text class="ch-title">运动</text>
        <text class="ch-val orange" v-if="exCal > 0">今日消耗 {{ exCal }} kcal</text>
      </view>
      <scroll-view scroll-x class="ex-scroll">
        <view v-for="e in exLib" :key="e.type"
              class="ex-chip" :class="{ active: selEx === e.type }"
              @click="selEx = e.type">
          <text class="ex-icon">{{ e.icon }}</text>
          <text class="ex-name">{{ e.type }}</text>
        </view>
      </scroll-view>
      <view class="ex-actions">
        <view class="ex-btn" @click="quickExercise(15)">15分钟</view>
        <view class="ex-btn primary" @click="quickExercise(30)">30分钟</view>
        <view class="ex-btn" @click="quickExercise(60)">60分钟</view>
      </view>
      <view class="ex-list" v-if="(summary.exercises || []).length">
        <view class="ex-item" v-for="e in summary.exercises" :key="e.id">
          <text class="exi-text">{{ e.icon }} {{ e.type }} {{ e.minutes }}分钟</text>
          <view class="exi-right">
            <text class="exi-cal">-{{ e.calories }} kcal</text>
            <view class="exi-del" @click="delExercise(e)">✕</view>
          </view>
        </view>
      </view>
    </view>

    <!-- 餐次 -->
    <view class="card meal-card">
      <view class="card-head">
        <text class="ch-icon">🍽️</text>
        <text class="ch-title">今日饮食</text>
        <text class="ch-val orange">{{ summary.meals.length }} 项</text>
      </view>
      <view class="meal-type-row">
        <view v-for="t in mealTypes" :key="t.key"
              class="meal-type-item" :class="{active: activeType===t.key}"
              @click="activeType=t.key">
          <text class="mt-icon">{{ t.icon }}</text>
          <text class="mt-name">{{ t.name }}</text>
          <text class="mt-cal">{{ mealCal(t.key) }}</text>
        </view>
      </view>
      <view class="meal-list">
        <view v-if="filteredMeals.length===0" class="empty">
          <text class="empty-icon">🍳</text>
          <text class="empty-text">{{ activeTypeName }}还没有记录</text>
          <text class="empty-sub">拍照识别或点常吃食物快速记入</text>
        </view>
        <view v-for="m in filteredMeals" :key="m.id" class="meal-item">
          <view class="m-dot">•</view>
          <view class="m-info" @click="openEdit(m)">
            <text class="m-name">{{ m.food_name }}</text>
            <text class="m-meta">{{ m.serving_size }}{{ m.serving_unit || 'g' }} · 蛋白{{ m.protein }} 脂肪{{ m.fat }} 碳水{{ m.carbs }}</text>
          </view>
          <view class="m-right">
            <text class="m-cal">{{ m.calories }}</text>
            <view class="m-edit" @click="openEdit(m)">✎</view>
            <view class="m-del" @click="delMeal(m)">✕</view>
          </view>
        </view>
      </view>
    </view>

    <view style="height: 150rpx;"></view>

    <!-- 编辑记录弹窗：改分量（营养等比重算）+ 改餐次 -->
    <view class="edit-mask" v-if="editing" @click.self="editing = null">
      <view class="edit-dialog">
        <text class="ed-title">编辑记录</text>
        <text class="ed-name">{{ editing.food_name }}</text>
        <view class="ed-row">
          <text class="ed-lbl">分量({{ editing.serving_unit || 'g' }})</text>
          <view class="ed-stepper">
            <view class="ed-step" @click="adjustServing(-50)">−</view>
            <input class="ed-input" type="number" :value="editServing" @change="editServing = +$event.target.value" />
            <view class="ed-step" @click="adjustServing(50)">＋</view>
          </view>
        </view>
        <view class="ed-row">
          <text class="ed-lbl">餐次</text>
          <view class="ed-meals">
            <view v-for="t in mealTypes" :key="t.key"
                  class="ed-meal" :class="{ active: editMealType === t.key }"
                  @click="editMealType = t.key">{{ t.name }}</view>
          </view>
        </view>
        <text class="ed-hint">改分量后营养值自动等比重算</text>
        <view class="ed-btns">
          <view class="ed-btn cancel" @click="editing = null">取消</view>
          <view class="ed-btn ok" @click="saveEdit">保存</view>
        </view>
      </view>
    </view>

    <!-- 悬浮拍照按钮 -->
    <view class="fab" @click="toScan">
      <text class="fab-icon">📷</text>
      <text class="fab-text">拍照记录</text>
    </view>
  </view>
</template>

<script>
import { request } from '../js/request.js';
import { EXERCISE_DB } from '../js/mock.js';
const MEAL_NAMES = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
const GOAL_NAMES = { lose: '减脂', maintain: '均衡', gain: '增肌' };
export default {
  data() {
    return {
      nickname: '',
      avatarText: 'U',
      goalLabel: '均衡',
      dateStr: '',
      greeting: '你好',
      activeType: '',
      mealTypes: [
        { key: 'breakfast', name: '早餐', icon: '🌅' },
        { key: 'lunch', name: '午餐', icon: '☀️' },
        { key: 'dinner', name: '晚餐', icon: '🌙' },
        { key: 'snack', name: '加餐', icon: '🍪' },
      ],
      summary: { calories: 0, protein: 0, fat: 0, carbs: 0, water: 0, exercise_calories: 0, exercises: [], meals: [] },
      target: { calories: 2000, protein: 120, fat: 60, carbs: 260, water: 2000 },
      // 体重管理方案（初始→已减→目标）
      weightPlan: null,
      // 运动：MET 库 + 选中项
      exLib: EXERCISE_DB,
      selEx: '快走',
      // 健康评分（{score, grade, logged, items}）与连续打卡（{streak, todayLogged}）
      score: { score: 0, grade: '—', logged: false, items: [] },
      streak: { streak: 0, todayLogged: false },
      // 常吃食物列表（按历史频次聚合的前 8 名）
      frequent: [],
      // 热量数字滚动动画的显示值
      displayCal: 0,
      // 当前编辑的记录（null=弹窗关闭）
      editing: null,
      editServing: 100,
      editMealType: 'lunch',
    };
  },
  computed: {
    // 热量平衡（薄荷同款）：还可吃 = 目标 - 摄入 + 运动×0.9（运动返还打九折防"越练越吃"）
    remain() {
      return Math.max(0, Math.round(this.target.calories - this.summary.calories + (this.summary.exercise_calories || 0) * 0.9));
    },
    isOver() {
      return this.summary.calories - (this.summary.exercise_calories || 0) * 0.9 > this.target.calories;
    },
    // 今日运动总消耗
    exCal() { return this.summary.exercise_calories || 0; },
    activeTypeName() { return MEAL_NAMES[this.activeType] || ''; },
    filteredMeals() {
      return (this.summary.meals || []).filter(m => m.meal_type === this.activeType);
    },
    // 迷你环数据：四大指标占比 + 颜色
    miniRings() {
      return [
        { name: '蛋白质', icon: '🥩', cur: this.summary.protein, target: this.target.protein, color: '#FF6B35' },
        { name: '脂肪', icon: '🥑', cur: this.summary.fat, target: this.target.fat, color: '#FFB020' },
        { name: '碳水', icon: '🍚', cur: this.summary.carbs, target: this.target.carbs, color: '#4ECDC4' },
        { name: '饮水', icon: '💧', cur: this.summary.water, target: this.target.water, color: '#3D9BFF', isWater: true },
      ].map(m => ({ ...m, pct: m.target > 0 ? Math.min(100, Math.round(m.cur / m.target * 100)) : 0, over: m.cur > m.target }));
    },
    // 饮水进度百分比
    waterPct() {
      return this.target.water > 0 ? Math.min(100, Math.round(this.summary.water / this.target.water * 100)) : 0;
    },
    // 从评分明细里挑出最弱的 2 条建议（按得分率升序 = 最短板优先）
    scoreTips() {
      return this.score.items
        .filter(it => it.tip)
        .sort((a, b) => (a.score / a.max) - (b.score / b.max))
        .slice(0, 2)
        .map(it => `${it.label}：${it.tip}`);
    },
    // 评分色：绿→黄→橙→红
    scoreColor() {
      const s = this.score.score;
      if (s >= 85) return '#22C55E';
      if (s >= 70) return '#F59E0B';
      if (s >= 50) return '#FF8F5E';
      return '#FF4D4F';
    },
    // 评分横幅背景：按等级给渐变底色
    scoreBg() {
      const s = this.score.score;
      if (s >= 85) return 'linear-gradient(135deg, #ECFDF5, #fff)';
      if (s >= 70) return 'linear-gradient(135deg, #FFFBEB, #fff)';
      if (s >= 50) return 'linear-gradient(135deg, #FFF5EF, #fff)';
      return 'linear-gradient(135deg, #FEF2F2, #fff)';
    },
  },
  watch: {
    // 热量数字滚动动画：summary 变化时平滑过渡
    'summary.calories'(val) { this.animateNumber('displayCal', val); },
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
      this.goalLabel = GOAL_NAMES[user.goal] || '均衡';
      const h = new Date().getHours();
      this.greeting = h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
      this.dateStr = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
      try {
        const s = await request({ url: '/api/stats/today' });
        this.summary = { calories: 0, protein: 0, fat: 0, carbs: 0, water: 0, meals: [], ...s };
        this.target = s.target;
        this.$nextTick(() => this.drawRing());
      } catch (e) { console.error(e); }
      // 三个新数据源并行拉取，互不阻塞（失败不影响主数据展示）
      request({ url: '/api/health-score' }).then(r => { this.score = r; }).catch(() => {});
      request({ url: '/api/streak' }).then(r => { this.streak = r; }).catch(() => {});
      request({ url: '/api/meals/frequent' }).then(r => { this.frequent = r || []; }).catch(() => {});
      request({ url: '/api/weight/plan' }).then(r => { this.weightPlan = r; }).catch(() => {});
    },
    // 数字滚动动画：从当前值平滑滚到目标值（600ms，缓出）
    animateNumber(key, target) {
      const from = this[key] || 0;
      const delta = target - from;
      if (delta === 0) return;
      const start = performance.now();
      const dur = 600;
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        // easeOutCubic 缓动
        const e = 1 - Math.pow(1 - t, 3);
        this[key] = Math.round(from + delta * e);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    // 迷你环样式：锥形渐变 + 圆环遮罩（CSS 实现，无 canvas 开销）
    ringStyle(pct, color) {
      const deg = Math.round(pct * 3.6);
      return {
        background: `conic-gradient(${color} 0deg ${deg}deg, #F0F1F5 ${deg}deg 360deg)`,
      };
    },
    drawRing() {
      const ctx = uni.createCanvasContext('calorieRing', this);
      const w = 220, cx = w / 2, cy = w / 2, r = 88, lineW = 18;
      const pct = this.target.calories > 0 ? Math.min(this.summary.calories / this.target.calories, 1) : 0;
      ctx.clearRect(0, 0, w, w);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.setStrokeStyle('#F0F1F5');
      ctx.setLineWidth(lineW);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      const grad = ctx.createLinearGradient(0, 0, w, w);
      if (this.isOver) {
        grad.addColorStop(0, '#FF4D4F'); grad.addColorStop(1, '#FF7A5E');
      } else {
        grad.addColorStop(0, '#FF6B35'); grad.addColorStop(1, '#FFA05E');
      }
      ctx.setStrokeStyle(grad);
      ctx.setLineWidth(lineW);
      ctx.setLineCap('round');
      ctx.stroke();
      ctx.draw();
    },
    mealCal(key) {
      return (this.summary.meals || []).filter(m => m.meal_type === key).reduce((s, m) => s + m.calories, 0).toFixed(0);
    },
    // 常吃食物名截断（网格内过长换行难看）
    shortName(name) {
      return name.length > 6 ? name.slice(0, 6) + '…' : name;
    },
    // 分类 → 配色类名
    catClass(cat) {
      const map = { '主食': 'c-staple', '肉蛋': 'c-meat', '蔬菜': 'c-veg', '水果': 'c-fruit', '饮品': 'c-drink', '快餐': 'c-fast' };
      return map[cat] || 'c-other';
    },
    addWater(amount) {
      request({ url: '/api/water', method: 'POST', data: { amount } }).then(r => {
        this.summary.water = r.today_total;
        uni.showToast({ title: '已记录 ' + amount + 'ml', icon: 'success' });
      });
    },
    // 常吃食物一键记录：沿用该食物上次记录的营养档案，直接入当前时段餐次
    quickAdd(f) {
      const mealType = this.activeType;
      const mealNames = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
      request({
        url: '/api/meals', method: 'POST',
        data: {
          food_name: f.food_name, meal_type: mealType,
          serving_size: f.serving_size, serving_unit: f.serving_unit,
          calories: f.calories, protein: f.protein, fat: f.fat,
          carbs: f.carbs, fiber: f.fiber, sodium: f.sodium,
          confidence: f.confidence,
        },
      }).then(() => {
        uni.showToast({ title: `已记入${mealNames[mealType]}`, icon: 'success' });
        this.loadData(); // 刷新统计/评分/打卡（常吃频次也会 +1）
      }).catch(() => {
        uni.showToast({ title: '记录失败，请重试', icon: 'none' });
      });
    },
    // 跳转食谱推荐页
    toRecipes() { uni.navigateTo({ url: '/pages/recipes/recipes' }); },
    // 跳转轻断食计时器
    toFasting() { uni.navigateTo({ url: '/pages/fasting/fasting' }); },
    // ===== 运动 =====
    // 快捷记录：选中的运动 + 指定时长，MET 公式由服务端（mock）按体重折算
    quickExercise(minutes) {
      request({ url: '/api/exercises', method: 'POST', data: { type: this.selEx, minutes } }).then(() => {
        uni.showToast({ title: `已记录${this.selEx}${minutes}分钟`, icon: 'success' });
        this.loadData();
      }).catch(() => {
        uni.showToast({ title: '记录失败，请重试', icon: 'none' });
      });
    },
    delExercise(e) {
      request({ url: `/api/exercises/${e.id}`, method: 'DELETE' }).then(() => this.loadData());
    },
    // ===== 编辑记录 =====
    openEdit(m) {
      this.editing = m;
      this.editServing = m.serving_size;
      this.editMealType = m.meal_type;
    },
    // 步进器调整分量，每步 50，最小 10
    adjustServing(delta) {
      this.editServing = Math.max(10, Math.min(2000, (this.editServing || 0) + delta));
    },
    async saveEdit() {
      const m = this.editing;
      if (!m) return;
      const s = Math.max(1, Math.min(2000, +this.editServing || m.serving_size));
      try {
        await request({ url: `/api/meals/${m.id}`, method: 'PUT', data: { serving_size: s, meal_type: this.editMealType } });
        this.editing = null;
        uni.showToast({ title: '已更新', icon: 'success' });
        this.loadData();
      } catch (e) {
        uni.showToast({ title: '保存失败，请重试', icon: 'none' });
      }
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
.page { min-height: 100vh; background: #F4F5F7; padding-bottom: 40rpx; }

/* ===== 头部 ===== */
.header { padding: 100rpx 32rpx 70rpx; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(150deg, #FF7A45 0%, #FF6B35 45%, #FF5E3A 100%); border-radius: 0 0 44rpx 44rpx; }
.greeting { color: #fff; }
.hello { display: block; font-size: 42rpx; font-weight: 800; letter-spacing: 1rpx; }
.date { display: block; font-size: 24rpx; opacity: 0.85; margin-top: 8rpx; }
.header-right { display: flex; align-items: center; gap: 16rpx; }
/* 打卡火焰徽章：天数>0 时头部常驻 */
.streak-badge { background: rgba(255,255,255,0.22); border-radius: 40rpx; padding: 8rpx 20rpx; display: flex; align-items: center; gap: 6rpx; }
.streak-flame { font-size: 28rpx; }
.streak-num { color: #fff; font-size: 28rpx; font-weight: 800; }
.avatar { width: 84rpx; height: 84rpx; border-radius: 50%; background: rgba(255,255,255,0.3); color: #fff; font-size: 38rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 3rpx solid rgba(255,255,255,0.5); }

/* ===== 仪表盘卡 ===== */
.dash-card { margin: -50rpx 24rpx 0; background: #fff; border-radius: 32rpx; padding: 44rpx 28rpx 36rpx; box-shadow: 0 12rpx 40rpx rgba(255,107,53,0.12); position: relative; }
.ring-wrap { position: relative; width: 420rpx; height: 420rpx; margin: 0 auto; }
.ring-canvas { width: 420rpx; height: 420rpx; }
.ring-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); text-align: center; }
.ring-num { display: block; font-size: 76rpx; font-weight: 800; color: #1a1a1a; font-variant-numeric: tabular-nums; }
.ring-num.over { color: #FF4D4F; }
.ring-label { display: block; font-size: 22rpx; color: #999; margin-top: 6rpx; }
/* 剩余热量药丸：比纯文字更醒目 */
.remain-pill { margin: 14rpx auto 0; background: #FFF3ED; color: #FF6B35; font-size: 22rpx; font-weight: 700; padding: 8rpx 24rpx; border-radius: 30rpx; display: inline-block; }
.remain-pill.over { background: #FEF2F2; color: #FF4D4F; }

/* 四迷你环行 */
.mini-row { display: flex; justify-content: space-around; margin-top: 36rpx; padding-top: 30rpx; border-top: 1rpx solid #F4F5F7; }
.mini-item { text-align: center; }
/* 迷你环：锥形渐变底 + 圆心遮罩挖洞，中心放 emoji（圆心色跟随卡片底色） */
.mini-ring { width: 88rpx; height: 88rpx; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; position: relative; transition: background 0.6s; }
.mini-ring::before { content: ''; position: absolute; inset: 9rpx; background: var(--bg-card); border-radius: 50%; }
.mini-emoji { position: relative; font-size: 30rpx; }
.mini-val { display: block; font-size: 26rpx; font-weight: 800; color: var(--text-1); margin-top: 10rpx; font-variant-numeric: tabular-nums; }
.mini-val.over { color: #FF4D4F; }
.mini-unit { font-size: 18rpx; color: #bbb; font-weight: 400; }
.mini-name { display: block; font-size: 20rpx; color: #999; margin-top: 2rpx; }

/* ===== 主题适配：卡片/文字走变量 ===== */
.card { background: var(--bg-card); border-radius: 28rpx; padding: 30rpx 28rpx; margin: 22rpx 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04); }
.card-head { display: flex; align-items: center; gap: 12rpx; margin-bottom: 22rpx; }
.ch-icon { font-size: 30rpx; }
.ch-title { font-size: 30rpx; font-weight: 800; color: var(--text-1); flex: 1; }
.ch-sub { font-size: 20rpx; color: var(--text-4); }
.ch-val { font-size: 24rpx; color: #4ECDC4; font-weight: 700; }
.ch-val.orange { color: #FF6B35; }

/* ===== 评分横幅 ===== */
.score-banner { margin: 22rpx 24rpx; border-radius: 28rpx; padding: 30rpx 28rpx; display: flex; gap: 24rpx; align-items: center; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04); animation: fadeUp .4s ease both; }
.sb-left { display: flex; align-items: center; gap: 20rpx; flex-shrink: 0; }
/* 评分环：锥形渐变 + 内圆挖洞 */
.sb-ring { width: 120rpx; height: 120rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; position: relative; transition: background 0.6s; }
.sb-ring-inner { position: absolute; inset: 10rpx; background: var(--bg-card); border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.sb-num { font-size: 40rpx; font-weight: 800; line-height: 1; color: var(--text-1); }
.sb-max { font-size: 16rpx; color: #bbb; margin-top: 2rpx; }
.sb-info { display: flex; flex-direction: column; gap: 8rpx; }
.sb-grade { background: #1a1a1a; color: #fff; font-size: 22rpx; font-weight: 700; padding: 4rpx 18rpx; border-radius: 20rpx; align-self: flex-start; }
.sb-streak { font-size: 24rpx; color: #FF6B35; font-weight: 700; }
.sb-streak.dim { color: #999; font-weight: 400; }
.sb-tips { flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.sb-tip { font-size: 21rpx; color: #8a6a1f; background: var(--bg-card); padding: 8rpx 16rpx; border-radius: 12rpx; line-height: 1.5; }
.sb-tip.good { color: #1f8a70; }

/* ===== 常吃食物网格 ===== */
.frequent-card { animation: fadeUp .45s ease both; }
.freq-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16rpx; }
.freq-cell { background: var(--bg-soft); border-radius: 20rpx; padding: 18rpx 8rpx 14rpx; text-align: center; position: relative; cursor: pointer; transition: transform .15s; }
.freq-cell:active { transform: scale(0.94); background: #FFF3ED; }
/* emoji 彩色底：按分类给不同渐变底色，一眼可辨 */
.freq-emoji { width: 72rpx; height: 72rpx; margin: 0 auto; border-radius: 22rpx; display: flex; align-items: center; justify-content: center; font-size: 38rpx; }
.c-staple { background: linear-gradient(135deg, #FFF6E5, #FFEDD1); }
.c-meat { background: linear-gradient(135deg, #FFEEE8, #FFDCD1); }
.c-veg { background: linear-gradient(135deg, #E8FBF0, #D1F5E0); }
.c-fruit { background: linear-gradient(135deg, #FFEBE8, #FFD6D6); }
.c-drink { background: linear-gradient(135deg, #E8F4FF, #D1E8FF); }
.c-fast { background: linear-gradient(135deg, #FFF3E0, #FFE7BF); }
.c-other { background: linear-gradient(135deg, #F3F4F6, #E9EBEF); }
.freq-name { display: block; font-size: 22rpx; font-weight: 600; color: var(--text-1); margin-top: 10rpx; white-space: nowrap; overflow: hidden; }
.freq-cal { display: block; font-size: 19rpx; color: #FF6B35; font-weight: 700; margin-top: 2rpx; }
.freq-count { position: absolute; top: 8rpx; right: 10rpx; font-size: 16rpx; color: var(--text-4); }

/* ===== 食谱横幅入口 ===== */
.recipe-banner { margin: 22rpx 24rpx; background: linear-gradient(120deg, #22C55E, #16A34A); border-radius: 28rpx; padding: 32rpx 34rpx; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 8rpx 24rpx rgba(34,197,94,0.3); cursor: pointer; animation: fadeUp .5s ease both; }
.recipe-banner:active { transform: scale(0.985); }
.rb-title { display: block; color: #fff; font-size: 32rpx; font-weight: 800; }
.rb-sub { display: block; color: rgba(255,255,255,0.85); font-size: 23rpx; margin-top: 6rpx; }
.rb-emoji { font-size: 64rpx; }

/* ===== 轻断食入口（绿青色与食谱横幅区分） ===== */
.fast-entry { margin: 22rpx 24rpx; background: linear-gradient(120deg, #0EA5E9, #0284C7); border-radius: 28rpx; padding: 30rpx 34rpx; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 8rpx 24rpx rgba(2,132,199,0.28); cursor: pointer; animation: fadeUp .45s ease both; }
.fast-entry:active { transform: scale(0.985); }
.fe-title { display: block; color: #fff; font-size: 32rpx; font-weight: 800; }
.fe-sub { display: block; color: rgba(255,255,255,0.85); font-size: 22rpx; margin-top: 6rpx; }
.fe-go { color: #fff; font-size: 26rpx; font-weight: 700; background: rgba(255,255,255,0.2); padding: 10rpx 24rpx; border-radius: 30rpx; }

/* ===== 饮水 ===== */
.water-card2 { animation: fadeUp .55s ease both; }
.water-bar { height: 20rpx; background: var(--bg-input); border-radius: 12rpx; overflow: hidden; }
.water-fill { height: 100%; background: linear-gradient(90deg, #6FBCFF, #3D9BFF); border-radius: 12rpx; transition: width .5s ease; }
.water-actions { display: flex; gap: 14rpx; margin-top: 22rpx; }
.w-btn2 { flex: 1; text-align: center; padding: 16rpx 0; background: var(--bg-input); color: #3D9BFF; border-radius: 40rpx; font-size: 26rpx; font-weight: 700; cursor: pointer; transition: transform .15s; }
.w-btn2:active { transform: scale(0.95); }
.w-btn2.primary { background: linear-gradient(135deg, #6FBCFF, #3D9BFF); color: #fff; }

/* ===== 餐次与列表 ===== */
.meal-card { animation: fadeUp .6s ease both; }
.meal-type-row { display: flex; justify-content: space-between; margin-bottom: 20rpx; gap: 10rpx; }
.meal-type-item { flex: 1; text-align: center; padding: 16rpx 0; border-radius: 18rpx; background: var(--bg-input); margin: 0; transition: background .2s; }
.meal-type-item.active { background: #FFF0E8; }
.mt-icon { display: block; font-size: 30rpx; }
.mt-name { display: block; font-size: 23rpx; color: var(--text-1); margin-top: 4rpx; }
.meal-type-item.active .mt-name { color: #FF6B35; font-weight: 700; }
.mt-cal { display: block; font-size: 19rpx; color: var(--text-3); margin-top: 2rpx; }
.meal-type-item.active .mt-cal { color: #FF8F5E; }

.empty { text-align: center; color: var(--text-4); padding: 50rpx 0; }
.empty-icon { display: block; font-size: 64rpx; margin-bottom: 14rpx; }
.empty-text { display: block; font-size: 27rpx; color: var(--text-3); }
.empty-sub { display: block; font-size: 21rpx; color: var(--text-4); margin-top: 8rpx; }

.meal-item { display: flex; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid var(--line); }
.meal-item:last-child { border-bottom: none; }
.m-dot { color: #FFB088; font-size: 32rpx; margin-right: 16rpx; }
.m-info { flex: 1; }
.m-name { display: block; font-size: 28rpx; font-weight: 600; color: var(--text-1); }
.m-meta { display: block; font-size: 21rpx; color: var(--text-3); margin-top: 4rpx; }
.m-right { display: flex; align-items: center; gap: 18rpx; }
.m-cal { font-size: 30rpx; font-weight: 800; color: #FF6B35; }
.m-cal::after { content: ' kcal'; font-size: 17rpx; color: var(--text-4); font-weight: 400; }
.m-edit { font-size: 24rpx; color: #8ab4ff; background: #EDF4FF; width: 48rpx; height: 48rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.m-edit:active { background: #D6E7FF; }
.m-del { font-size: 24rpx; color: var(--text-4); background: var(--bg-input); width: 48rpx; height: 48rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.m-del:active { background: #FFE5E5; color: #FF4D4F; }

/* ===== 编辑弹窗 ===== */
.edit-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 9999; display: flex; align-items: center; justify-content: center; }
.edit-dialog { width: 82%; max-width: 400px; background: #fff; border-radius: 32rpx; padding: 40rpx 36rpx 32rpx; animation: fadeUp .25s ease both; }
.ed-title { display: block; font-size: 32rpx; font-weight: 800; color: #1a1a1a; text-align: center; }
.ed-name { display: block; font-size: 26rpx; color: #FF6B35; font-weight: 700; text-align: center; margin-top: 8rpx; }
.ed-row { display: flex; align-items: center; margin-top: 30rpx; }
.ed-lbl { width: 150rpx; font-size: 26rpx; color: #666; }
.ed-stepper { flex: 1; display: flex; align-items: center; gap: 12rpx; }
.ed-step { width: 64rpx; height: 64rpx; border-radius: 16rpx; background: #F4F5F7; color: #333; font-size: 36rpx; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.ed-step:active { background: #FFE8DD; color: #FF6B35; }
.ed-input { flex: 1; height: 64rpx; text-align: center; font-size: 30rpx; font-weight: 700; background: #FAFBFC; border-radius: 12rpx; }
.ed-meals { flex: 1; display: flex; gap: 10rpx; flex-wrap: wrap; }
.ed-meal { padding: 12rpx 22rpx; background: #F4F5F7; border-radius: 30rpx; font-size: 24rpx; color: #666; cursor: pointer; }
.ed-meal.active { background: #FFF0E8; color: #FF6B35; font-weight: 700; }
.ed-hint { display: block; font-size: 20rpx; color: #bbb; margin-top: 20rpx; text-align: center; }
.ed-btns { display: flex; gap: 20rpx; margin-top: 30rpx; }
.ed-btn { flex: 1; text-align: center; padding: 20rpx 0; border-radius: 40rpx; font-size: 28rpx; font-weight: 700; cursor: pointer; }
.ed-btn.cancel { background: #F4F5F7; color: #666; }
.ed-btn.ok { background: linear-gradient(135deg, #FF7A45, #FF5E3A); color: #fff; }

/* ===== 悬浮按钮 ===== */
.fab { position: fixed; bottom: 130rpx; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #FF7A45, #FF5E3A); color: #fff; padding: 22rpx 52rpx; border-radius: 60rpx; display: flex; align-items: center; box-shadow: 0 12rpx 32rpx rgba(255,94,58,0.42); z-index: 999; cursor: pointer; transition: transform .15s; }
.fab:active { transform: translateX(-50%) scale(0.95); }
.fab-icon { font-size: 38rpx; margin-right: 12rpx; }
.fab-text { font-size: 29rpx; font-weight: 700; }

/* ===== 体重管理方案卡（绿系，与薄荷一致的健康感） ===== */
.plan-card { margin: 22rpx 24rpx -6rpx; background: linear-gradient(135deg, #EAF9F0, #fff); border-radius: 28rpx; padding: 28rpx 30rpx; box-shadow: 0 4rpx 20rpx rgba(34,197,94,0.10); animation: fadeUp .35s ease both; }
.plan-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18rpx; }
.plan-title { font-size: 28rpx; font-weight: 800; color: #166534; }
.plan-goal-tag { font-size: 20rpx; color: #16A34A; background: #D9F5E5; padding: 4rpx 16rpx; border-radius: 20rpx; font-weight: 700; }
.plan-nums { display: flex; justify-content: space-around; align-items: center; }
.pn-item { text-align: center; }
.pn-val { display: block; font-size: 40rpx; font-weight: 800; color: #1a1a1a; }
.pn-mid { text-align: center; }
.pn-lost { display: block; font-size: 48rpx; font-weight: 800; color: #16A34A; }
.pn-lost.zero { color: #9CA3AF; }
.pn-lbl { display: block; font-size: 20rpx; color: #86A694; margin-top: 4rpx; }

/* ===== 运动卡 ===== */
.ex-card { animation: fadeUp .5s ease both; }
.ex-scroll { white-space: nowrap; }
.ex-chip { display: inline-flex; flex-direction: column; align-items: center; background: var(--bg-input); border-radius: 18rpx; padding: 14rpx 22rpx; margin-right: 14rpx; cursor: pointer; transition: all .15s; }
.ex-chip.active { background: #FFF0E8; box-shadow: inset 0 0 0 3rpx #FF6B35; }
.ex-icon { font-size: 30rpx; }
.ex-name { font-size: 20rpx; color: var(--text-2); margin-top: 4rpx; }
.ex-chip.active .ex-name { color: #FF6B35; font-weight: 700; }
.ex-actions { display: flex; gap: 14rpx; margin-top: 20rpx; }
.ex-btn { flex: 1; text-align: center; padding: 16rpx 0; background: var(--bg-input); color: var(--text-2); border-radius: 40rpx; font-size: 26rpx; font-weight: 700; cursor: pointer; transition: transform .15s; }
.ex-btn:active { transform: scale(0.95); }
.ex-btn.primary { background: linear-gradient(135deg, #FF7A45, #FF5E3A); color: #fff; }
.ex-list { margin-top: 18rpx; border-top: 1rpx solid var(--line); padding-top: 8rpx; }
.ex-item { display: flex; justify-content: space-between; align-items: center; padding: 12rpx 0; }
.exi-text { font-size: 24rpx; color: var(--text-1); }
.exi-right { display: flex; align-items: center; gap: 14rpx; }
.exi-cal { font-size: 24rpx; color: #16A34A; font-weight: 700; }
.exi-del { font-size: 20rpx; color: var(--text-4); background: var(--bg-input); width: 40rpx; height: 40rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }

/* 卡片渐入动画：自下而上淡入 */
@keyframes fadeUp { from { opacity: 0; transform: translateY(24rpx); } to { opacity: 1; transform: translateY(0); } }
</style>
