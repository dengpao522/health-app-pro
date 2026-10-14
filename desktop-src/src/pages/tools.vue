<template>
  <view class="page">
    <view class="top-bar">
      <view class="nav-row">
        <text class="back" @click="goBack">‹</text>
        <text class="page-title">健康工具箱</text>
      </view>
      <text class="page-sub">填一次身体数据，六大健康指标实时计算</text>
    </view>

    <!-- 身体参数：一次填写，下方六个计算器联动 -->
    <view class="card param-card">
      <view class="card-title">📐 身体参数</view>
      <view class="p-grid">
        <view class="p-field">
          <text class="p-lbl">身高 cm</text>
          <input type="digit" v-model="form.height" class="p-inp" @input="calcAll" />
        </view>
        <view class="p-field">
          <text class="p-lbl">体重 kg</text>
          <input type="digit" v-model="form.weight" class="p-inp" @input="calcAll" />
        </view>
        <view class="p-field">
          <text class="p-lbl">年龄 岁</text>
          <input type="number" v-model="form.age" class="p-inp" @input="calcAll" />
        </view>
      </view>
      <view class="p-seg-row">
        <view class="p-seg">
          <text v-for="g in genders" :key="g.key" class="p-seg-item" :class="{ active: form.gender === g.key }" @click="form.gender = g.key; calcAll()">{{ g.name }}</text>
        </view>
        <picker :range="actLabels" :value="actIdx" @change="onAct">
          <view class="p-picker">{{ actLabels[actIdx] }} ›</view>
        </picker>
      </view>
    </view>

    <!-- 1. BMI：数值 + 四段分级条 + 健康体重范围 -->
    <view class="card" v-if="bmi.valid">
      <view class="card-title">⚖️ BMI 身体质量指数</view>
      <view class="big-row">
        <text class="big-val" :class="bmi.cls">{{ bmi.value }}</text>
        <text class="big-tag" :class="bmi.cls">{{ bmi.grade }}</text>
      </view>
      <!-- 四段分级指示条：指针落在当前区间 -->
      <view class="bmi-bar">
        <view class="bmi-seg thin"></view><view class="bmi-seg normal"></view><view class="bmi-seg over"></view><view class="bmi-seg obese"></view>
        <view class="bmi-pin" :style="{ left: bmi.pin + '%' }"></view>
      </view>
      <view class="bmi-scale"><text>偏瘦</text><text>正常</text><text>超重</text><text>肥胖</text></view>
      <text class="foot-note">健康体重范围 {{ bmi.rangeLow }} ~ {{ bmi.rangeHigh }} kg（按 BMI 18.5~23.9）</text>
    </view>

    <!-- 2+3. 基础代谢 & 每日总消耗 -->
    <view class="card" v-if="bmr.valid">
      <view class="card-title">🔥 能量代谢</view>
      <view class="duo-row">
        <view class="duo-item">
          <text class="duo-val">{{ bmr.value }}</text>
          <text class="duo-lbl">基础代谢 kcal</text>
          <text class="duo-sub">静息一天消耗</text>
        </view>
        <view class="duo-item primary">
          <text class="duo-val">{{ tdee.value }}</text>
          <text class="duo-lbl">每日消耗 kcal</text>
          <text class="duo-sub">{{ actLabels[actIdx] }}</text>
        </view>
      </view>
      <text class="foot-note">减脂期建议摄入 = 每日消耗 − 300~500 kcal；增肌期反向加 300 kcal</text>
    </view>

    <!-- 4. 体脂率 -->
    <view class="card" v-if="fat.valid">
      <view class="card-title">🧈 体脂率估算</view>
      <view class="big-row">
        <text class="big-val" :class="fat.cls">{{ fat.value }}%</text>
        <text class="big-tag" :class="fat.cls">{{ fat.grade }}</text>
      </view>
      <text class="foot-note">体脂率随 {{ form.gender === 'female' ? '女性' : '男性' }}标准：{{ fat.range }}；公式估算有 ±3% 误差，健身人群可到专业机构测量</text>
    </view>

    <!-- 5. 理想体重 -->
    <view class="card" v-if="ideal.valid">
      <view class="card-title">🎯 理想体重</view>
      <view class="duo-row">
        <view class="duo-item">
          <text class="duo-val">{{ ideal.value }}</text>
          <text class="duo-lbl">理想体重 kg</text>
          <text class="duo-sub">按 BMI 22 计算</text>
        </view>
        <view class="duo-item" :class="ideal.diff > 0 ? 'warn' : 'ok'">
          <text class="duo-val">{{ ideal.diff > 0 ? '+' : '' }}{{ ideal.diff }}</text>
          <text class="duo-lbl">{{ ideal.diff > 0 ? '还需减 kg' : '还需增 kg' }}</text>
          <text class="duo-sub">{{ ideal.diffText }}</text>
        </view>
      </view>
    </view>

    <!-- 6. 每日饮水 -->
    <view class="card" v-if="water.valid">
      <view class="card-title">💧 每日饮水建议</view>
      <view class="big-row">
        <text class="big-val blue">{{ water.value }} ml</text>
      </view>
      <text class="foot-note">按每公斤体重 35ml 估算；运动出汗多、天气热时再加 300~500ml</text>
    </view>

    <!-- 免责：健康工具的口径说明（上架审核友好） -->
    <view class="dis-card">
      <text class="dis-text">以上结果基于国际通用公式估算，仅供健康管理参考，不构成医学诊断；孕产妇、疾病人群请遵医嘱。</text>
    </view>

    <view style="height: 60rpx;"></view>
  </view>
