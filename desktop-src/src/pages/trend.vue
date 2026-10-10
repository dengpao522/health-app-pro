<template>
  <view class="page">
    <view class="top-bar">
      <text class="page-title">趋势分析</text>
      <text class="page-sub">最近 {{ days }} 天营养与体重变化</text>
    </view>

    <!-- 每周营养报告：数据+文案全部由本地规则引擎生成，零服务器成本 -->
    <view class="card report-card">
      <view class="card-title">📄 每周营养报告</view>
      <view class="report-summary" v-if="report">
        <view class="rs-item">
          <text class="rs-val">{{ report.logged_days }}<text class="rs-unit">/7</text></text>
          <text class="rs-lbl">记录天数</text>
        </view>
        <view class="rs-item highlight-o">
          <text class="rs-val">{{ report.avg_calories }}</text>
          <text class="rs-lbl">日均 kcal</text>
        </view>
        <view class="rs-item highlight-p">
          <text class="rs-val">{{ report.avg_protein }}</text>
          <text class="rs-lbl">日均蛋白 g</text>
        </view>
      </view>
      <view class="report-insights" v-if="report && report.insights.length">
        <view class="insight-item" v-for="(line, i) in report.insights" :key="i">
          <text class="insight-dot">💡</text>
          <text class="insight-text">{{ line }}</text>
        </view>
      </view>
    </view>

    <view class="card">
      <view class="card-title">🔥 每日热量摄入</view>
      <canvas canvas-id="calChart" design-width="660" design-height="320" class="chart"></canvas>
      <view class="chart-legend">
        <text class="legend-item"><text class="dot" style="background:#FF6B35"></text>实际摄入</text>
        <text class="legend-item"><text class="dot" style="background:#FFB088"></text>目标 {{ targetCal }}</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title">📊 三大营养素趋势</view>
      <canvas canvas-id="macroChart" design-width="660" design-height="320" class="chart"></canvas>
      <view class="chart-legend">
        <text class="legend-item"><text class="dot" style="background:#FF6B35"></text>蛋白质</text>
        <text class="legend-item"><text class="dot" style="background:#FFB020"></text>脂肪</text>
        <text class="legend-item"><text class="dot" style="background:#4ECDC4"></text>碳水</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title">⚖️ 体重趋势</view>
      <canvas canvas-id="weightChart" design-width="660" design-height="320" class="chart"></canvas>
    </view>

    <view style="height: 40rpx;"></view>
  </view>
</template>

