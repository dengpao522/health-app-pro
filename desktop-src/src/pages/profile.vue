<template>
  <view class="page">
    <view class="top-bar">
      <view class="user-row">
        <view class="avatar">{{ avatarText }}</view>
        <view class="u-info">
          <text class="u-name">{{ user.nickname || user.username }}</text>
          <text class="u-meta">{{ user.gender === 'female' ? '女' : '男' }} · {{ user.age }}岁 · {{ user.height }}cm · {{ user.weight }}kg</text>
        </view>
        <!-- 积分徽章：对标薄荷的勋章/积分体系 -->
        <view class="points-badge" v-if="achieve">
          <text class="pb-star">⭐</text>
          <text class="pb-val">{{ achieve.points }}</text>
        </view>
      </view>
    </view>

    <!-- 成就徽章墙（全部本地规则计算） -->
    <view class="card achieve-card" v-if="achieve">
      <view class="card-title">🏅 我的成就 <text class="ac-count">{{ achieve.earnedCount }}/{{ achieve.badges.length }}</text></view>
      <view class="badge-row">
        <view class="badge" v-for="b in achieve.badges" :key="b.key" :class="{ earned: b.earned }">
          <text class="b-icon">{{ b.icon }}</text>
          <text class="b-name">{{ b.name }}</text>
          <text class="b-desc">{{ b.desc }}</text>
        </view>
      </view>
      <text class="ac-foot">最长连续打卡 {{ achieve.maxStreak }} 天 · 记录、运动、打卡都能涨积分</text>
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
      <view class="custom-cal">
        <view class="cc-head">
          <text class="cc-title">🎯 自定义热量目标</text>
          <view class="cc-switch" :class="{ on: useCustomCal }" @click="toggleCustomCal">
            <view class="cc-knob"></view>
          </view>
        </view>
        <view class="cc-body" v-if="useCustomCal">
          <view class="cc-stepper">
            <view class="cc-step" @click="adjustCal(-100)">−100</view>
            <input class="cc-input" type="number" :value="customCal" @change="customCal = +$event.target.value" />
            <view class="cc-step" @click="adjustCal(100)">＋100</view>
          </view>
          <text class="cc-hint">范围 800~6000 kcal，开启后立即生效</text>
        </view>
      </view>
      <!-- 自定义饮水目标：与热量同款交互 -->
      <view class="custom-cal">
        <view class="cc-head">
          <text class="cc-title">💧 自定义饮水目标</text>
          <view class="cc-switch" :class="{ on: useCustomWater }" @click="toggleCustomWater">
            <view class="cc-knob"></view>
          </view>
        </view>
        <view class="cc-body" v-if="useCustomWater">
          <view class="cc-stepper">
            <view class="cc-step" @click="adjustWater(-250)">−250</view>
            <input class="cc-input water" type="number" :value="customWater" @change="customWater = +$event.target.value" />
            <view class="cc-step" @click="adjustWater(250)">＋250</view>
          </view>
          <text class="cc-hint">范围 500~10000 ml，开启后立即生效</text>
        </view>
      </view>
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

    <!-- 外观设置：三态主题（浅色/深色/跟随系统） -->
    <view class="card theme-card">
      <view class="card-title">🎨 外观</view>
      <view class="theme-tabs">
        <view v-for="t in themeOptions" :key="t.value"
              class="theme-tab" :class="{ active: themePref === t.value }"
              @click="setTheme(t.value)">
          <text class="tt-icon">{{ t.icon }}</text>
          <text class="tt-name">{{ t.name }}</text>
        </view>
      </view>
    </view>

    <!-- 注销账号：跳转邮件客户端提交注销申请（应用商店审核要求的账号注销入口） -->
    <button class="logout-btn delete-btn" @click="deleteAccount">注销账号</button>

    <!-- 数据备份：导出/导入 JSON（换机/清数据前先导出） -->
    <view class="card backup-card">
      <view class="card-title">📦 数据备份</view>
      <text class="bk-desc">数据仅存本机，换机或清缓存前建议先导出备份</text>
      <view class="bk-btns">
        <button class="bk-btn" @click="exportData">导出备份</button>
        <button class="bk-btn ghost" @click="importData">导入恢复</button>
      </view>
    </view>

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
      // 自定义热量目标
      useCustomCal: false,
      customCal: 2000,
      // 自定义饮水目标
      useCustomWater: false,
      customWater: 2450,
      // 成就徽章 + 积分
      achieve: null,
      // 主题偏好：light/dark/auto
      themePref: 'light',
      themeOptions: [
        { value: 'light', icon: '☀️', name: '浅色' },
        { value: 'dark', icon: '🌙', name: '深色' },
        { value: 'auto', icon: '🌗', name: '跟随系统' },
      ],
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
    // 恢复自定义热量/饮水/主题设置
    this.useCustomCal = !!(u.custom_calories && u.custom_calories >= 800);
    this.customCal = u.custom_calories || 2000;
    this.useCustomWater = !!(u.custom_water && u.custom_water >= 500);
    this.customWater = u.custom_water || Math.round((u.weight || 70) * 35);
    this.themePref = (typeof window !== 'undefined' && window.__getThemePref) ? window.__getThemePref() : 'light';
    // 成就数据独立拉取
    request({ url: '/api/me/achievements' }).then(r => { this.achieve = r; }).catch(() => {});
  },
  methods: {
    onActivity(e) { this.activityIdx = +e.detail.value; this.form.activity_level = ACTIVITIES[this.activityIdx].key; },
    onGoal(e) { this.goalIdx = +e.detail.value; this.form.goal = GOALS[this.goalIdx].key; },
    // ===== 自定义热量 =====
    toggleCustomCal() {
      this.useCustomCal = !this.useCustomCal;
      this.applyCustomCal();
    },
    adjustCal(delta) {
      this.customCal = Math.max(800, Math.min(6000, (this.customCal || 2000) + delta));
      this.applyCustomCal();
    },
    // 防抖提交：开关/步进后 400ms 无操作才写入
    applyCustomCal() {
      clearTimeout(this._calTimer);
      this._calTimer = setTimeout(async () => {
        const value = this.useCustomCal ? Math.max(800, Math.min(6000, +this.customCal || 2000)) : null;
        try {
          const res = await request({ url: '/api/me', method: 'PUT', data: { custom_calories: value } });
          const info = uni.getStorageSync('userInfo');
          info.user = res;
          uni.setStorageSync('userInfo', info);
          this.user = res;
        } catch (e) {}
      }, 400);
    },
    // ===== 自定义饮水（与热量同款防抖模式） =====
    toggleCustomWater() {
      this.useCustomWater = !this.useCustomWater;
      this.applyCustomWater();
    },
    adjustWater(delta) {
      this.customWater = Math.max(500, Math.min(10000, (this.customWater || 2450) + delta));
      this.applyCustomWater();
    },
    applyCustomWater() {
      clearTimeout(this._waterTimer);
      this._waterTimer = setTimeout(async () => {
        const value = this.useCustomWater ? Math.max(500, Math.min(10000, +this.customWater || 2450)) : null;
        try {
          const res = await request({ url: '/api/me', method: 'PUT', data: { custom_water: value } });
          const info = uni.getStorageSync('userInfo');
          info.user = res;
          uni.setStorageSync('userInfo', info);
          this.user = res;
        } catch (e) {}
      }, 400);
    },
    // ===== 主题切换：调全局入口，App.vue 统一响应 =====
    setTheme(value) {
      this.themePref = value;
      if (typeof window !== 'undefined' && window.__setTheme) window.__setTheme(value);
    },
    // ===== 数据备份 =====
    // 导出：拉整库 JSON，用浏览器下载能力存为 .json 文件
    async exportData() {
      try {
        const payload = await request({ url: '/api/data/export' });
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '健康饮食助手备份_' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        uni.showToast({ title: '备份文件已下载', icon: 'success' });
      } catch (e) {
        uni.showToast({ title: '导出失败，请重试', icon: 'none' });
      }
    },
    // 导入：文件选择 → 解析 → 二次确认 → 整库覆盖 → 重新登录
    importData() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        let payload = null;
        try {
          payload = JSON.parse(await file.text());
        } catch (e) {
          uni.showToast({ title: '文件解析失败', icon: 'none' });
          return;
        }
        uni.showModal({
          title: '导入备份',
          content: '导入将覆盖当前全部数据，且需要重新登录。确定继续？',
          confirmText: '覆盖导入',
          success: async (r) => {
            if (!r.confirm) return;
            try {
              await request({ url: '/api/data/import', method: 'POST', data: payload });
              uni.showToast({ title: '导入成功，请重新登录', icon: 'success' });
              setTimeout(() => {
                uni.removeStorageSync('userInfo');
                uni.reLaunch({ url: '/pages/login/login' });
              }, 1200);
            } catch (e) {
              uni.showToast({ title: (e && e.detail) || '导入失败', icon: 'none' });
            }
          }
        });
      };
      input.click();
    },
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
.page { min-height: 100vh; background: var(--bg-page); }
.top-bar { padding: 100rpx 32rpx 60rpx; background: linear-gradient(160deg, #FF6B35, #FF8F5E); }
.user-row { display: flex; align-items: center; }
.avatar { width: 120rpx; height: 120rpx; border-radius: 50%; background: rgba(255,255,255,0.3); color: #fff; font-size: 48rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-right: 24rpx; }
.u-info { color: #fff; }
.u-name { display: block; font-size: 40rpx; font-weight: 700; }
.u-meta { display: block; font-size: 26rpx; opacity: 0.9; margin-top: 6rpx; }

.card { background: var(--bg-card); border-radius: 24rpx; padding: 32rpx; margin: 20rpx 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04); }
.card-title { font-size: 30rpx; font-weight: 700; color: var(--text-1); margin-bottom: 24rpx; }

.target-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; }
.t-item { background: linear-gradient(135deg, rgba(255,107,53,0.14), rgba(255,107,53,0.07)); border-radius: 16rpx; padding: 24rpx; text-align: center; }
.t-val { display: block; font-size: 40rpx; font-weight: 800; color: #FF6B35; }
.t-lbl { display: block; font-size: 22rpx; color: var(--text-3); margin-top: 6rpx; }

.form-row { display: flex; align-items: center; justify-content: space-between; padding: 18rpx 0; border-bottom: 1rpx solid var(--line); }
.form-row:last-of-type { border-bottom: none; }
.lbl { font-size: 28rpx; color: var(--text-2); }
.inp { text-align: right; font-size: 28rpx; width: 260rpx; color: var(--text-1); }
.seg { display: flex; background: var(--bg-input); border-radius: 12rpx; padding: 4rpx; }
.seg-item { padding: 10rpx 28rpx; font-size: 26rpx; color: var(--text-2); border-radius: 10rpx; }
.seg-item.active { background: #FF6B35; color: #fff; }
.picker { font-size: 28rpx; color: var(--text-1); }
.save-btn { background: linear-gradient(135deg, #FF6B35, #FF8F5E); color: #fff; border: none; border-radius: 16rpx; height: 88rpx; line-height: 88rpx; font-size: 30rpx; font-weight: 700; margin-top: 24rpx; }

.weight-row { display: flex; gap: 20rpx; }
.w-inp { flex: 1; background: var(--bg-input); color: var(--text-1); border-radius: 14rpx; padding: 0 24rpx; height: 76rpx; font-size: 28rpx; }
.w-btn { background: #4ECDC4; color: #fff; border: none; border-radius: 14rpx; height: 76rpx; line-height: 76rpx; padding: 0 36rpx; font-size: 28rpx; }

.logout-btn { margin: 30rpx 24rpx; background: var(--bg-card); color: #FF4D4F; border: none; border-radius: 16rpx; height: 88rpx; line-height: 88rpx; font-size: 30rpx; }
/* 注销按钮：与退出登录区分的更深警示色 */
.logout-btn.delete-btn { color: #d9363e; font-weight: 600; }

/* ===== 自定义热量目标 ===== */
.custom-cal { margin-top: 26rpx; padding-top: 26rpx; border-top: 1rpx solid var(--line); }
.cc-head { display: flex; align-items: center; justify-content: space-between; }
.cc-title { font-size: 27rpx; font-weight: 700; color: var(--text-1); }
/* 开关：iOS 风胶囊 */
.cc-switch { width: 84rpx; height: 48rpx; border-radius: 24rpx; background: var(--bg-input); position: relative; transition: background .25s; cursor: pointer; }
.cc-switch.on { background: #FF6B35; }
.cc-knob { position: absolute; top: 4rpx; left: 4rpx; width: 40rpx; height: 40rpx; border-radius: 50%; background: #fff; transition: left .25s; box-shadow: 0 2rpx 6rpx rgba(0,0,0,0.2); }
.cc-switch.on .cc-knob { left: 40rpx; }
.cc-body { margin-top: 22rpx; }
.cc-stepper { display: flex; align-items: center; gap: 14rpx; }
.cc-step { padding: 14rpx 24rpx; background: var(--bg-input); border-radius: 14rpx; font-size: 26rpx; font-weight: 700; color: var(--text-1); cursor: pointer; }
.cc-step:active { background: rgba(255,107,53,0.15); color: #FF6B35; }
.cc-input { flex: 1; height: 72rpx; text-align: center; font-size: 34rpx; font-weight: 800; color: #FF6B35; background: rgba(255,107,53,0.10); border-radius: 14rpx; }
.cc-hint { display: block; font-size: 20rpx; color: var(--text-4); margin-top: 14rpx; }
/* 饮水输入的青蓝主题色（与热量橙色区分） */
.cc-input.water { color: #3D9BFF; background: rgba(61,155,255,0.12); }

/* ===== 数据备份 ===== */
.backup-card { margin: 20rpx 24rpx; }
.bk-desc { display: block; font-size: 22rpx; color: var(--text-3); margin-bottom: 20rpx; line-height: 1.6; }
.bk-btns { display: flex; gap: 16rpx; }
.bk-btn { flex: 1; background: linear-gradient(135deg, #FF7A45, #FF5E3A); color: #fff; border: none; border-radius: 18rpx; height: 84rpx; line-height: 84rpx; font-size: 28rpx; font-weight: 700; }
.bk-btn:active { transform: scale(0.97); }
.bk-btn.ghost { background: var(--bg-input); color: var(--text-2); }

/* ===== 外观（主题切换） ===== */
.theme-tabs { display: flex; gap: 14rpx; }
.theme-tab { flex: 1; text-align: center; padding: 20rpx 0; border-radius: 18rpx; background: var(--bg-input); cursor: pointer; transition: all .2s; }
.theme-tab.active { background: #FFF0E8; box-shadow: inset 0 0 0 3rpx #FF6B35; }
.tt-icon { display: block; font-size: 36rpx; }
.tt-name { display: block; font-size: 22rpx; color: var(--text-2); margin-top: 6rpx; }
.theme-tab.active .tt-name { color: #FF6B35; font-weight: 700; }

/* ===== 积分徽章 + 成就墙 ===== */
.points-badge { margin-left: auto; background: rgba(255,255,255,0.22); border-radius: 40rpx; padding: 8rpx 20rpx; display: flex; align-items: center; gap: 6rpx; }
.pb-star { font-size: 26rpx; }
.pb-val { color: #fff; font-size: 28rpx; font-weight: 800; }
.achieve-card { animation: fadeUp .3s ease both; }
.ac-count { font-size: 22rpx; color: #FF6B35; font-weight: 700; }
.badge-row { display: flex; gap: 14rpx; overflow-x: auto; padding-bottom: 6rpx; }
.badge { flex-shrink: 0; width: 150rpx; text-align: center; background: var(--bg-input); border-radius: 18rpx; padding: 18rpx 8rpx 14rpx; opacity: 0.45; }
.badge.earned { opacity: 1; background: #FFF8E8; box-shadow: inset 0 0 0 3rpx #F5C542; }
.b-icon { display: block; font-size: 40rpx; }
.badge:not(.earned) .b-icon { filter: grayscale(1); }
.b-name { display: block; font-size: 21rpx; font-weight: 700; color: var(--text-1); margin-top: 6rpx; }
.b-desc { display: block; font-size: 17rpx; color: var(--text-3); margin-top: 2rpx; }
.ac-foot { display: block; font-size: 20rpx; color: var(--text-4); margin-top: 14rpx; }
</style>

