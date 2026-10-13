<template>
  <view class="page">
    <view class="top-bar">
      <view class="nav-row">
        <text class="back" @click="goBack">‹</text>
        <text class="page-title">轻断食</text>
      </view>
      <text class="page-sub">限时进食 · 给身体足够的休息窗口</text>
    </view>

    <!-- 断食状态大环 -->
    <view class="fast-card">
      <view class="ring-wrap">
        <canvas canvas-id="fastRing" design-width="240" design-height="240" class="ring-canvas"></canvas>
        <view class="ring-center">
          <text class="f-state" :class="{ eating: isEating }">{{ isEating ? '进食窗口' : stateText }}</text>
          <text class="f-count">{{ countdown }}</text>
          <text class="f-plan">{{ planLabel }}</text>
        </view>
      </view>
      <text class="f-tip">{{ statusTip }}</text>
      <button class="f-btn" :class="{ stop: isEating }" @click="toggleFast">
        {{ isEating ? '结束本轮' : isFasting ? '断食进行中…' : '开始断食' }}
      </button>
    </view>

    <!-- 方案选择 -->
    <view class="card">
      <view class="card-title">📐 断食方案</view>
      <view class="plan-row">
        <view v-for="p in plans" :key="p.key"
              class="plan-opt" :class="{ active: planKey === p.key, disabled: isFasting }"
              @click="choosePlan(p)">
          <text class="po-name">{{ p.label }}</text>
          <text class="po-desc">{{ p.desc }}</text>
          <text class="po-tag">{{ p.tag }}</text>
        </view>
      </view>
      <text class="plan-note">断食进行中不可切换方案；新手建议从 14:10 开始适应</text>
    </view>

    <!-- 最近记录 -->
    <view class="card" v-if="records.length">
      <view class="card-title">📈 最近记录</view>
      <view class="rec-row" v-for="r in records" :key="r.id">
        <text class="rr-date">{{ r.date.slice(5) }}</text>
        <text class="rr-plan">{{ r.label }}</text>
        <text class="rr-result" :class="{ ok: r.completed }">{{ r.completed ? '完成 ✓' : '未完成' }}</text>
      </view>
    </view>

    <view class="card tips-card">
      <view class="card-title">💡 断食小贴士</view>
      <text class="tip-line">· 断食窗口内可喝水、黑咖啡、无糖茶</text>
      <text class="tip-line">· 进食窗口也要控制总量，暴饮暴食会抵消效果</text>
      <text class="tip-line">· 孕产妇、糖尿病患者、低血糖人群不建议断食</text>
      <text class="tip-line">· 出现头晕心慌立即进食并停止本轮</text>
    </view>

    <view style="height: 150rpx;"></view>

    <!-- 数据仅存本机的说明 -->
    <text class="local-note">数据仅保存在本机</text>
  </view>
</template>

<script>
// 断食方案库：key=断食:进食 小时数
const PLANS = [
  { key: '14:10', fastH: 14, eatH: 10, label: '14:10', desc: '温和入门', tag: '新手推荐' },
  { key: '16:8', fastH: 16, eatH: 8, label: '16:8', desc: '经典方案', tag: '最多人用' },
  { key: '18:6', fastH: 18, eatH: 6, label: '18:6', desc: '进阶挑战', tag: '有经验' },
];

const FAST_KEY = 'health_pro_fasting'; // { planKey, startTime, running }