</template>

<script>
// 活动量档位与系数：与 profile 页身体数据保持同一口径（TDEE = BMR × 系数）
const ACTS = [
  { key: 'sedentary', label: '久坐少动', factor: 1.2 },
  { key: 'light', label: '轻度活动', factor: 1.375 },
  { key: 'moderate', label: '中度活动', factor: 1.55 },
  { key: 'active', label: '重度活动', factor: 1.725 },
];

export default {
  data() {
    return {
      form: { height: 170, weight: 65, age: 25, gender: 'male' },
      actIdx: 1,
      genders: [ { key: 'male', name: '男' }, { key: 'female', name: '女' } ],
      // 六个计算器的结果集（calcAll 里统一填充）
      bmi: { valid: false },
      bmr: { valid: false },
      tdee: { valid: false },
      fat: { valid: false },
      ideal: { valid: false },
      water: { valid: false },
    };
  },
  computed: {
    actLabels() { return ACTS.map(a => a.label); },
  },
  onLoad() {
    // 用当前账号的身体数据做默认值（没登录兜底标准参数）
    const u = (uni.getStorageSync('userInfo') || {}).user || {};
    this.form.height = u.height || 170;
    this.form.weight = u.weight || 65;
    this.form.age = u.age || 25;
    this.form.gender = u.gender || 'male';
    const ai = ACTS.findIndex(a => a.key === (u.activity_level || 'light'));
    this.actIdx = ai >= 0 ? ai : 1;
    this.calcAll();
  },
  methods: {
    onAct(e) { this.actIdx = +e.detail.value; this.calcAll(); },
    goBack() { uni.navigateBack(); },
    // ===== 核心计算：六个指标一次算完 =====
    calcAll() {
      const h = +this.form.height, w = +this.form.weight, age = +this.form.age;
      const male = this.form.gender === 'male';
      // 输入不完整时清空结果区，避免显示误导数字
      if (!h || !w || !age || h < 80 || h > 250 || w < 20 || w > 300 || age < 2 || age > 120) {
        ['bmi', 'bmr', 'tdee', 'fat', 'ideal', 'water'].forEach(k => { this[k] = { valid: false }; });
        return;
      }
      const bmiV = w / ((h / 100) ** 2);
      // 中国成人 BMI 分级（WS/T 428 标准）：偏瘦<18.5 / 正常<24 / 超重<28 / 肥胖≥28
      const bmiGrade = bmiV < 18.5 ? '偏瘦' : bmiV < 24 ? '正常' : bmiV < 28 ? '超重' : '肥胖';
      const bmiCls = bmiV < 18.5 ? 'thin' : bmiV < 24 ? 'normal' : bmiV < 28 ? 'over' : 'obese';
      // 分级条指针：以 BMI 15~35 映射到 0~100%，保证指针始终落在条内
      const pin = Math.round(Math.max(0, Math.min(100, (bmiV - 15) / 20 * 100)));
      this.bmi = {
        valid: true, value: bmiV.toFixed(1), grade: bmiGrade, cls: bmiCls, pin,
        rangeLow: (18.5 * (h / 100) ** 2).toFixed(1),
        rangeHigh: (23.9 * (h / 100) ** 2).toFixed(1),
      };
      // Mifflin-St Jeor 公式（当前学界公认较准的 BMR 估算）
      const bmrV = Math.round(10 * w + 6.25 * h - 5 * age + (male ? 5 : -161));
      this.bmr = { valid: true, value: bmrV };
      const factor = ACTS[this.actIdx].factor;
      this.tdee = { valid: true, value: Math.round(bmrV * factor) };
      // Deurenberg 体脂率公式：1.2×BMI + 0.23×年龄 − 10.8×性别 − 5.4（男1女0）
      const fatV = 1.2 * bmiV + 0.23 * age - 10.8 * (male ? 1 : 0) - 5.4;
      // 分级：男 理想10~20% ≥25%偏高；女 理想18~28% ≥30%偏高
      const fatGrade = male
        ? (fatV < 10 ? '偏低' : fatV <= 20 ? '理想' : fatV < 25 ? '略高' : '偏高')
        : (fatV < 18 ? '偏低' : fatV <= 28 ? '理想' : fatV < 30 ? '略高' : '偏高');
      const fatCls = (fatGrade === '理想' || fatGrade === '偏低') ? 'normal' : fatGrade === '略高' ? 'over' : 'obese';
      this.fat = {
        valid: true, value: Math.max(2, fatV).toFixed(1), grade: fatGrade, cls: fatCls,
        range: male ? '理想 10%~20%' : '理想 18%~28%',
      };
      // 理想体重：BMI 22（WHO 建议的中间值）× 身高²
      const idealV = +(22 * (h / 100) ** 2).toFixed(1);
      const diff = +(w - idealV).toFixed(1);
      this.ideal = {
        valid: true, value: idealV, diff,
        diffText: Math.abs(diff) <= 2 ? '当前体重很理想，保持住' : diff > 0 ? `建议每月减 2~4 kg 循序渐进` : `建议每月增 1~2 kg 温和增重`,
      };
      this.water = { valid: true, value: Math.round(w * 35 / 50) * 50 };
    },
  },
};
</script>

