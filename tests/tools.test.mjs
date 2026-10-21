// 健康工具箱公式测试（tools.vue 内联公式的交叉验证）
// 口径：Mifflin-St Jeor BMR / 中国成人 BMI 分级(WS/T 428) / Deurenberg 体脂率
import test from 'node:test';
import assert from 'node:assert/strict';

// 浮点近似断言（assert.closeTo 在部分 Node 版本不可用，自实现保证兼容）
function approx(actual, expected, tol = 0.01, msg = '') {
  assert.ok(Math.abs(actual - expected) <= tol, `${msg} 期望 ${expected}±${tol}，实际 ${actual}`);
}

// 与 tools.vue 相同的公式（独立复写用于交叉验证）
function bmi(w, h) { return w / (h / 100) ** 2; }
function bmiGrade(v) { return v < 18.5 ? '偏瘦' : v < 24 ? '正常' : v < 28 ? '超重' : '肥胖'; }
function bmr(gender, w, h, age) { return 10 * w + 6.25 * h - 5 * age + (gender === 'male' ? 5 : -161); }
function bodyFat(bmiV, age, male) { return 1.2 * bmiV + 0.23 * age - 10.8 * (male ? 1 : 0) - 5.4; }
function idealWeight(h) { return 22 * (h / 100) ** 2; }

test('BMI 计算：70kg/175cm ≈ 22.86（正常区间中段）', () => {
  const v = bmi(70, 175);
  approx(v, 22.86);
  assert.equal(bmiGrade(v), '正常');
});

test('BMI 分级边界：18.5/24/28 三个切点两侧分级不同', () => {
  const g = (w) => bmiGrade(bmi(w, 175));
  const w185 = 18.5 * 1.75 ** 2, w24 = 24 * 1.75 ** 2, w28 = 28 * 1.75 ** 2;
  assert.equal(g(w185 - 0.1), '偏瘦');  assert.equal(g(w185 + 0.1), '正常');
  assert.equal(g(w24 - 0.1), '正常');   assert.equal(g(w24 + 0.1), '超重');
  assert.equal(g(w28 - 0.1), '超重');   assert.equal(g(w28 + 0.1), '肥胖');
});

test('BMR (Mifflin-St Jeor)：标准男性参考值 = 1673.75 kcal', () => {
  // 10*70 + 6.25*175 - 5*25 + 5 = 700 + 1093.75 - 125 + 5
  approx(bmr('male', 70, 175, 25), 1673.75);
  // 女性 -161：同体格低 166 kcal
  approx(bmr('female', 70, 175, 25) - bmr('male', 70, 175, 25), -166);
});

test('体脂率 (Deurenberg)：同 BMI 下女性体脂天然高于男性 10.8 点', () => {
  const v = bmi(70, 175);
  const male = bodyFat(v, 25, true), female = bodyFat(v, 25, false);
  approx(male, 16.98); // 1.2*22.857 + 5.75 - 16.2
  approx(female - male, 10.8, 0.001);
});

test('理想体重：按 BMI 22 折算，175cm ≈ 67.4kg', () => {
  approx(idealWeight(175), 67.375);
});

test('健康体重范围：BMI 18.5~23.9 对应区间覆盖理想体重', () => {
  const lo = 18.5 * 1.75 ** 2, hi = 23.9 * 1.75 ** 2;
  assert.ok(lo < idealWeight(175) && idealWeight(175) < hi, '理想体重应落在健康体重区间内');
});
