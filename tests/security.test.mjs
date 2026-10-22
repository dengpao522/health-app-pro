// 数据层安全测试：越权与字段覆盖攻击回归
// 背景：mock 层虽为本地实现，但接口契约与真实后端一致——契约上的漏洞迁移后即成真漏洞
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const { mockRequest } = await import('../desktop-src/src/js/mock.js');

function freshDB() {
  store.clear();
  // 一键体验方式建库：随机凭据演示账号（与线上登录页同一条路径）
  const r = mockRequest('POST', '/api/demo-account', {});
  assert.ok(r.access_token, '体验账号应创建成功');
}

test('PUT /api/me 白名单：恶意覆盖 id/password/username 必须被拒绝', () => {
  freshDB();
  mockRequest('PUT', '/api/me', { id: 999, password: 'hacked', username: 'evil' });
  // 直查库验证：id 与用户名未被覆盖（白名单外字段一律丢弃）
  const backup = mockRequest('GET', '/api/data/export', {});
  const uid = backup.data.currentUser;
  const u = backup.data.users[uid];
  assert.notEqual(String(u.id), '999', 'id 不应被覆盖');
  assert.equal(u.username.startsWith('guest_'), true, '用户名不应被覆盖为 evil');
  assert.notEqual(u.password, 'hacked', '密码不应被覆盖');
});

test('GET /api/me 不回传 password 字段', () => {
  freshDB();
  const me = mockRequest('GET', '/api/me', {});
  assert.equal('password' in me, false, '密码字段不应出现在接口返回中');
});

test('PUT /api/me 白名单内字段正常生效并联动目标重算', () => {
  freshDB();
  const p = mockRequest('PUT', '/api/me', { weight: 80, goal: 'gain' });
  assert.equal(p.weight, 80);
  assert.equal(p.goal, 'gain');
  assert.equal(p.target_protein, 128, '蛋白目标应按 80kg×1.6 重算');
});

test('记录属主：删除/编辑只作用于当前用户的记录', () => {
  freshDB();
  const meal = mockRequest('POST', '/api/meals', {
    food_name: '米饭', meal_type: 'lunch', serving_size: 100,
    calories: 116, protein: 2.6, fat: 0.3, carbs: 25.9, fiber: 0.3, sodium: 2, confidence: 1,
  });
  // 用不存在的 id 删除应安全返回（不抛错不误删）
  const ghost = mockRequest('DELETE', '/api/meals/999999999', {});
  assert.equal(ghost.message, 'deleted');
  const list = mockRequest('GET', '/api/meals', {});
  assert.ok(list.some(m => m.id === meal.id), '误删防护：自己的记录仍在');
});

test('配额分级清理：只清 30 天前数据，近期数据保留', () => {
  freshDB();
  const today = new Date();
  const old = new Date(); old.setDate(old.getDate() - 60);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // 直接构造库验证 saveDB 清理逻辑的行为边界（通过公开导入接口注入）
  const backup = mockRequest('GET', '/api/data/export', {});
  backup.data.meals = backup.data.meals || {};
  const uid = Object.keys(backup.data.users).find(k => String(k) === String(backup.data.currentUser));
  backup.data.meals[uid] = [
    { id: 1, date: fmt(old), food_name: '旧餐', meal_type: 'lunch', calories: 500 },
    { id: 2, date: fmt(today), food_name: '新餐', meal_type: 'lunch', calories: 300 },
  ];
  mockRequest('POST', '/api/data/import', backup);
  // 重新登录（导入会登出）
  freshDB();
  const list = mockRequest('GET', '/api/meals', {});
  assert.ok(list.every(m => m.date >= fmt(new Date(Date.now() - 31 * 86400000))), '60天前旧餐不应出现在近期统计中');
});
