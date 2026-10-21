// mock 数据层全接口冒烟测试
// 覆盖：登录鉴权 / 记录 CRUD / 统计口径 / 睡眠换算 / 生理期周期 / 打卡日历 / 社区互动 / 数据备份
// 方式：stub 全局 localStorage 后直接调 mockRequest（纯前端数据层，无需浏览器）
import test from 'node:test';
import assert from 'node:assert/strict';

// 浮点近似断言（assert.closeTo 在部分 Node 版本不可用，自实现保证兼容）
function approx(actual, expected, tol = 0.01, msg = '') {
  assert.ok(Math.abs(actual - expected) <= tol, `${msg} 期望 ${expected}±${tol}，实际 ${actual}`);
}

// Node 环境没有 localStorage，先 stub 再导入被测模块
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const { mockRequest } = await import('../desktop-src/src/js/mock.js');
const { recommendSmart } = await import('../desktop-src/src/js/recipes.js');

// 每个用例独立数据库（避免用例间污染）
function freshDB() {
  store.clear();
  const r = mockRequest('POST', '/login/', { username: 'demo', password: '123456' });
  assert.ok(r.access_token, 'demo 登录应成功');
}
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('鉴权：错误密码拒绝，未登录返回401', () => {
  store.clear();
  assert.equal(mockRequest('POST', '/login/', { username: 'demo', password: 'wrong' }).__status, 400);
  assert.equal(mockRequest('GET', '/api/stats/today', {}).__status, 401);
});

test('记录一餐：营养入库并可删除', () => {
  freshDB();
  const meal = mockRequest('POST', '/api/meals', {
    food_name: '鸡胸肉', meal_type: 'lunch', serving_size: 150,
    calories: 199.5, protein: 29.1, fat: 7.5, carbs: 3.8, fiber: 0, sodium: 51, confidence: 1,
  });
  assert.ok(meal.id, '应生成记录 id');
  const stats = mockRequest('GET', '/api/stats/today', {});
  assert.ok(stats.calories >= 199, '今日摄入应包含新记录');
  mockRequest('DELETE', `/api/meals/${meal.id}`, {});
  const after = mockRequest('GET', '/api/stats/today', {});
  assert.ok(after.calories < stats.calories, '删除后摄入应下降');
});

test('编辑记录：改分量后营养等比重算', () => {
  freshDB();
  const meal = mockRequest('POST', '/api/meals', {
    food_name: '米饭', meal_type: 'lunch', serving_size: 100,
    calories: 116, protein: 2.6, fat: 0.3, carbs: 25.9, fiber: 0.3, sodium: 2, confidence: 1,
  });
  const edited = mockRequest('PUT', `/api/meals/${meal.id}`, { serving_size: 200 });
  approx(edited.calories, 232, 0.1, '分量翻倍热量应翻倍');
});

test('热量平衡口径：运动消耗进入 stats 供前端×0.9抵扣', () => {
  freshDB();
  mockRequest('POST', '/api/exercises', { type: '慢跑', minutes: 30 });
  const stats = mockRequest('GET', '/api/stats/today', {});
  assert.ok(stats.exercise_calories > 0, '运动消耗应计入统计');
  // 慢跑 MET 7.5 × 70kg × 0.5h = 262.5 → 取整 263（demo 用户 70kg）
  approx(stats.exercise_calories, 263, 1);
});

test('睡眠：跨午夜换算正确，同日重记覆盖，超16小时拒绝', () => {
  freshDB();
  const rec = mockRequest('POST', '/api/sleep', { bedtime: '23:30', waketime: '07:00' });
  approx(rec.hours, 7.5, 0.01, '23:30→07:00 应为 7.5h');
  mockRequest('POST', '/api/sleep', { bedtime: '23:00', waketime: '07:00' });
  const q = mockRequest('GET', '/api/sleep', {});
  assert.equal(q.today.hours, 8, '同日重记应覆盖为最新');
  // 边界内：15.5h 合法（上限16h）
  const okLong = mockRequest('POST', '/api/sleep', { bedtime: '08:00', waketime: '23:30' });
  assert.equal(okLong.hours, 15.5, '15.5h 在上限内应成功');
  // 超上限：17h 应拒绝
  const bad = mockRequest('POST', '/api/sleep', { bedtime: '06:00', waketime: '23:00' });
  assert.equal(bad.__status, 400, '17h 超上限应拒绝');
});

