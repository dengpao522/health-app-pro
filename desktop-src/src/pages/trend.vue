<template>
  <view class="page">
    <view class="top-bar">
      <text class="page-title">趋势分析</text>
      <text class="page-sub">最近 {{ days }} 天营养与体重变化</text>
    </view>

    <!-- 每周营养报告：数据+文案全部由本地规则引擎生成，零服务器成本 -->
    <view class="card report-card">
      <view class="card-title">📄 每周营养报告 <text class="share-btn" @click="makeShare">📸 生成分享图</text></view>
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
      <!-- 运动小结条（上周小结口径）：有运动才显示 -->
      <view class="ex-summary" v-if="report && report.exercise_minutes > 0">
        <text class="exs-icon">🏃</text>
        <text class="exs-text">本周运动 {{ report.exercise_days }} 天 · {{ report.exercise_minutes }} 分钟 · 消耗 {{ report.exercise_calories }} kcal</text>
      </view>
      <!-- 睡眠小结条：有睡眠记录才显示 -->
      <view class="sleep-summary" v-if="report && report.avg_sleep">
        <text class="exs-icon">😴</text>
        <text class="sleeps-text">本周平均睡眠 {{ report.avg_sleep }} 小时（{{ report.sleep_days }} 天有记录）</text>
      </view>
      <view class="report-insights" v-if="report && report.insights.length">
        <view class="insight-item" v-for="(line, i) in report.insights" :key="i">
          <text class="insight-dot">💡</text>
          <text class="insight-text">{{ line }}</text>
        </view>
      </view>
    </view>

    <!-- 打卡日历：月视图热力格，点已记录日期跳历史页 -->
    <view class="card cal-card">
      <view class="cal-head">
        <text class="cal-nav" :class="{ disabled: calMonth <= minMonth }" @click="shiftMonth(-1)">‹</text>
        <text class="cal-title">{{ calMonthLabel }}</text>
        <text class="cal-nav" :class="{ disabled: calMonth >= thisMonth }" @click="shiftMonth(1)">›</text>
      </view>
      <text class="cal-sub" v-if="cal">本月已记录 {{ cal.logged_count }} 天</text>
      <view class="cal-week">
        <text class="cw-item" v-for="w in ['日','一','二','三','四','五','六']" :key="w">{{ w }}</text>
      </view>
      <view class="cal-grid" v-if="cal">
        <view v-for="(cell, i) in calGrid" :key="'c' + i" class="cal-cell">
          <view v-if="cell" class="cal-day"
                :class="{ logged: cell.logged, today: cell.isToday, future: cell.future }"
                @click="cell.logged && goDay(cell.date)">
            <text class="cd-num">{{ cell.day }}</text>
            <view class="cd-dot" v-if="cell.logged"></view>
          </view>
        </view>
      </view>
      <text class="cal-tip">绿色 = 当天有饮食记录；点绿色日期可回看那天的记录</text>
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

    <!-- 周报分享图：隐藏的高清画布（375x540 显示 / 750x1080 绘制）+ 预览弹窗 -->
    <canvas class="share-canvas" canvas-id="sharePoster" width="750" height="1080"></canvas>
    <view class="share-mask" v-if="shareUrl" @click.self="shareUrl = ''">
      <view class="share-dialog">
        <text class="sh-title">长按或下载保存，晒出你的健康周报</text>
        <img :src="shareUrl" class="sh-img" alt="健康周报分享图" />
        <view class="sh-btns">
          <view class="sh-btn ghost" @click="shareUrl = ''">关闭</view>
          <view class="sh-btn ok" @click="downloadShare">下载图片</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { request } from '../js/request.js';