<script>
import { request } from '../js/request.js';
export default {
  data() { return { days: 7, points: [], targetCal: 2000, report: null }; },
  onShow() { this.loadData(); },
  methods: {
    async loadData() {
      // 周报独立拉取：失败不影响图表
      request({ url: '/api/report/weekly' }).then(r => { this.report = r; }).catch(() => {});
      try {
        const res = await request({ url: '/api/stats/trend', data: { days: this.days } });
        this.points = res.points;
        const me = uni.getStorageSync('userInfo')?.user || {};
        this.targetCal = me.target_calories || 2000;
        this.$nextTick(() => {
          this.drawCal();
          this.drawMacro();
          this.drawWeight();
        });
      } catch (e) { console.error(e); }
    },
    getCtx(id) {
      const ctx = uni.createCanvasContext(id, this);
      return ctx;
    },
    drawCal() {
      const ctx = this.getCtx('calChart');
      const W = 660, H = 320, pad = 40;
      const data = this.points.map(p => p.calories);
      if (!data.length) {
        ctx.clearRect(0, 0, W, H);
        ctx.setFillStyle('#bbb'); ctx.setFontSize(24); ctx.setTextAlign('center');
        ctx.fillText('暂无数据', W / 2, H / 2);
        ctx.draw();
        return;
      }
      const max = (Math.max(...data, this.targetCal) || 100) * 1.15;
      const bw = (W - pad * 2) / data.length;
      ctx.clearRect(0, 0, W, H);
      // 目标线
      const ty = H - pad - (this.targetCal / max) * (H - pad * 2);
      ctx.setStrokeStyle('#FFB088');
      ctx.setLineDash([6, 4], 0);
      ctx.beginPath(); ctx.moveTo(pad, ty); ctx.lineTo(W - pad, ty); ctx.stroke();
      ctx.setLineDash([], 0);
      ctx.setFillStyle('#FFB088'); ctx.setFontSize(18);
      ctx.fillText('目标', W - pad - 50, ty - 6);
      // 柱子
      data.forEach((v, i) => {
        const x = pad + i * bw + bw * 0.2;
        const bh = (v / max) * (H - pad * 2);
        const y = H - pad - bh;
        const grad = ctx.createLinearGradient(0, y, 0, H - pad);
        grad.addColorStop(0, '#FF6B35'); grad.addColorStop(1, '#FFB088');
        ctx.setFillStyle(grad);
        this.roundRect(ctx, x, y, bw * 0.6, bh, 6);
        ctx.fill();
        // 数值
        ctx.setFillStyle('#333'); ctx.setFontSize(18);
        ctx.setTextAlign('center');
        ctx.fillText(Math.round(v), x + bw * 0.3, y - 8);
        // 日期
        ctx.setFillStyle('#999'); ctx.setFontSize(16);
        const d = this.points[i].date.slice(5);
        ctx.fillText(d, x + bw * 0.3, H - pad + 22);
      });
      ctx.draw();
    },
    drawMacro() {
      const ctx = this.getCtx('macroChart');
      const W = 660, H = 320, pad = 40;
      const p = this.points.map(x => x.protein);
      const f = this.points.map(x => x.fat);
      const c = this.points.map(x => x.carbs);
      if (!this.points.length) {
        ctx.clearRect(0, 0, W, H);
        ctx.setFillStyle('#bbb'); ctx.setFontSize(24); ctx.setTextAlign('center');
        ctx.fillText('暂无数据', W / 2, H / 2);
        ctx.draw();
        return;
      }
      const max = (Math.max(...p, ...f, ...c, 10) || 10) * 1.2;
      const step = (W - pad * 2) / Math.max(this.points.length - 1, 1);
      ctx.clearRect(0, 0, W, H);
      const drawLine = (data, color) => {
        ctx.setStrokeStyle(color); ctx.setLineWidth(3); ctx.beginPath();
        data.forEach((v, i) => {
          const x = pad + i * step;
          const y = H - pad - (v / max) * (H - pad * 2);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        data.forEach((v, i) => {
          const x = pad + i * step;
          const y = H - pad - (v / max) * (H - pad * 2);
          ctx.setFillStyle('#fff'); ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
          ctx.setStrokeStyle(color); ctx.setLineWidth(2); ctx.stroke();
        });
      };
      drawLine(p, '#FF6B35'); drawLine(f, '#FFB020'); drawLine(c, '#4ECDC4');
      // 日期
      this.points.forEach((pt, i) => {
        const x = pad + i * step;
        ctx.setFillStyle('#999'); ctx.setFontSize(16); ctx.setTextAlign('center');
        ctx.fillText(pt.date.slice(5), x, H - pad + 22);
      });
      ctx.draw();
    },
    drawWeight() {
      const ctx = this.getCtx('weightChart');
      const W = 660, H = 260, pad = 40;
      const ws = this.points.map(x => x.weight).filter(x => x);
      if (ws.length === 0) {
        ctx.clearRect(0, 0, W, H);
        ctx.setFillStyle('#bbb'); ctx.setFontSize(24); ctx.setTextAlign('center');
        ctx.fillText('暂无体重记录，去「我的」记录体重', W / 2, H / 2);
        ctx.draw();
        return;
      }
      const min = Math.min(...ws) - 1, max = Math.max(...ws) + 1;
      const step = (W - pad * 2) / Math.max(this.points.length - 1, 1);
      ctx.clearRect(0, 0, W, H);
      ctx.setStrokeStyle('#4ECDC4'); ctx.setLineWidth(3); ctx.beginPath();
      let started = false;
      this.points.forEach((pt, i) => {
        if (!pt.weight) return;
        const x = pad + i * step;
        const y = H - pad - ((pt.weight - min) / (max - min)) * (H - pad * 2);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      });
      ctx.stroke();
      this.points.forEach((pt, i) => {
        if (!pt.weight) return;
        const x = pad + i * step;
        const y = H - pad - ((pt.weight - min) / (max - min)) * (H - pad * 2);
        ctx.setFillStyle('#4ECDC4'); ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.setFillStyle('#333'); ctx.setFontSize(18); ctx.setTextAlign('center');
        ctx.fillText(pt.weight, x, y - 12);
      });
      ctx.draw();
    },
    roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }
}
</script>

<style>
.page { min-height: 100vh; background: #F5F6FA; }
.top-bar { padding: 100rpx 32rpx 30rpx; background: linear-gradient(160deg, #FF6B35, #FF8F5E); color: #fff; }
.page-title { display: block; font-size: 44rpx; font-weight: 800; }
.page-sub { display: block; font-size: 26rpx; opacity: 0.9; margin-top: 8rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 32rpx; margin: 20rpx 24rpx; }
.card-title { font-size: 30rpx; font-weight: 700; color: #333; margin-bottom: 20rpx; }
.chart { width: 100%; height: 320rpx; }
.chart-legend { display: flex; gap: 30rpx; margin-top: 10rpx; flex-wrap: wrap; }
.legend-item { font-size: 22rpx; color: #666; display: flex; align-items: center; }
.dot { width: 16rpx; height: 16rpx; border-radius: 50%; display: inline-block; margin-right: 8rpx; }

/* ===== 每周营养报告 ===== */
.report-card { border: none; background: linear-gradient(180deg, #FFF6F0, #fff 70%); box-shadow: 0 4rpx 20rpx rgba(255,107,53,0.08); }
.report-summary { display: flex; justify-content: space-around; padding: 12rpx 0 20rpx; margin-bottom: 16rpx; }
.rs-item { text-align: center; background: #fff; border-radius: 18rpx; padding: 16rpx 26rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05); }
.rs-item.highlight-o { background: linear-gradient(135deg, #FFF3ED, #FFE8DB); }
.rs-item.highlight-p { background: linear-gradient(135deg, #E8FBF0, #D6F5E3); }
.rs-val { display: block; font-size: 40rpx; font-weight: 800; color: #FF6B35; }
.rs-item.highlight-p .rs-val { color: #16A34A; }
.rs-unit { font-size: 22rpx; font-weight: 400; color: #bbb; }
.rs-lbl { display: block; font-size: 22rpx; color: #999; margin-top: 4rpx; }
.report-insights { display: flex; flex-direction: column; gap: 12rpx; }
.insight-item { display: flex; gap: 12rpx; align-items: flex-start; }
.insight-dot { font-size: 24rpx; flex-shrink: 0; margin-top: 2rpx; }
.insight-text { font-size: 24rpx; color: #555; line-height: 1.6; }
</style>

