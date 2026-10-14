<template>
  <view class="page">
    <view class="top-bar" :class="score.level">
      <view class="nav-row">
        <text class="back" @click="goBack">‹</text>
        <text class="page-title">食物详情</text>
        <text class="cmp-btn" @click="startCompare">{{ compareWith ? '退出对比' : '⚖️ 对比' }}</text>
      </view>
      <text class="food-name">{{ food.name }}</text>
      <view class="score-row">
        <view class="score-circle">
          <text class="sc-num">{{ score.score }}</text>
          <text class="sc-max">/100</text>
        </view>
        <view class="score-info">
          <text class="level-tag">{{ score.levelName }}</text>
          <text class="sc-advice">{{ score.advice }}</text>
        </view>
      </view>
    </view>

    <!-- 对比模式：搜索另一个食物 → 显示六项营养对比条 -->
    <view class="card cmp-card" v-if="comparing">
      <view class="card-title">⚖️ 选择对比食物</view>
      <view class="cmp-search">
        <input v-model="compareKw" placeholder="输入食物名，如：糙米饭" @input="onCmpInput" />
      </view>
      <view class="cmp-list" v-if="cmpResults.length">
        <view v-for="f in cmpResults" :key="f.name" class="cmp-item" @click="pickCompare(f)">
          <text class="ci-name">{{ f.name }}</text>
          <text class="ci-cat">{{ f.cat }} · {{ f.calories }}kcal/100g</text>
        </view>
      </view>
    </view>

    <!-- 对比结果：两列头部 + 六项营养归一化对比条 -->
    <view class="card cmp-result" v-if="compareWith">
      <view class="cr-head">
        <view class="cr-side">
          <text class="cr-name">{{ food.name }}</text>
          <view class="cr-score" :class="score.level">{{ score.score }}</view>
        </view>
        <text class="cr-vs">VS</text>
        <view class="cr-side">
          <text class="cr-name">{{ compareWith.name }}</text>
          <view class="cr-score" :class="cmpScore.level">{{ cmpScore.score }}</view>
        </view>
      </view>
      <view class="cr-row" v-for="row in cmpRows" :key="row.name">
        <text class="cr-lbl">{{ row.name }}</text>
        <view class="cr-bars">
          <view class="cr-bar a" :style="{ width: row.pctA + '%' }"></view>
          <text class="cr-val">{{ row.valA }}</text>
          <view class="cr-bar b" :style="{ width: row.pctB + '%' }"></view>
          <text class="cr-val b">{{ row.valB }}</text>
        </view>
      </view>
      <text class="cr-note">两列均为每{{ food.unit }}含量；条长按两者中较大值归一化，谁的条长谁含量高</text>
      <view class="cr-verdict" v-if="cmpVerdict">{{ cmpVerdict }}</view>
    </view>

    <!-- 核心营养素（每100g/100ml可食部分） -->
    <view class="card">
      <view class="card-title">📊 营养成分 <text class="ct-unit">每{{ food.unit }}可食部分</text></view>
      <view class="nut-grid">
        <view class="nut-item">
          <text class="n-val orange">{{ food.calories }}</text>
          <text class="n-lbl">热量 kcal</text>
        </view>
        <view class="nut-item">
          <text class="n-val">{{ food.protein }}</text>
          <text class="n-lbl">蛋白质 g</text>
        </view>
        <view class="nut-item">
          <text class="n-val">{{ food.fat }}</text>
          <text class="n-lbl">脂肪 g</text>
        </view>
        <view class="nut-item">
          <text class="n-val">{{ food.carbs }}</text>
          <text class="n-lbl">碳水 g</text>
        </view>
        <view class="nut-item">
          <text class="n-val">{{ food.fiber }}</text>
          <text class="n-lbl">纤维 g</text>
        </view>
        <view class="nut-item">
          <text class="n-val">{{ food.sodium }}</text>
          <text class="n-lbl">钠 mg</text>
        </view>
      </view>
    </view>

    <!-- NRV 占比：一份食物占每日推荐量的比例（按 2000kcal 成人日需） -->
    <view class="card">
      <view class="card-title">📋 占每日推荐量（NRV）</view>
      <view class="nrv-row" v-for="n in nrvList" :key="n.name">
        <text class="nrv-name">{{ n.name }}</text>
        <view class="nrv-bar"><view class="nrv-fill" :style="{ width: Math.min(n.pct, 100) + '%', background: n.color }"></view></view>
        <text class="nrv-pct">{{ n.pct }}%</text>
      </view>
      <text class="nrv-note">按成人每日 2000 kcal 需求估算；条越长代表吃这个食物占全天配额越多</text>
    </view>

    <!-- 营养点评 -->
    <view class="card">
      <view class="card-title">💬 营养点评</view>
      <view class="pc-row" v-for="(p, i) in score.pros" :key="'p' + i">
        <text class="pc-icon good">＋</text>
        <text class="pc-text">{{ p }}</text>
      </view>
      <view class="pc-row" v-for="(c, i) in score.cons" :key="'c' + i">
        <text class="pc-icon warn">−</text>
        <text class="pc-text">{{ c }}</text>
      </view>
      <view class="pc-row" v-if="!score.pros.length && !score.cons.length">
        <text class="pc-icon good">＋</text>
        <text class="pc-text">营养构成均衡，无明显短板</text>
      </view>
    </view>

    <!-- 快捷记录：记 100g/100ml -->
    <button class="quick-btn" @click="quickAdd">⚡ 快捷记录一份（{{ food.unit }}）</button>

    <view style="height: 60rpx;"></view>
  </view>