export default {
  data() { return { days: 7, points: [], targetCal: 2000, report: null, cal: null, calMonth: '', shareUrl: '' }; },
  computed: {
    // 当前自然月（YYYY-MM），用于限制翻页上限
    thisMonth() {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    },
    // 最早可翻月份：注册当天（数据从那时开始，再往前翻没有意义）
    minMonth() {
      const u = (uni.getStorageSync('userInfo') || {}).user || {};
      const created = u.created_at || u.date_joined || '';
      return /^\d{4}-\d{2}/.test(created) ? created.slice(0, 7) : '2020-01';
    },
    calMonthLabel() { return this.calMonth ? this.calMonth.replace('-', ' 年 ') + ' 月' : ''; },
    // 月视图网格：前置空白补齐 + 每天 { day, date, logged, isToday, future }
    calGrid() {
      if (!this.cal) return [];
      const [y, m] = this.calMonth.split('-').map(Number);
      const firstDow = new Date(y, m - 1, 1).getDay(); // 0=周日
      const daysInMonth = new Date(y, m, 0).getDate();
      const today = this.cal.today;
      const cells = [];
      for (let i = 0; i < firstDow; i++) cells.push(null);
      for (let d = 1; d <= daysInMonth; d++) {
        const date = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const info = this.cal.days[date];
        cells.push({ day: d, date, logged: !!(info && info.logged), isToday: date === today, future: date > today });
      }
      return cells;
    },
  },
  onShow() {
    this.calMonth = this.calMonth || this.thisMonth;
    this.loadData();
    this.loadCalendar();
  },
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
    // 画布文字/圆点用主题感知色（canvas 读不到 CSS 变量，按 data-theme 取值）
    isDark() {
      const el = document.querySelector('.app-shell');
      return !!(el && el.getAttribute('data-theme') === 'dark');
    },
    // ===== 打卡日历 =====
    async loadCalendar() {
      try {
        this.cal = await request({ url: '/api/calendar', data: { month: this.calMonth } });
      } catch (e) {}
    },
    // 翻月：minMonth~thisMonth 之间
    shiftMonth(n) {
      const [y, m] = this.calMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + n, 1);
      const next = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (next < this.minMonth || next > this.thisMonth) return;
      this.calMonth = next;
      this.loadCalendar();
    },
    // 点已记录日期 → 历史页回看那天（query 由 polyfill 透传）
    goDay(date) {
      uni.navigateTo({ url: '/pages/history/history?date=' + date });
    },
    // ===== 周报分享图 =====
    // 文本自动换行：按宽度切断，返回实际行数（canvas 不支持自动换行）
    wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
      let line = '', rows = 0;
      for (const ch of String(text)) {
        if (ctx.measureText(line + ch).width > maxW) {
          ctx.fillText(line, x, y + rows * lineH);
          rows += 1; line = ch;
          if (rows >= maxLines) { line += '…'; break; }
        } else line += ch;
      }
      if (line && rows < maxLines) ctx.fillText(line, x, y + rows * lineH);
      return rows + (line ? 1 : 0);
    },
    makeShare() {
      if (!this.report) { uni.showToast({ title: '报告数据还没加载好', icon: 'none' }); return; }
      const r = this.report;
      const el = this.$el.querySelector('canvas[canvas-id="sharePoster"]');
      if (!el) return;
      // 直接用原生 2D 上下文按 750x1080 绘制（高分屏导出更清晰）
      el.width = 750; el.height = 1080;
      const ctx = el.getContext('2d');
      // 背景：奶油白
      ctx.fillStyle = '#FFFAF7';
      ctx.fillRect(0, 0, 750, 1080);
      // 头部横幅：品牌橙渐变
      const grad = ctx.createLinearGradient(0, 0, 750, 200);
      grad.addColorStop(0, '#FF7A45'); grad.addColorStop(1, '#FF5E3A');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 750, 200);
      ctx.fillStyle = '#fff';
      ctx.font = '800 52px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('我的健康周报', 375, 92);
      ctx.font = '26px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText((r.start || '').slice(5).replace('-', '.') + ' - ' + (r.end || '').slice(5).replace('-', '.'), 375, 140);
      // 四格数据：记录天数 / 日均热量 / 日均蛋白 / 运动消耗
      const stats = [
        { val: r.logged_days + '/7', lbl: '记录天数' },
        { val: r.avg_calories, lbl: '日均热量' },
        { val: r.avg_protein + 'g', lbl: '日均蛋白' },
        { val: r.exercise_calories, lbl: '运动消耗' },
      ];
      stats.forEach((s, i) => {
        const cx = 94 + i * 188;
        ctx.fillStyle = '#FF6B35';
        ctx.font = '800 44px sans-serif';
        ctx.fillText(s.val, cx, 296);
        ctx.fillStyle = '#999';
        ctx.font = '24px sans-serif';
        ctx.fillText(s.lbl, cx, 336);
      });
      // 分隔线
      ctx.strokeStyle = '#FFE3D6'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(60, 380); ctx.lineTo(690, 380); ctx.stroke();
      // 运动/睡眠小结条
      let y = 428;
      ctx.textAlign = 'left';
      const pill = (icon, txt) => {
        ctx.fillStyle = '#FFF1EA';
        ctx.fillRect(60, y - 34, 630, 62);
        ctx.fillStyle = '#FF6B35'; ctx.font = '28px sans-serif';
        ctx.fillText(icon, 80, y + 6);
        ctx.fillStyle = '#C2553A'; ctx.font = '600 26px sans-serif';
        ctx.fillText(txt, 122, y + 6);
        y += 88;
      };
      if (r.exercise_minutes > 0) pill('🏃', `本周运动 ${r.exercise_days} 天 · ${r.exercise_minutes} 分钟`);
      if (r.avg_sleep) pill('😴', `本周平均睡眠 ${r.avg_sleep} 小时（${r.sleep_days} 天有记录）`);
      if (r.weight_change !== null && r.weight_change !== 0) {
        pill('⚖️', r.weight_change < 0 ? `体重下降 ${Math.abs(r.weight_change)} kg` : `体重上升 ${r.weight_change} kg`);
      }
      // 洞察列表：最多 3 条，每条最多 2 行
      ctx.fillStyle = '#333';
      ctx.font = '800 32px sans-serif';
      ctx.fillText('💡 本周洞察', 60, y + 8);
      y += 58;
      ctx.font = '25px sans-serif';
      (r.insights || []).slice(0, 3).forEach((line) => {
        ctx.fillStyle = '#FFB088';
        ctx.beginPath(); ctx.arc(70, y - 8, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#666';
        const rows = this.wrapText(ctx, line, 94, y, 560, 38, 2);
        y += rows * 38 + 18;
      });
      // 页脚品牌
      ctx.textAlign = 'center';
      ctx.fillStyle = '#bbb';
      ctx.font = '600 24px sans-serif';
      ctx.fillText('健康饮食助手 · 让记录改变习惯', 375, 1040);
      // 导出为 PNG 弹出预览
      this.shareUrl = el.toDataURL('image/png');
    },
    // 下载分享图：浏览器 <a download>（WebView 内长按图片也可保存）
    downloadShare() {
      const a = document.createElement('a');
      a.href = this.shareUrl;
      a.download = '健康周报_' + (this.report ? this.report.end : '').replace(/-/g, '') + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      uni.showToast({ title: '已开始下载', icon: 'success' });
    },
    drawCal() {
      const ctx = this.getCtx('calChart');
      const dark = this.isDark();
      const W = 660, H = 320, pad = 40;
      const valColor = dark ? '#E8EAED' : '#333';
      const axisColor = dark ? '#7A7F87' : '#999';
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
        ctx.setFillStyle(valColor); ctx.setFontSize(18);
        ctx.setTextAlign('center');
        ctx.fillText(Math.round(v), x + bw * 0.3, y - 8);
        // 日期
        ctx.setFillStyle(axisColor); ctx.setFontSize(16);
        const d = this.points[i].date.slice(5);
        ctx.fillText(d, x + bw * 0.3, H - pad + 22);
      });
      ctx.draw();
    },
    drawMacro() {
      const ctx = this.getCtx('macroChart');
      const dark = this.isDark();
      const dotFill = dark ? '#1E2126' : '#fff';
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
          ctx.setFillStyle(dotFill); ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
          ctx.setStrokeStyle(color); ctx.setLineWidth(2); ctx.stroke();
        });
      };
      drawLine(p, '#FF6B35'); drawLine(f, '#FFB020'); drawLine(c, '#4ECDC4');
      // 日期
      this.points.forEach((pt, i) => {
        const x = pad + i * step;
        ctx.setFillStyle(dark ? '#7A7F87' : '#999'); ctx.setFontSize(16); ctx.setTextAlign('center');
        ctx.fillText(pt.date.slice(5), x, H - pad + 22);
      });
      ctx.draw();
    },
    drawWeight() {
      const ctx = this.getCtx('weightChart');
      const dark = this.isDark();
      const valColor = dark ? '#E8EAED' : '#333';
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
        ctx.setFillStyle(valColor); ctx.setFontSize(18); ctx.setTextAlign('center');
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
.page { min-height: 100vh; background: var(--bg-page); }
.top-bar { padding: 100rpx 32rpx 30rpx; background: linear-gradient(160deg, #FF6B35, #FF8F5E); color: #fff; }
.page-title { display: block; font-size: 44rpx; font-weight: 800; }
.page-sub { display: block; font-size: 26rpx; opacity: 0.9; margin-top: 8rpx; }
.card { background: var(--bg-card); border-radius: 24rpx; padding: 32rpx; margin: 20rpx 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04); }
.card-title { font-size: 30rpx; font-weight: 700; color: var(--text-1); margin-bottom: 20rpx; }
.chart { width: 100%; height: 320rpx; }
.chart-legend { display: flex; gap: 30rpx; margin-top: 10rpx; flex-wrap: wrap; }
.legend-item { font-size: 22rpx; color: var(--text-2); display: flex; align-items: center; }
.dot { width: 16rpx; height: 16rpx; border-radius: 50%; display: inline-block; margin-right: 8rpx; }

/* ===== 每周营养报告 ===== */
.report-card { border: none; background: linear-gradient(180deg, rgba(255,107,53,0.07), var(--bg-card) 70%); box-shadow: 0 4rpx 20rpx rgba(255,107,53,0.08); }
.report-summary { display: flex; justify-content: space-around; padding: 12rpx 0 20rpx; margin-bottom: 16rpx; }
.rs-item { text-align: center; background: var(--bg-card); border-radius: 18rpx; padding: 16rpx 26rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05); }
.rs-item.highlight-o { background: linear-gradient(135deg, rgba(255,107,53,0.14), rgba(255,107,53,0.08)); }
.rs-item.highlight-p { background: linear-gradient(135deg, rgba(34,197,94,0.14), rgba(34,197,94,0.08)); }
.rs-val { display: block; font-size: 40rpx; font-weight: 800; color: #FF6B35; }
.rs-item.highlight-p .rs-val { color: #16A34A; }
.rs-unit { font-size: 22rpx; font-weight: 400; color: var(--text-4); }
.rs-lbl { display: block; font-size: 22rpx; color: var(--text-3); margin-top: 4rpx; }
/* 运动小结条：绿系轻量条 */
.ex-summary { display: flex; align-items: center; gap: 12rpx; background: rgba(34,197,94,0.12); border-radius: 16rpx; padding: 14rpx 20rpx; margin-bottom: 16rpx; }
.exs-icon { font-size: 26rpx; }
.exs-text { font-size: 22rpx; color: #16A34A; font-weight: 600; }
/* 睡眠小结条：紫罗兰色系与首页睡眠卡一致 */
.sleep-summary { display: flex; align-items: center; gap: 12rpx; background: rgba(139,124,246,0.12); border-radius: 16rpx; padding: 14rpx 20rpx; margin-bottom: 16rpx; }
.sleeps-text { font-size: 22rpx; color: #8B7CF6; font-weight: 600; }

/* ===== 打卡日历 ===== */
.cal-card { animation: fadeUp .35s ease both; }
.cal-head { display: flex; align-items: center; justify-content: center; gap: 40rpx; margin-bottom: 6rpx; }
.cal-nav { width: 60rpx; height: 60rpx; line-height: 56rpx; text-align: center; font-size: 36rpx; color: var(--text-2); background: var(--bg-input); border-radius: 50%; cursor: pointer; }
.cal-nav.disabled { opacity: 0.3; }
.cal-title { font-size: 30rpx; font-weight: 800; color: var(--text-1); min-width: 180rpx; text-align: center; }
.cal-sub { display: block; text-align: center; font-size: 22rpx; color: var(--text-3); margin-bottom: 20rpx; }
.cal-week { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 8rpx; }
.cw-item { text-align: center; font-size: 21rpx; color: var(--text-4); }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8rpx; }
.cal-cell { aspect-ratio: 1; }
.cal-day { width: 100%; height: 100%; border-radius: 14rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-input); cursor: default; }
.cal-day.logged { background: rgba(34,197,94,0.16); cursor: pointer; }
.cal-day.logged:active { background: rgba(34,197,94,0.32); }
.cal-day.future { opacity: 0.35; }
.cal-day.today { box-shadow: inset 0 0 0 3rpx #FF6B35; }
.cd-num { font-size: 24rpx; font-weight: 700; color: var(--text-1); line-height: 1.1; }
.cd-dot { width: 8rpx; height: 8rpx; border-radius: 50%; background: #16A34A; margin-top: 4rpx; }
.cal-tip { display: block; text-align: center; font-size: 19rpx; color: var(--text-4); margin-top: 16rpx; }

/* ===== 周报分享图 ===== */
.share-btn { float: right; font-size: 22rpx; color: #FF6B35; font-weight: 700; background: rgba(255,107,53,0.10); padding: 6rpx 20rpx; border-radius: 24rpx; cursor: pointer; }
/* 海报画布本体藏到屏幕外（仅用于绘制导出，不参与页面布局） */
.share-canvas { position: fixed; left: -9999px; top: 0; width: 375px; height: 540px; }
.share-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; display: flex; align-items: center; justify-content: center; }
.share-dialog { width: 74%; max-width: 340px; background: var(--bg-card); border-radius: 28rpx; padding: 30rpx 26rpx; }
.sh-title { display: block; text-align: center; font-size: 25rpx; font-weight: 700; color: var(--text-1); margin-bottom: 20rpx; }
.sh-img { display: block; width: 100%; border-radius: 16rpx; box-shadow: 0 6rpx 24rpx rgba(0,0,0,0.15); }
.sh-btns { display: flex; gap: 16rpx; margin-top: 24rpx; }
.sh-btn { flex: 1; text-align: center; padding: 18rpx 0; border-radius: 40rpx; font-size: 27rpx; font-weight: 700; cursor: pointer; }
.sh-btn.ghost { background: var(--bg-input); color: var(--text-2); }
.sh-btn.ok { background: linear-gradient(135deg, #FF7A45, #FF5E3A); color: #fff; }
.report-insights { display: flex; flex-direction: column; gap: 12rpx; }
.insight-item { display: flex; gap: 12rpx; align-items: flex-start; }
.insight-dot { font-size: 24rpx; flex-shrink: 0; margin-top: 2rpx; }
.insight-text { font-size: 24rpx; color: var(--text-2); line-height: 1.6; }
</style>

