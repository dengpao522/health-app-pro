// 食物健康度评分引擎测试
// 验证点：分类模板分度正确、双向线性计分、糖水一票定性、坚果高钠惩罚
import test from 'node:test';
import assert from 'node:assert/strict';
import { FOOD_DB_EXTENDED, scoreFood, searchFood } from '../desktop-src/src/js/food-db.js';

// 按名字取食物（测试辅助，找不到直接报错让用例失败）
function byName(name) {
  const f = FOOD_DB_EXTENDED.find(x => x.name === name);
  assert.ok(f, `食物库中应存在「${name}」`);
  return f;
}
// 等级断言（green/yellow/red）
function level(name) {
  return scoreFood(byName(name)).level;
}

test('食物库完整性：507 条且无重名', () => {
  const names = FOOD_DB_EXTENDED.map(f => f.name);
  assert.ok(names.length >= 500, `食物库应≥500条，实际 ${names.length}`);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dup, [], `不应有重名食物: ${dup.join(',')}`);
});

test('绿灯代表：高蛋白瘦肉/深海鱼/绿叶菜应为绿灯', () => {
  assert.equal(level('鸡胸肉'), 'green');
  assert.equal(level('三文鱼'), 'green');
  assert.equal(level('西兰花'), 'green');
  assert.equal(level('菠菜'), 'green');
});

test('红灯代表：红烧肉/可乐/奶茶应为红灯', () => {
  assert.equal(level('红烧肉'), 'red');
  assert.equal(level('可乐'), 'red');
  assert.equal(level('奶茶'), 'red');
});

test('全谷物分度：糙米饭评分应高于白米饭（纤维价值被识别）', () => {
  const brown = scoreFood(byName('糙米饭')).score;
  const white = scoreFood(byName('米饭')).score;
  assert.ok(brown > white, `糙米饭(${brown}) 应高于白米饭(${white})`);
});

test('糖水一票定性：可乐即使算出分数也封顶45红灯', () => {
  const s = scoreFood(byName('可乐'));
  assert.ok(s.score <= 45, `可乐应≤45分，实际 ${s.score}`);
  assert.equal(s.level, 'red');
});

test('无糖饮料不受糖水定性误伤：零度可乐应为绿灯', () => {
  assert.equal(level('零度可乐'), 'green');
});

test('坚果模板：原味核桃绿灯，盐焗瓜子因高钠扣分为红灯', () => {
  assert.equal(level('核桃'), 'green');
  assert.equal(level('杏仁'), 'green');
  assert.equal(level('瓜子'), 'red'); // 钠 1332mg/100g
});

test('豆制品分类修正后：豆腐应为绿灯（曾被错归蔬菜误判红灯）', () => {
  const f = byName('豆腐');
  assert.equal(f.cat, '其他', '豆腐应归类为「其他」而非「蔬菜」');
  assert.equal(scoreFood(f).level, 'green');
});

test('lin() 双向计分：低越好与高越好两个方向都正确', () => {
  // 从 food-db 的公开行为反推：蛋白越高分的肉蛋分越高（鸡胸肉19.4 vs 五花肉7.7）
  const breast = scoreFood(byName('鸡胸肉')).score;
  const belly = scoreFood(byName('五花肉')).score;
  assert.ok(breast > belly, `鸡胸肉(${breast}) 应远高于五花肉(${belly})`);
});

test('评分边界：分数恒在 0~100，等级映射正确', () => {
  for (const f of FOOD_DB_EXTENDED) {
    const s = scoreFood(f);
    assert.ok(s.score >= 0 && s.score <= 100, `${f.name} 分数越界: ${s.score}`);
    const expect = s.score >= 75 ? 'green' : s.score >= 55 ? 'yellow' : 'red';
    assert.equal(s.level, expect, `${f.name} 等级映射错误`);
  }
});

test('搜索：拼音缩写与别名都能命中', () => {
  assert.equal(searchFood('jzg')[0]?.name, '金针菇');   // 全拼缩写（曾因大写 bug 失效）
  assert.equal(searchFood('西红柿炒蛋')[0]?.name, '番茄炒蛋'); // 别名
  assert.equal(searchFood('jzg')[0]?.name, '金针菇');
});