</template>

<script>
import { FOOD_DB_EXTENDED, scoreFood, searchFood } from '../js/food-db.js';
import { request } from '../js/request.js';

// NRV 基准值（GB 28050 国标）：热量 8400kJ≈2000kcal、蛋白 60g、脂肪 60g、碳水 300g、钠 2000mg
const NRV = { calories: 2000, protein: 60, fat: 60, carbs: 300, sodium: 2000 };

export default {
  data() {
    return {
      food: { name: '', cat: '', calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sodium: 0, unit: '100g' },
      // 对比模式状态：comparing=显示搜索框；compareWith=已选对比食物
      comparing: false,
      compareWith: null,
      compareKw: '',
      cmpResults: [],
    };
  },
  computed: {
    score() { return scoreFood(this.food); },
    // 对比食物的评分（未选时给空对象避免模板报错）
    cmpScore() { return this.compareWith ? scoreFood(this.compareWith) : { score: 0, level: 'green' }; },
    // 六项营养归一化对比行：条长按两者较大值归一（较大=100%）
    cmpRows() {
      if (!this.compareWith) return [];
      const a = this.food, b = this.compareWith;
      const defs = [
        { name: '热量 kcal', key: 'calories' },
        { name: '蛋白质 g', key: 'protein' },
        { name: '脂肪 g', key: 'fat' },
        { name: '碳水 g', key: 'carbs' },
        { name: '膳食纤维 g', key: 'fiber' },
        { name: '钠 mg', key: 'sodium' },
      ];
      return defs.map(d => {
        const va = +(a[d.key] || 0), vb = +(b[d.key] || 0);
        const mx = Math.max(va, vb, 0.0001);
        return { name: d.name, valA: va, valB: vb, pctA: Math.round(va / mx * 100), pctB: Math.round(vb / mx * 100) };
      });
    },
    // 一句话结论：综合评分谁高推荐谁，同分则并列
    cmpVerdict() {
      if (!this.compareWith) return '';
      const sa = this.score.score, sb = this.cmpScore.score;
      if (Math.abs(sa - sb) < 3) return `两者评分接近（${sa} vs ${sb}），按口味选择即可，注意分量`;
      const win = sa > sb ? this.food : this.compareWith;
      const lose = sa > sb ? this.compareWith : this.food;
      return `综合来看「${win.name}」营养构成更好（${Math.max(sa, sb)} vs ${Math.min(sa, sb)} 分），「${lose.name}」注意控制频率和分量`;
    },
    // NRV 每日推荐量占比（GB 28050 基准）
    nrvList() {
      const f = this.food;
      return [
        { name: '热量', pct: Math.round(f.calories / NRV.calories * 100), color: '#FF6B35' },
        { name: '蛋白质', pct: Math.round(f.protein / NRV.protein * 100), color: '#4ECDC4' },
        { name: '脂肪', pct: Math.round(f.fat / NRV.fat * 100), color: '#FFB020' },
        { name: '碳水', pct: Math.round(f.carbs / NRV.carbs * 100), color: '#8AB4FF' },
        { name: '钠', pct: Math.round(f.sodium / NRV.sodium * 100), color: '#F87171' },
      ];
    },
  },
  onLoad(query) {
    // 路由参数带食物名：从库中定位（扫描页搜索结果/常吃列表跳转入口）
    const name = decodeURIComponent(query.name || '');
    const found = FOOD_DB_EXTENDED.find(f => f.name === name);
    if (found) this.food = found;
  },
  methods: {
    goBack() { uni.navigateBack(); },
    // ===== 食物对比 =====
    startCompare() {
      // 再点一次（或已选食物后）退出对比并清状态
      if (this.comparing || this.compareWith) {
        this.comparing = false; this.compareWith = null; this.compareKw = ''; this.cmpResults = [];
        return;
      }
      this.comparing = true;
    },
    // 输入防抖 250ms 搜索食物库（与 scan 页搜索同一数据源）
    onCmpInput() {
      clearTimeout(this._cmpTimer);
      this._cmpTimer = setTimeout(() => {
        this.cmpResults = searchFood(this.compareKw, 8);
      }, 250);
    },
    pickCompare(f) {
      this.compareWith = f;
      this.comparing = false;
      this.cmpResults = [];
      this.compareKw = '';
    },
    // 快捷记录一份（100g/100ml）到当前时段餐次
    async quickAdd() {
      // 时段归餐次：5~10早餐 / 10~14午餐 / 14~18加餐 / 18~21晚餐 / 凌晨深夜归加餐
      const h = new Date().getHours();
      const mealType = h >= 5 && h < 10 ? 'breakfast' : h < 14 ? 'lunch' : h < 18 ? 'snack' : h < 21 ? 'dinner' : 'snack';
      const mealNames = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
      try {
        await request({
          url: '/api/meals', method: 'POST',
          data: {
            food_name: this.food.name, meal_type: mealType,
            serving_size: 100, serving_unit: this.food.unit.includes('ml') ? 'ml' : 'g',
            calories: this.food.calories, protein: this.food.protein,
            fat: this.food.fat, carbs: this.food.carbs,
            fiber: this.food.fiber, sodium: this.food.sodium, confidence: 1,
          },
        });
        uni.showToast({ title: `已记入${mealNames[mealType]}`, icon: 'success' });
      } catch (e) {
        uni.showToast({ title: '记录失败，请重试', icon: 'none' });
      }
    },
  }
}
</script>

