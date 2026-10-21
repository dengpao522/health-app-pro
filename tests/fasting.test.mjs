// 轻断食周期引擎测试
// 16:8 的核心不变量：任意时刻 t，状态判定 + 剩余时间 + 环进度三者自洽
// （与 fasting.vue 内联公式同口径，这里用独立实现交叉验证公式正确性）
import test from 'node:test';
import assert from 'node:assert/strict';

// 浮点近似断言（assert.closeTo 在部分 Node 版本不可用，自实现保证兼容）
function approx(actual, expected, tol = 0.001, msg = '') {
  assert.ok(Math.abs(actual - expected) <= tol, `${msg} 期望 ${expected}±${tol}，实际 ${actual}`);
}

// 从 fasting.vue 提炼的纯函数版本（周期坐标 p ∈ [0, cycle)）
function fastState(elapsedH, fastH, eatH) {
  const cycle = fastH + eatH;
  const p = elapsedH % cycle;
  const eating = p >= fastH;
  const remainH = p < fastH ? fastH - p : cycle - p;
  const pct = eating ? (p - fastH) / eatH : p / fastH;
  return { eating, remainH, pct };
}

test('16:8：断食窗口内状态与倒计时正确', () => {
  let s = fastState(0, 16, 8);
  assert.equal(s.eating, false);
  approx(s.remainH, 16);
  s = fastState(8, 16, 8);
  assert.equal(s.eating, false);
  approx(s.remainH, 8);
  s = fastState(15.9, 16, 8);
  assert.equal(s.eating, false);
  approx(s.remainH, 0.1);
});

test('16:8：第16小时整点切换进食窗口（曾是 bug：整点仍判断食）', () => {
  const s = fastState(16, 16, 8);
  assert.equal(s.eating, true, '16h 整点应进入进食窗口');
  approx(s.remainH, 8);
});

test('16:8：进食窗口结束精确回到断食（23.9→24h 边界）', () => {
  assert.equal(fastState(23.9, 16, 8).eating, true);
  assert.equal(fastState(24, 16, 8).eating, false, '24h 应开始第二轮断食');
});

test('16:8：第二轮循环倒计时不为负（曾是 bug：24h 后倒计时归零）', () => {
  for (const h of [24, 25, 30, 40, 63.9, 64]) {
    const s = fastState(h, 16, 8);
    assert.ok(s.remainH > 0, `第 ${h}h 倒计时应为正，实际 ${s.remainH}`);
    assert.ok(s.remainH <= 16, `第 ${h}h 倒计时不应超过断食窗口`);
  }
});

test('14:10 / 18:6 方案：边界切换点一致正确', () => {
  assert.equal(fastState(14, 14, 10).eating, true);
  assert.equal(fastState(13.9, 14, 10).eating, false);
  assert.equal(fastState(18, 18, 6).eating, true);
  assert.equal(fastState(24, 18, 6).eating, false); // 18+6=24h 一轮
});

test('进度环：断食中进度单调递增且不超过 1', () => {
  for (let h = 0; h < 16; h += 0.5) {
    const { pct } = fastState(h, 16, 8);
    assert.ok(pct >= 0 && pct <= 1, `第 ${h}h 进度越界: ${pct}`);
    // 断食段进度 == elapsed/fastH
    approx(pct, h / 16);
  }
});

test('进度环：进食段进度相对进食窗口起点（而非绝对时间）', () => {
  approx(fastState(17, 16, 8).pct, 0.125); // 进食第 1 小时
  approx(fastState(23, 16, 8).pct, 0.875); // 进食第 7 小时
});