<style>
/* 本页全部走主题变量：浅色/深色自动适配 */
.page { min-height: 100vh; background: var(--bg-page); padding-bottom: 40rpx; }
.top-bar { padding: 100rpx 32rpx 30rpx; background: linear-gradient(150deg, #6366F1, #4F46E5); color: #fff; border-radius: 0 0 44rpx 44rpx; }
.nav-row { display: flex; align-items: center; }
.back { font-size: 60rpx; line-height: 1; margin-right: 20rpx; cursor: pointer; padding: 0 10rpx; }
.page-title { font-size: 44rpx; font-weight: 800; }
.page-sub { display: block; font-size: 24rpx; opacity: 0.9; margin-top: 8rpx; }

.card { background: var(--bg-card); border-radius: 24rpx; padding: 30rpx 28rpx; margin: 20rpx 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04); }
.card-title { font-size: 30rpx; font-weight: 800; color: var(--text-1); margin-bottom: 22rpx; }

/* ===== 身体参数卡 ===== */
.param-card { margin-top: -6rpx; }
.p-grid { display: flex; gap: 14rpx; }
.p-field { flex: 1; background: var(--bg-input); border-radius: 16rpx; padding: 14rpx 18rpx; }
.p-lbl { display: block; font-size: 20rpx; color: var(--text-3); margin-bottom: 6rpx; }
.p-inp { font-size: 32rpx; font-weight: 800; color: #4F46E5; width: 100%; }
.p-seg-row { display: flex; align-items: center; justify-content: space-between; margin-top: 18rpx; gap: 16rpx; }
.p-seg { display: flex; background: var(--bg-input); border-radius: 14rpx; padding: 4rpx; }
.p-seg-item { padding: 10rpx 30rpx; font-size: 25rpx; color: var(--text-2); border-radius: 12rpx; cursor: pointer; }
.p-seg-item.active { background: #4F46E5; color: #fff; font-weight: 700; }
.p-picker { font-size: 24rpx; color: var(--text-2); background: var(--bg-input); border-radius: 14rpx; padding: 12rpx 20rpx; }

/* ===== 大数值行 ===== */
.big-row { display: flex; align-items: baseline; gap: 20rpx; }
.big-val { font-size: 72rpx; font-weight: 800; color: var(--text-1); font-variant-numeric: tabular-nums; line-height: 1.1; }
.big-val.blue { color: #3D9BFF; }
/* 分级色：thin 偏瘦蓝 / normal 正常绿 / over 超重橙 / obese 肥胖红（文本+标签共用） */
.big-val.thin, .big-tag.thin { color: #3B82F6; }
.big-val.normal, .big-tag.normal { color: #16A34A; }
.big-val.over, .big-tag.over { color: #F59E0B; }
.big-val.obese, .big-tag.obese { color: #DC2626; }
.big-tag { font-size: 26rpx; font-weight: 800; padding: 6rpx 22rpx; border-radius: 24rpx; }
.big-tag.thin { background: rgba(59,130,246,0.12); }
.big-tag.normal { background: rgba(22,163,74,0.12); }
.big-tag.over { background: rgba(245,158,11,0.14); }
.big-tag.obese { background: rgba(220,38,38,0.12); }

/* ===== BMI 四段分级条 ===== */
.bmi-bar { position: relative; display: flex; height: 18rpx; border-radius: 10rpx; overflow: visible; margin: 30rpx 0 10rpx; }
.bmi-seg { height: 100%; }
/* 四段宽度按 BMI 15~35 区间等比映射：偏瘦15-18.5 / 正常18.5-24 / 超重24-28 / 肥胖28-35 */
.bmi-seg.thin { width: 17.5%; background: #93C5FD; border-radius: 10rpx 0 0 10rpx; }
.bmi-seg.normal { width: 27.5%; background: #6EE7A0; }
.bmi-seg.over { width: 20%; background: #FCD34D; }
.bmi-seg.obese { width: 35%; background: #FCA5A5; border-radius: 0 10rpx 10rpx 0; }
.bmi-pin { position: absolute; top: -12rpx; width: 8rpx; height: 42rpx; background: var(--text-1); border-radius: 4rpx; transform: translateX(-50%); transition: left .3s; }
.bmi-scale { display: flex; justify-content: space-between; font-size: 19rpx; color: var(--text-4); margin-bottom: 16rpx; }

.foot-note { display: block; font-size: 21rpx; color: var(--text-3); line-height: 1.7; margin-top: 12rpx; }

/* ===== 双格行（BMR/TDEE、理想体重） ===== */
.duo-row { display: flex; gap: 16rpx; }
.duo-item { flex: 1; background: var(--bg-soft); border-radius: 18rpx; padding: 24rpx 20rpx; text-align: center; }
.duo-item.primary { background: rgba(79,70,229,0.10); }
.duo-item.warn { background: rgba(245,158,11,0.12); }
.duo-item.ok { background: rgba(22,163,74,0.10); }
.duo-val { display: block; font-size: 44rpx; font-weight: 800; color: #4F46E5; font-variant-numeric: tabular-nums; }
.duo-item.warn .duo-val { color: #D97706; }
.duo-item.ok .duo-val { color: #16A34A; }
.duo-lbl { display: block; font-size: 22rpx; color: var(--text-2); margin-top: 8rpx; font-weight: 700; }
.duo-sub { display: block; font-size: 19rpx; color: var(--text-4); margin-top: 4rpx; }

/* 免责声明卡 */
.dis-card { margin: 24rpx 24rpx 0; }
.dis-text { font-size: 20rpx; color: var(--text-4); line-height: 1.7; }
</style>