<style>
.page { min-height: 100vh; background: var(--bg-page); padding-bottom: 40rpx; }
/* 头部随评分等级变色：绿/黄/红 */
.top-bar { padding: 100rpx 32rpx 36rpx; color: #fff; border-radius: 0 0 44rpx 44rpx; }
.top-bar.green { background: linear-gradient(150deg, #34C77B, #16A34A); }
.top-bar.yellow { background: linear-gradient(150deg, #F59E0B, #D97706); }
.top-bar.red { background: linear-gradient(150deg, #F87171, #DC2626); }
.nav-row { display: flex; align-items: center; }
.back { font-size: 60rpx; line-height: 1; margin-right: 20rpx; cursor: pointer; padding: 0 10rpx; }
.page-title { font-size: 40rpx; font-weight: 800; }
.food-name { display: block; font-size: 56rpx; font-weight: 800; margin-top: 20rpx; }
.score-row { display: flex; align-items: center; gap: 24rpx; margin-top: 26rpx; }
.score-circle { width: 130rpx; height: 130rpx; border-radius: 50%; background: rgba(255,255,255,0.22); display: flex; flex-direction: column; align-items: center; justify-content: center; border: 4rpx solid rgba(255,255,255,0.45); }
.sc-num { font-size: 48rpx; font-weight: 800; line-height: 1; }
.sc-max { font-size: 18rpx; opacity: 0.85; }
.score-info { flex: 1; }
.level-tag { display: inline-block; background: rgba(255,255,255,0.25); font-size: 24rpx; font-weight: 700; padding: 6rpx 20rpx; border-radius: 24rpx; }
.sc-advice { display: block; font-size: 24rpx; line-height: 1.6; margin-top: 12rpx; opacity: 0.95; }

.card { background: var(--bg-card); border-radius: 24rpx; padding: 30rpx 28rpx; margin: 20rpx 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04); }
.card-title { font-size: 30rpx; font-weight: 800; color: var(--text-1); margin-bottom: 22rpx; }
.ct-unit { font-size: 20rpx; color: var(--text-4); font-weight: 400; }

.nut-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16rpx; }
.nut-item { background: var(--bg-soft); border-radius: 16rpx; padding: 18rpx 0; text-align: center; }
.n-val { display: block; font-size: 34rpx; font-weight: 800; color: var(--text-1); }
.n-val.orange { color: #FF6B35; }
.n-lbl { display: block; font-size: 20rpx; color: var(--text-3); margin-top: 4rpx; }

.nrv-row { display: flex; align-items: center; gap: 16rpx; margin-bottom: 16rpx; }
.nrv-name { width: 110rpx; font-size: 24rpx; color: var(--text-2); }
.nrv-bar { flex: 1; height: 16rpx; background: var(--bg-input); border-radius: 8rpx; overflow: hidden; }
.nrv-fill { height: 100%; border-radius: 8rpx; transition: width .4s; }
.nrv-pct { width: 80rpx; text-align: right; font-size: 22rpx; font-weight: 700; color: var(--text-1); }
.nrv-note { display: block; font-size: 19rpx; color: var(--text-4); margin-top: 8rpx; }

.pc-row { display: flex; gap: 14rpx; align-items: flex-start; margin-bottom: 14rpx; }
.pc-icon { flex-shrink: 0; width: 36rpx; height: 36rpx; border-radius: 50%; font-size: 22rpx; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.pc-icon.good { background: #E8FBF0; color: #16A34A; }
.pc-icon.warn { background: #FEF2F2; color: #DC2626; }
.pc-text { font-size: 24rpx; color: var(--text-2); line-height: 1.6; }

.quick-btn { margin: 30rpx 24rpx 0; background: linear-gradient(135deg, #FF7A45, #FF5E3A); color: #fff; border: none; border-radius: 24rpx; height: 92rpx; line-height: 92rpx; font-size: 32rpx; font-weight: 700; box-shadow: 0 8rpx 24rpx rgba(255,94,58,0.3); }
.quick-btn:active { transform: scale(0.98); }

/* ===== 食物对比 ===== */
.cmp-btn { margin-left: auto; font-size: 24rpx; font-weight: 700; background: rgba(255,255,255,0.22); padding: 8rpx 22rpx; border-radius: 28rpx; cursor: pointer; }
.cmp-search { background: var(--bg-input); border-radius: 30rpx; padding: 0 24rpx; height: 72rpx; display: flex; align-items: center; }
.cmp-search input { flex: 1; font-size: 28rpx; color: var(--text-1); }
.cmp-item { padding: 18rpx 0; border-bottom: 1rpx solid var(--line); cursor: pointer; }
.cmp-item:last-child { border-bottom: none; }
.ci-name { display: block; font-size: 28rpx; font-weight: 600; color: var(--text-1); }
.ci-cat { display: block; font-size: 22rpx; color: var(--text-3); margin-top: 4rpx; }

/* 对比结果：头部两列 + VS */
.cr-head { display: flex; align-items: center; margin-bottom: 24rpx; }
.cr-side { flex: 1; text-align: center; }
.cr-name { display: block; font-size: 28rpx; font-weight: 700; color: var(--text-1); margin-bottom: 10rpx; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cr-score { width: 84rpx; height: 84rpx; margin: 0 auto; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 34rpx; font-weight: 800; color: #fff; }
.cr-score.green { background: linear-gradient(135deg, #34C77B, #16A34A); }
.cr-score.yellow { background: linear-gradient(135deg, #F59E0B, #D97706); }
.cr-score.red { background: linear-gradient(135deg, #F87171, #DC2626); }
.cr-vs { font-size: 26rpx; font-weight: 800; color: var(--text-4); padding: 0 20rpx; }
/* 对比条行：A 橙（当前食物）/ B 蓝（对比食物） */
.cr-row { display: flex; align-items: center; gap: 14rpx; margin-bottom: 14rpx; }
.cr-lbl { width: 130rpx; font-size: 22rpx; color: var(--text-2); flex-shrink: 0; }
.cr-bars { flex: 1; display: flex; align-items: center; gap: 8rpx; }
.cr-bar { height: 18rpx; border-radius: 9rpx; min-width: 6rpx; }
.cr-bar.a { background: linear-gradient(90deg, #FF7A45, #FF5E3A); }
.cr-bar.b { background: linear-gradient(90deg, #60A5FA, #3B82F6); }
.cr-val { font-size: 21rpx; font-weight: 700; color: #FF6B35; width: 64rpx; text-align: right; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.cr-val.b { color: #3B82F6; }
.cr-note { display: block; font-size: 19rpx; color: var(--text-4); margin-top: 10rpx; line-height: 1.6; }
/* 结论条：绿底绿字，一眼看到推荐 */
.cr-verdict { margin-top: 18rpx; background: rgba(34,197,94,0.10); border-radius: 16rpx; padding: 18rpx 22rpx; font-size: 24rpx; color: #16A34A; font-weight: 600; line-height: 1.7; }
</style>