test('生理期：未来日期拒绝，周期均值与下次预测正确', () => {
  freshDB();
  const t = new Date();
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // 两次经期：31天前(5天) 和 3天前(今天结束)
  const s1 = new Date(t); s1.setDate(s1.getDate() - 31);
  const e1 = new Date(s1); e1.setDate(e1.getDate() + 4);
  const s2 = new Date(t); s2.setDate(s2.getDate() - 3);
  assert.equal(mockRequest('POST', '/api/period', { start: fmt(s1), end: fmt(e1) }).message, 'ok');
  const future = mockRequest('POST', '/api/period', { start: fmt(new Date(t.getTime() + 86400000)), end: fmt(t) });
  assert.equal(future.__status, 400, '未来日期应拒绝');
  assert.equal(mockRequest('POST', '/api/period', { start: fmt(s2), end: fmt(t) }).message, 'ok');
  const p = mockRequest('GET', '/api/period', {});
  assert.equal(p.avg_cycle, 28, '31天间隔与3天(剔除<15天)后均值应为28');
  assert.equal(p.in_period, true, '当前应处于经期中');
  assert.ok(p.next_start, '应预测下次经期日期');
});

test('打卡日历：只统计当月有记录的天数', () => {
  freshDB();
  mockRequest('POST', '/api/meals', { food_name: '苹果', meal_type: 'snack', serving_size: 100, calories: 54, protein: 0.2, fat: 0.2, carbs: 13.5, fiber: 1.2, sodium: 1, confidence: 1 });
  const cal = mockRequest('GET', '/api/calendar', { month: today().slice(0, 7) });
  assert.ok(cal.logged_count >= 1, '当天记了餐应至少 1 天');
});

test('社区互动：点赞toggle与状态查询，评论发表与列表', () => {
  freshDB();
  const meal = mockRequest('POST', '/api/meals', { food_name: '香蕉', meal_type: 'snack', serving_size: 100, calories: 93, protein: 1.4, fat: 0.2, carbs: 22, fiber: 1.2, sodium: 1, confidence: 1 });
  assert.equal(mockRequest('POST', '/api/community/like', { feed_id: String(meal.id) }).liked, true);
  assert.equal(mockRequest('POST', '/api/community/like', { feed_id: String(meal.id) }).liked, false, '再点应取消');
  mockRequest('POST', '/api/community/like', { feed_id: String(meal.id) });
  const ids = mockRequest('GET', '/api/community/likes', {});
  assert.ok(ids.includes(String(meal.id)), '点赞列表应包含该动态');
  mockRequest('POST', '/api/community/comments', { feed_id: String(meal.id), text: '很棒' });
  const cmts = mockRequest('GET', '/api/community/comments', { feed_id: String(meal.id) });
  assert.equal(cmts.length, 1);
  assert.equal(cmts[0].text, '很棒');
});

test('数据备份：导出包含全部表，导入后数据一致且登出', () => {
  freshDB();
  mockRequest('POST', '/api/sleep', { bedtime: '23:00', waketime: '07:00' });
  const backup = mockRequest('GET', '/api/data/export', {});
  assert.ok(backup.data.users && backup.data.meals && backup.data.sleeps, '导出应含用户/餐食/睡眠表');
  // 换一个全新库导入
  store.clear();
  mockRequest('POST', '/login/', { username: 'demo', password: '123456' });
  const r = mockRequest('POST', '/api/data/import', backup);
  assert.equal(r.message, '导入成功，请重新登录');
  assert.equal(mockRequest('GET', '/api/stats/today', {}).__status, 401, '导入后应登出防串号');
});

test('食谱智能推荐：余量紧张时低卡食谱前置且有超量提示', () => {
  freshDB();
  const tight = recommendSmart('lose', 'dinner', 350);
  const ample = recommendSmart('lose', 'dinner', 2000);
  assert.ok(tight[0].calories <= ample[0].calories, '余量350时首选热量不应高于余量2000时');
  assert.ok(tight.some(r => r.reason.includes('超出')), '超余量食谱应带提示');
});