export default {
  data() {
    return {
      plans: PLANS,
      planKey: '16:8',
      // running: 断食进行中；isEating: 当前处于进食窗口
      running: false,
      startTime: 0,
      now: Date.now(),
      records: [],
      timer: null,
    };
  },
  computed: {
    plan() { return PLANS.find(p => p.key === this.planKey) || PLANS[1]; },
    planLabel() { return this.plan.label + '（断食 ' + this.plan.fastH + 'h）'; },
    isFasting() { return this.running; },
    isEating() {
      if (!this.running) return false;
      const elapsedH = (this.now - this.startTime) / 3600000;
      const cycle = this.plan.fastH + this.plan.eatH;
      // 超过断食窗口后进入进食窗口（按周期循环：断食→进食→断食…）
      return elapsedH >= this.plan.fastH && (elapsedH % cycle) < this.plan.eatH;
    },
    stateText() {
      if (!this.running) return '未开始';
      return this.isEating ? '进食窗口' : '断食中';
    },
    // 倒计时：断食中显示距进食窗口的时间；进食中显示距断食开始的时间
    countdown() {
      if (!this.running) return '--:--:--';
      const elapsed = this.now - this.startTime;
      const fastMs = this.plan.fastH * 3600000;
      let remain;
      if (this.isEating) {
        const cycle = (this.plan.fastH + this.plan.eatH) * 3600000;
        const inCycle = elapsed % cycle;
        remain = this.plan.eatH * 3600000 - inCycle;
      } else {
        remain = fastMs - elapsed;
      }
      if (remain < 0) remain = 0;
      const h = Math.floor(remain / 3600000);
      const m = Math.floor((remain % 3600000) / 60000);
      const s = Math.floor((remain % 60000) / 1000);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },
    statusTip() {
      if (!this.running) return `选好方案，点击开始；断食 ${this.plan.fastH} 小时后进入进食窗口`;
      if (this.isEating) return '现在是进食窗口，正常吃，别暴食';
      const elapsedH = ((this.now - this.startTime) / 3600000).toFixed(1);
      return `已断食 ${elapsedH} 小时，坚持住，可喝水/黑咖啡`;
    },
  },
  onShow() {
    this.loadState();
    // 每秒刷新倒计时
    this.timer = setInterval(() => { this.now = Date.now(); this.drawRing(); }, 1000);
  },
  onHide() { clearInterval(this.timer); },
  onUnload() { clearInterval(this.timer); },
  methods: {
    loadState() {
      try {
        const st = uni.getStorageSync(FAST_KEY) || {};
        this.planKey = st.planKey || '16:8';
        this.running = !!st.running;
        this.startTime = st.startTime || 0;
        this.records = st.records || [];
      } catch (e) {}
    },
    saveState() {
      uni.setStorageSync(FAST_KEY, {
        planKey: this.planKey, running: this.running,
        startTime: this.startTime, records: this.records.slice(-10),
      });
    },
    choosePlan(p) {
      if (this.running) { uni.showToast({ title: '断食中不可切换', icon: 'none' }); return; }
      this.planKey = p.key;
      this.saveState();
    },
    toggleFast() {
      if (this.running) {
        // 结束本轮：计算完成度并落记录
        const elapsedH = (Date.now() - this.startTime) / 3600000;
        const completed = elapsedH >= this.plan.fastH;
        this.records.unshift({
          id: Date.now(), date: this.fmtDate(), label: this.plan.label,
          hours: +elapsedH.toFixed(1), completed,
        });
        this.running = false;
        this.startTime = 0;
        this.saveState();
        uni.showToast({ title: completed ? '本轮断食完成！' : `已结束（${elapsedH.toFixed(1)}h）`, icon: completed ? 'success' : 'none' });
      } else {
        this.running = true;
        this.startTime = Date.now();
        this.saveState();
        uni.showToast({ title: '断食开始！', icon: 'success' });
      }
      this.now = Date.now();
      this.drawRing();
    },
    fmtDate() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    // 进度环：断食中显示断食窗口进度；空闲显示方案比例
    drawRing() {
      const ctx = uni.createCanvasContext('fastRing', this);
      const w = 240, cx = 120, cy = 120, r = 96, lw = 20;
      let pct = 0;
      if (this.running) {
        const elapsed = this.now - this.startTime;
        if (this.isEating) {
          const cycle = (this.plan.fastH + this.plan.eatH) * 3600000;
          pct = (elapsed % cycle) / (this.plan.eatH * 3600000);
        } else {
          pct = elapsed / (this.plan.fastH * 3600000);
        }
      } else {
        pct = this.plan.eatH / (this.plan.fastH + this.plan.eatH);
      }
      pct = Math.max(0, Math.min(1, pct));
      ctx.clearRect(0, 0, w, w);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.setStrokeStyle(this.isEating ? '#FFE3B3' : '#EAF9F0'); ctx.setLineWidth(lw); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      const grad = ctx.createLinearGradient(0, 0, w, w);
      if (this.isEating) { grad.addColorStop(0, '#F59E0B'); grad.addColorStop(1, '#FBBF24'); }
      else { grad.addColorStop(0, '#34C77B'); grad.addColorStop(1, '#16A34A'); }
      ctx.setStrokeStyle(grad); ctx.setLineWidth(lw); ctx.setLineCap('round'); ctx.stroke();
      ctx.draw();
    },
    goBack() { uni.navigateBack(); },
  }
}
</script>

<style>
.page { min-height: 100vh; background: var(--bg-page); padding-bottom: 40rpx; }
.top-bar { padding: 100rpx 32rpx 30rpx; background: linear-gradient(150deg, #10B981, #059669); color: #fff; border-radius: 0 0 44rpx 44rpx; }
.nav-row { display: flex; align-items: center; }
.back { font-size: 60rpx; line-height: 1; margin-right: 20rpx; cursor: pointer; padding: 0 10rpx; }
.page-title { font-size: 44rpx; font-weight: 800; }
.page-sub { display: block; font-size: 24rpx; opacity: 0.9; margin-top: 8rpx; }

.fast-card { margin: -30rpx 24rpx 0; background: var(--bg-card); border-radius: 32rpx; padding: 44rpx 28rpx 36rpx; box-shadow: 0 12rpx 40rpx rgba(16,185,129,0.12); position: relative; text-align: center; }
.ring-wrap { position: relative; width: 480rpx; height: 480rpx; margin: 0 auto; }
.ring-canvas { width: 480rpx; height: 480rpx; }
.ring-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); }
.f-state { display: block; font-size: 28rpx; font-weight: 700; color: #16A34A; }
.f-state.eating { color: #D97706; }
.f-count { display: block; font-size: 72rpx; font-weight: 800; color: var(--text-1); margin: 10rpx 0; font-variant-numeric: tabular-nums; }
.f-plan { display: block; font-size: 22rpx; color: var(--text-3); }
.f-tip { display: block; font-size: 24rpx; color: var(--text-2); margin-top: 8rpx; }
.f-btn { margin-top: 26rpx; background: linear-gradient(135deg, #10B981, #059669); color: #fff; border: none; border-radius: 50rpx; height: 92rpx; line-height: 92rpx; font-size: 32rpx; font-weight: 700; width: 70%; box-shadow: 0 8rpx 24rpx rgba(16,185,129,0.3); }
.f-btn.stop { background: linear-gradient(135deg, #F87171, #DC2626); box-shadow: 0 8rpx 24rpx rgba(220,38,38,0.3); }

.card { background: var(--bg-card); border-radius: 24rpx; padding: 30rpx 28rpx; margin: 20rpx 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04); }
.card-title { font-size: 30rpx; font-weight: 800; color: var(--text-1); margin-bottom: 22rpx; }

.plan-row { display: flex; gap: 14rpx; }
.plan-opt { flex: 1; background: var(--bg-input); border-radius: 18rpx; padding: 22rpx 12rpx; text-align: center; cursor: pointer; transition: all .2s; }
.plan-opt.active { background: #EAF9F0; box-shadow: inset 0 0 0 3rpx #10B981; }
.plan-opt.disabled { opacity: 0.55; }
.po-name { display: block; font-size: 32rpx; font-weight: 800; color: var(--text-1); }
.po-desc { display: block; font-size: 20rpx; color: var(--text-3); margin-top: 4rpx; }
.po-tag { display: inline-block; font-size: 17rpx; color: #059669; background: #D1F5E3; border-radius: 14rpx; padding: 2rpx 12rpx; margin-top: 8rpx; }
.plan-note { display: block; font-size: 20rpx; color: var(--text-4); margin-top: 16rpx; }

.rec-row { display: flex; justify-content: space-between; align-items: center; padding: 14rpx 0; border-bottom: 1rpx solid var(--line); }
.rec-row:last-child { border-bottom: none; }
.rr-date { font-size: 24rpx; color: var(--text-2); }
.rr-plan { font-size: 24rpx; font-weight: 700; color: var(--text-1); }
.rr-result { font-size: 22rpx; color: var(--text-4); }
.rr-result.ok { color: #16A34A; font-weight: 700; }

.tips-card { background: linear-gradient(135deg, #F0F9FF, var(--bg-card)); }
.tip-line { display: block; font-size: 23rpx; color: var(--text-2); line-height: 1.9; }

.local-note { display: block; text-align: center; font-size: 20rpx; color: var(--text-4); margin-top: 20rpx; }
</style>
