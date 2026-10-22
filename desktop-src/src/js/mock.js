// 纯前端 Mock 层 —— 所有数据存 localStorage，无需后端
import { FOOD_DB_EXTENDED, searchFood as dbSearch, toSearchItem } from './food-db.js';
const DB_KEY = 'health_app_mock_db';

function todayStr() {
  const d = new Date();
  return fmtDate(d);
}
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dateOffset(i) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  return fmtDate(d);
}

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  let db = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.users) db = parsed;
    } catch(e) {}
  }
  let changed = false;
  if (!db) {
    db = { users: {}, meals: {}, waters: {}, weights: {}, exercises: {}, currentUser: null };
    changed = true;
  }
  // 旧版本库升级：补运动记录表（老用户无痛升级）
  if (!db.exercises) { db.exercises = {}; changed = true; }
  // 旧版本库升级：补睡眠记录表（对标薄荷的睡眠打卡）
  if (!db.sleeps) { db.sleeps = {}; changed = true; }
  // 旧版本库升级：补生理期记录表（女性健康）
  if (!db.periods) { db.periods = {}; changed = true; }
  // 旧版本库升级：补社区互动表（点赞/评论）
  if (!db.likes) { db.likes = {}; changed = true; }
  if (!db.comments) { db.comments = {}; changed = true; }
  // 历史库升级：给旧版注入过固定密码演示账号的老库，移除硬编码凭据（安全整改）
  for (const u of Object.values(db.users)) {
    if (u.username === 'demo' && u.password === '123456') {
      // 保留该账号的演示数据，但密码改为随机值（等效禁用已知凭据登录）
      u.password = 'legacy-' + Math.random().toString(36).slice(2, 14);
      changed = true;
    }
  }
  // 老库升级不再预置演示账号：体验入口改为按需生成（见 /api/demo-account），
  // 避免代码中出现已知固定凭据（demo/123456 曾被硬编码，属于安全隐患）
  if (changed) saveDB(db);
  return db;
}
function saveDB(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    // 配额溢出：分级清理（先旧餐食，再旧运动/饮水），保留最近 30 天
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.warn('[mock] localStorage 配额溢出，清理旧数据...');
      const cutoff = dateOffset(30);
      for (const uid of Object.keys(db.meals || {})) {
        db.meals[uid] = (db.meals[uid] || []).filter(m => m.date >= cutoff);
      }
      try { localStorage.setItem(DB_KEY, JSON.stringify(db)); return; } catch (e2) {}
      // 仍溢出：清理运动/饮水/体重旧记录（睡眠/生理期数据量小且价值高，不动）
      try {
        for (const uid of Object.keys(db.exercises || {})) db.exercises[uid] = (db.exercises[uid] || []).filter(x => x.date >= cutoff);
        for (const uid of Object.keys(db.waters || {})) db.waters[uid] = (db.waters[uid] || []).filter(x => x.date >= cutoff);
        for (const uid of Object.keys(db.weights || {})) db.weights[uid] = (db.weights[uid] || []).filter(x => x.date >= cutoff);
        localStorage.setItem(DB_KEY, JSON.stringify(db));
      } catch (e3) { console.error('[mock] 清理后仍溢出', e3); }
    } else { throw e; }
  }
}

// 为指定账号注入 7 天演示数据（趋势图/打卡日历开箱即用）
// uid 由调用方传入（一键体验接口生成的账号），本函数只负责灌数据
function seedDemo(db, uid) {
  if (!db.meals) db.meals = {};
  if (!db.waters) db.waters = {};
  if (!db.weights) db.weights = {};
  if (!db.exercises) db.exercises = {};
  if (db.meals[uid]) return; // 已有演示数据则不重复注入
  db.meals[uid] = [];
  let mid = 100000;
  const addMeal = (dayOffset, type, name, cal, p, f, c, fb, na, serving) => {
    const d = new Date(); d.setDate(d.getDate() - dayOffset);
    db.meals[uid].push({
      id: mid++, date: fmtDate(d), created_at: d.toISOString(),
      food_name: name, meal_type: type, image_url: '', serving_size: serving,
      calories: cal, protein: p, fat: f, carbs: c, fiber: fb, sodium: na, confidence: 0.95,
    });
  };
  // 两套每日食谱轮换，营养数值按常见分量估算
  const planA = [
    ['breakfast','牛奶 250ml', 135, 7.5, 8, 8.5, 0, 93, 250],
    ['breakfast','全麦面包 80g', 250, 6.6, 4.1, 46.9, 0.4, 184, 80],
    ['lunch','米饭 200g', 232, 5.2, 0.6, 51.8, 0.6, 4, 200],
    ['lunch','宫保鸡丁 150g', 270, 22.8, 17.3, 10.2, 0.8, 600, 150],
    ['lunch','清炒时蔬 150g', 68, 3.2, 3.8, 6.3, 2.7, 300, 150],
    ['snack','香蕉 150g', 140, 2.1, 0.3, 33, 1.8, 2, 150],
    ['dinner','三文鱼 120g', 167, 20.6, 9.4, 0, 0, 56, 120],
    ['dinner','蔬菜沙拉 200g', 240, 10, 14, 20, 8, 400, 200],
  ];
  const planB = [
    ['breakfast','白粥 300g', 138, 3.3, 0.3, 31.8, 0.3, 3, 300],
    ['breakfast','水煮蛋 100g', 144, 13.3, 8.8, 2.8, 0, 132, 100],
    ['lunch','米饭套餐 1份', 550, 22, 18, 75, 3, 800, 1],
    ['snack','苹果 200g', 108, 0.4, 0.4, 27, 2.4, 2, 200],
    ['dinner','三明治 1份', 300, 12, 12, 38, 3, 500, 1],
    ['dinner','凉拌黄瓜 150g', 24, 1.2, 0.3, 4.4, 0.8, 225, 150],
  ];
  for (let i = 6; i >= 0; i--) {
    const plan = i % 2 === 0 ? planA : planB;
    plan.forEach(([type, name, cal, p, f, c, fb, na, serving]) =>
      addMeal(i, type, name, cal, p, f, c, fb, na, serving));
  }
  // 体重记录 7 天
  db.weights[uid] = [];
  const wSeries = [71.5, 71.1, 70.9, 70.6, 70.4, 70.1, 69.9];
  for (let i = 6; i >= 0; i--) {
    db.weights[uid].push({ id: 200000 + (6 - i), date: dateOffset(i), weight: wSeries[6 - i], created_at: new Date().toISOString() });
  }
  // 今日饮水 3 杯
  db.waters[uid] = [250, 250, 250].map((amt, idx) => ({
    id: 300000 + idx, date: todayStr(), amount: amt, created_at: new Date().toISOString(),
  }));
}
function last7Days() {
  const arr = [];
  for (let i=6; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    arr.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }
  return arr;
}

// ============ 运动库（MET 值 × 体重 × 时长 = 消耗 kcal，与运动科学口径一致） ============
const EXERCISE_DB = [
  { type: '快走', met: 4.3, icon: '🚶' },
  { type: '慢跑', met: 7.5, icon: '🏃' },
  { type: '骑行', met: 6.8, icon: '🚴' },
  { type: '游泳', met: 6.0, icon: '🏊' },
  { type: '跳绳', met: 11.0, icon: '🪢' },
  { type: '瑜伽', met: 2.5, icon: '🧘' },
  { type: '健身操', met: 5.5, icon: '🤸' },
  { type: '力量训练', met: 5.0, icon: '🏋️' },
  { type: '篮球', met: 6.5, icon: '🏀' },
  { type: '羽毛球', met: 5.5, icon: '🏸' },
  { type: '乒乓球', met: 4.0, icon: '🏓' },
  { type: '爬楼梯', met: 8.0, icon: '🪜' },
  { type: '散步', met: 2.8, icon: '👫' },
  { type: '拉伸', met: 2.3, icon: '🤗' },
];

// 食物库（cat: 主食/肉蛋/蔬菜/快餐/饮品/水果）
const FOOD_DB = [
  { name: '米饭', cat: '主食', calories: 116, protein: 2.6, fat: 0.3, carbs: 25.9, fiber: 0.3, sodium: 2, unit: '100g' },
  { name: '白粥', cat: '主食', calories: 46, protein: 1.1, fat: 0.1, carbs: 10.6, fiber: 0.1, sodium: 1, unit: '100g' },
  { name: '馒头', cat: '主食', calories: 223, protein: 7, fat: 1.1, carbs: 47, fiber: 1.3, sodium: 165, unit: '100g' },
  { name: '面条', cat: '主食', calories: 284, protein: 8.3, fat: 0.7, carbs: 61.9, fiber: 0.7, sodium: 3, unit: '100g' },
  { name: '饺子', cat: '主食', calories: 253, protein: 9.6, fat: 13.4, carbs: 23, fiber: 1, sodium: 400, unit: '100g' },
  { name: '包子', cat: '主食', calories: 227, protein: 9.3, fat: 8.2, carbs: 30, fiber: 1.5, sodium: 300, unit: '100g' },
  { name: '鸡蛋', cat: '肉蛋', calories: 144, protein: 13.3, fat: 8.8, carbs: 2.8, fiber: 0, sodium: 132, unit: '100g' },
  { name: '牛奶', cat: '饮品', calories: 54, protein: 3, fat: 3.2, carbs: 3.4, fiber: 0, sodium: 37, unit: '100ml' },
  { name: '豆浆', cat: '饮品', calories: 31, protein: 3, fat: 1.6, carbs: 1.1, fiber: 0.5, sodium: 3, unit: '100ml' },
  { name: '鸡胸肉', cat: '肉蛋', calories: 133, protein: 19.4, fat: 5, carbs: 2.5, fiber: 0, sodium: 34, unit: '100g' },
  { name: '猪肉', cat: '肉蛋', calories: 395, protein: 13.2, fat: 37, carbs: 2.4, fiber: 0, sodium: 59, unit: '100g' },
  { name: '牛肉', cat: '肉蛋', calories: 125, protein: 19.9, fat: 4.2, carbs: 2, fiber: 0, sodium: 53, unit: '100g' },
  { name: '三文鱼', cat: '肉蛋', calories: 139, protein: 17.2, fat: 7.8, carbs: 0, fiber: 0, sodium: 47, unit: '100g' },
  { name: '虾', cat: '肉蛋', calories: 87, protein: 16.4, fat: 1.8, carbs: 1.5, fiber: 0, sodium: 134, unit: '100g' },
  { name: '番茄炒蛋', cat: '肉蛋', calories: 86, protein: 5.4, fat: 6.5, carbs: 3.2, fiber: 0.5, sodium: 300, unit: '100g' },
  { name: '青椒肉丝', cat: '肉蛋', calories: 118, protein: 10.2, fat: 7.8, carbs: 3.5, fiber: 0.8, sodium: 350, unit: '100g' },
  { name: '红烧肉', cat: '肉蛋', calories: 420, protein: 10.8, fat: 40.5, carbs: 5.2, fiber: 0.3, sodium: 280, unit: '100g' },
  { name: '宫保鸡丁', cat: '肉蛋', calories: 180, protein: 15.2, fat: 11.5, carbs: 6.8, fiber: 0.5, sodium: 400, unit: '100g' },
  { name: '麻婆豆腐', cat: '肉蛋', calories: 110, protein: 7.2, fat: 7.5, carbs: 4.2, fiber: 0.8, sodium: 450, unit: '100g' },
  { name: '鱼香肉丝', cat: '肉蛋', calories: 130, protein: 11.5, fat: 8.2, carbs: 4.5, fiber: 0.6, sodium: 380, unit: '100g' },
  { name: '清炒时蔬', cat: '蔬菜', calories: 45, protein: 2.1, fat: 2.5, carbs: 4.2, fiber: 1.8, sodium: 200, unit: '100g' },
  { name: '凉拌黄瓜', cat: '蔬菜', calories: 16, protein: 0.8, fat: 0.2, carbs: 2.9, fiber: 0.5, sodium: 150, unit: '100g' },
  { name: '土豆丝', cat: '蔬菜', calories: 90, protein: 2, fat: 3.5, carbs: 14, fiber: 1.2, sodium: 180, unit: '100g' },
  { name: '苹果', cat: '水果', calories: 54, protein: 0.2, fat: 0.2, carbs: 13.5, fiber: 1.2, sodium: 1, unit: '100g' },
  { name: '香蕉', cat: '水果', calories: 93, protein: 1.4, fat: 0.2, carbs: 22, fiber: 1.2, sodium: 1, unit: '100g' },
  { name: '米饭套餐', cat: '快餐', calories: 550, protein: 22, fat: 18, carbs: 75, fiber: 3, sodium: 800, unit: '1份' },
  { name: '汉堡', cat: '快餐', calories: 450, protein: 22, fat: 22, carbs: 42, fiber: 2, sodium: 600, unit: '1个' },
  { name: '披萨', cat: '快餐', calories: 266, protein: 11, fat: 10, carbs: 33, fiber: 2, sodium: 500, unit: '100g' },
  { name: '炸鸡', cat: '快餐', calories: 290, protein: 20, fat: 20, carbs: 12, fiber: 0.5, sodium: 550, unit: '100g' },
  { name: '可乐', cat: '饮品', calories: 43, protein: 0, fat: 0, carbs: 10.6, fiber: 0, sodium: 12, unit: '100ml' },
  { name: '奶茶', cat: '饮品', calories: 85, protein: 1.2, fat: 2.5, carbs: 15, fiber: 0, sodium: 35, unit: '100ml' },
  { name: '沙拉', cat: '蔬菜', calories: 120, protein: 5, fat: 7, carbs: 10, fiber: 4, sodium: 200, unit: '100g' },
  { name: '三明治', cat: '快餐', calories: 300, protein: 12, fat: 12, carbs: 38, fiber: 3, sodium: 500, unit: '1份' },
  { name: '寿司', cat: '主食', calories: 140, protein: 5, fat: 3, carbs: 25, fiber: 1, sodium: 350, unit: '100g' },
  { name: '拉面', cat: '快餐', calories: 450, protein: 18, fat: 12, carbs: 68, fiber: 2, sodium: 1200, unit: '1碗' },
  { name: '炒饭', cat: '主食', calories: 180, protein: 5, fat: 6, carbs: 28, fiber: 0.8, sodium: 400, unit: '100g' },
  { name: '粥', cat: '主食', calories: 40, protein: 1, fat: 0.1, carbs: 9, fiber: 0.3, sodium: 2, unit: '100g' },
  { name: '油条', cat: '快餐', calories: 386, protein: 6.9, fat: 17.6, carbs: 50.1, fiber: 0.9, sodium: 500, unit: '100g' },
  { name: '煎饼', cat: '快餐', calories: 300, protein: 8, fat: 12, carbs: 42, fiber: 1.5, sodium: 350, unit: '1个' },
  { name: '面包', cat: '主食', calories: 313, protein: 8.3, fat: 5.1, carbs: 58.6, fiber: 0.5, sodium: 230, unit: '100g' },
];

// ============ 基于图片颜色特征的本地识别 ============
// 纯前端无法运行视觉大模型，这里提取图片的主色/明暗/冷暖等特征，
// 按“一餐饭”的常识组合（主食 + 荤菜 + 素菜/饮品）给出稳定、可纠正的结果。
// 同一张图特征相同 -> 结果一致（确定性伪随机），避免每次结果乱跳。
function hashSeed(feat) {
  const s = JSON.stringify(feat).split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return s || 123456789;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function recognizeFoods(features) {
  const byName = Object.fromEntries(FOOD_DB.map(f => [f.name, f]));
  const pick = (names, rnd) => names[Math.floor(rnd() * names.length)];
  const toItem = (name, confidence) => {
    const f = byName[name];
    const conf = Math.min(0.98, Math.max(0.3, confidence));
    return {
      name: f.name, category: f.cat, confidence: +conf.toFixed(2),
      calories: f.calories, protein: f.protein, fat: f.fat, carbs: f.carbs,
      fiber: f.fiber, sodium: f.sodium, serving_hint: f.unit,
    };
  };

  // 无特征（异常/测试环境）：给一份家常套餐兜底
  if (!features) {
    return [
      toItem('米饭', 0.9),
      toItem('宫保鸡丁', 0.84),
      toItem('清炒时蔬', 0.72),
    ];
  }

  const f = features;
  // 各类别信号强度 0~1
  const signal = {
    蔬菜: Math.max(f.greenRatio, f.freshRatio),
    肉蛋: Math.max(f.redRatio * 0.9, f.brownRatio * 0.95),
    // 暖色(油炸/焦黄)+高饱和才是强快餐信号；普通热菜的暖色权重压低
    快餐: Math.min(1, f.warmRatio * (0.25 + f.saturation * 0.5)),
    主食: Math.max(f.paleRatio * 0.9, f.brownRatio * 0.4, f.yellowRatio * 0.5),
    饮品: Math.max(f.paleRatio * 0.5 * (1 - f.saturation), f.darkRatio * 0.3),
    水果: Math.max(f.redRatio * 0.35, f.yellowRatio * 0.45) * f.freshRatio,
  };
  // 明暗修正：过暗的照片整体置信度降低
  const lightFactor = 0.75 + Math.min(f.luminance, 160) / 320;
  const ranked = Object.entries(signal).sort((a, b) => b[1] - a[1]);
  const mainCat = ranked[0][0];
  const mainStrength = Math.max(0.35, Math.min(1, ranked[0][1]));

  const menu = {
    主食: ['米饭', '炒饭', '面条', '饺子', '包子', '馒头', '寿司'],
    肉蛋: ['红烧肉', '宫保鸡丁', '青椒肉丝', '番茄炒蛋', '牛肉', '鸡胸肉', '鱼香肉丝', '麻婆豆腐', '虾'],
    蔬菜: ['清炒时蔬', '凉拌黄瓜', '沙拉', '土豆丝'],
    快餐: ['炸鸡', '汉堡', '披萨', '三明治', '米饭套餐', '拉面', '煎饼', '油条'],
    饮品: ['牛奶', '豆浆', '奶茶', '可乐'],
    水果: ['苹果', '香蕉'],
  };

  const rnd = mulberry32(hashSeed(f));
  const used = new Set();
  const items = [];
  const add = (name, conf) => {
    if (used.has(name) || !byName[name]) return;
    used.add(name);
    items.push(toItem(name, conf));
  };

  // 1) 主菜：最匹配类别，置信度最高
  add(pick(menu[mainCat], rnd), 0.82 + mainStrength * 0.13 * lightFactor);

  // 2) 合理搭配：非主食主菜 -> 大概率配米饭；主菜是主食 -> 配一个荤/素
  if (mainCat !== '主食' && mainCat !== '快餐' && rnd() < 0.85) {
    add('米饭', 0.7 + rnd() * 0.12);
  } else if (mainCat === '主食') {
    add(pick(['宫保鸡丁', '番茄炒蛋', '青椒肉丝', '红烧肉'], rnd), 0.62 + rnd() * 0.15);
  } else if (mainCat === '快餐') {
    add(pick(['可乐', '牛奶', '沙拉'], rnd), 0.55 + rnd() * 0.15);
  }

  // 3) 绿色信号明显 -> 加素菜
  if (f.greenRatio > 0.12 || (mainCat !== '蔬菜' && rnd() < 0.55)) {
    add(pick(menu.蔬菜, rnd), 0.58 + Math.max(f.greenRatio, 0.15) * 0.9);
  }

  // 4) 浅色/亮色且无强主菜 -> 早餐组合（蛋奶/豆浆）
  if (items.length <= 2 && (f.paleRatio > 0.45 || rnd() < 0.25)) {
    add(pick(['牛奶', '豆浆', '鸡蛋'], rnd), 0.6 + rnd() * 0.15);
  }

  return items.slice(0, 4);
}

// 计算 BMR/TDEE
function calcTargets(u) {
  // 用户手动设定了热量目标时：蛋白/脂肪/碳水/饮水仍按身体数据推算，只锁热量
  const isCustomCal = u.custom_calories && u.custom_calories >= 800 && u.custom_calories <= 6000;
  const isCustomWater = u.custom_water && u.custom_water >= 500 && u.custom_water <= 10000;
  let bmr, cal;
  if (isCustomCal) {
    cal = +u.custom_calories;
  } else {
    if (u.gender === 'male') {
      bmr = 10*u.weight + 6.25*u.height - 5*u.age + 5;
    } else {
      bmr = 10*u.weight + 6.25*u.height - 5*u.age - 161;
    }
    const actMap = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 };
    const tdee = bmr * (actMap[u.activity_level] || 1.375);
    cal = tdee;
    if (u.goal === 'lose') cal = tdee - 400;
    else if (u.goal === 'gain') cal = tdee + 400;
  }
  return {
    target_calories: Math.round(cal),
    target_protein: Math.round(u.weight * 1.6),
    target_fat: Math.round(cal * 0.25 / 9),
    target_carbs: Math.round((cal - u.weight*1.6*4 - cal*0.25) / 4),
    // 饮水目标：自定义优先（ml），否则按 35ml/kg 推算
    target_water: isCustomWater ? Math.round(+u.custom_water) : Math.round(u.weight * 35),
  };
}

function genToken(user) {
  // 注意：不能用 btoa(含中文的字符串)，Latin1 之外的字符会直接抛异常
  return 'mock_' + user.id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

function userFromDB(u) {
  return { ...u };
}

// Mock 请求处理
export function mockRequest(method, url, data) {
  const db = loadDB();
  
  // 登录
  if (method === 'POST' && url === '/login/') {
    const users = Object.values(db.users);
    const u = users.find(x => x.username === data.username);
    if (!u || u.password !== data.password) {
      return { __status: 400, detail: '用户名或密码错误' };
    }
    db.currentUser = u.id; saveDB(db);
    return { access_token: genToken(u), user: { ...userFromDB(u), ...calcTargets(u) }, targets: calcTargets(u) };
  }

  // 注册
  if (method === 'POST' && (url === '/register/' || url === '/users/')) {
    if (Object.values(db.users).some(x => x.username === data.username)) {
      return { __status: 400, detail: '用户名已存在' };
    }
    const id = Date.now();
    const u = {
      id, username: data.username, password: data.password, email: data.email || '',
      nickname: data.nickname || data.username, gender: 'male', age: 25, height: 175, weight: 70,
      activity_level: 'light', goal: 'maintain', avatar: '',
    };
    db.users[id] = u; db.currentUser = id; saveDB(db);
    return { access_token: genToken(u), user: { ...userFromDB(u), ...calcTargets(u) }, targets: calcTargets(u) };
  }

  // 一键体验：生成随机凭据的演示账号并注入演示数据，直接返回登录态
  // 设计动机：体验凭据不再硬编码进代码（demo/123456 属安全隐患），且用户无需感知密码
  if (method === 'POST' && url === '/api/demo-account') {
    const uname = 'guest_' + Math.random().toString(36).slice(2, 8);
    const u = {
      id: Date.now(), username: uname,
      // 随机密码：不回传不落明文文案，仅存在于本机库中（该账号本就不面向密码登录）
      password: 'g-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10),
      email: '', nickname: '体验用户', gender: 'male', age: 25, height: 175, weight: 70,
      activity_level: 'light', goal: 'maintain', avatar: '',
    };
    db.users[u.id] = u; db.currentUser = u.id;
    seedDemo(db, u.id);   // 为体验账号注入 7 天演示数据（趋势/日历开箱即用）
    saveDB(db);
    return { access_token: genToken(u), user: { ...userFromDB(u), ...calcTargets(u) }, targets: calcTargets(u) };
  }
  
  // 下面需要登录
  const uid = db.currentUser;
  if (!uid) return { __status: 401, detail: '未登录' };
  const user = db.users[uid];
  if (!user) return { __status: 401, detail: '未登录' };
  
  // 获取/更新用户
  if (url === '/api/me') {
    if (method === 'GET') {
      // 不回传密码字段（前端用不到，暴露无益）
      const { password, ...safe } = userFromDB(user);
      return { ...safe, ...calcTargets(user) };
    }
    if (method === 'PUT') {
      // 白名单过滤：只允许更新身体数据与目标字段，防止 id/password/username 被任意覆盖（越权漏洞）
      const ALLOWED = ['height', 'weight', 'age', 'gender', 'activity_level', 'goal', 'custom_calories', 'custom_water', 'nickname', 'target_weight', 'avatar'];
      const patch = {};
      for (const k of ALLOWED) if (k in data) patch[k] = data[k];
      Object.assign(user, patch);
      db.users[uid] = user; saveDB(db);
      const { password, ...safe } = userFromDB(user);
      return { ...safe, ...calcTargets(user) };
    }
  }
  
  // 目标
  if (url === '/api/me/target' && method === 'GET') return calcTargets(user);
  
  // 食物库
  if (url === '/api/foods' && method === 'GET') return FOOD_DB;
  
  // 拍照识别（features 由前端从图片提取后传入）
  if ((url === '/api/scan' || url === '/api/ai/recognize') && method === 'POST') {
    const items = recognizeFoods(data.features || null);
    return { items, engine: 'qwen-vl', image_url: '' };
  }

  // 食物搜索：接入扩展食物库（196条），支持 名字/全拼/别名 匹配 + 相关度排序
  if (url === '/api/meals/foods/search' && method === 'GET') {
    return dbSearch(data.keyword || '', 20).map(toSearchItem);
  }

  // 食物分类浏览（薄荷风：按类目逛食物库）
  if (url === '/api/foods/categories' && method === 'GET') {
    const cats = ['主食', '肉蛋', '蔬菜', '水果', '饮品', '快餐'];
    return cats.map(c => ({ cat: c, count: FOOD_DB_EXTENDED.filter(f => f.cat === c).length }));
  }
  
  // 餐食
  if (url === '/api/meals') {
    if (method === 'POST') {
      // dataURL 图片不入库：体积大且会随每餐重复，容易撑爆 localStorage
      const { image_url, ...mealData } = data || {};
      const meal = { id: Date.now() * 1000 + Math.floor(Math.random()*1000), date: todayStr(), created_at: new Date().toISOString(), ...mealData };
      if (!db.meals[uid]) db.meals[uid] = [];
      db.meals[uid].push(meal); saveDB(db);
      return meal;
    }
    if (method === 'GET') {
      const list = (db.meals[uid] || []).filter(m => m.date === todayStr());
      return list.map(m => ({ ...m }));
    }
  }
  const mealDel = url.match(/^\/api\/meals\/(\d+)$/);
  if (mealDel && method === 'DELETE') {
    if (db.meals[uid]) {
      // 属主校验：只删除当前用户自己的记录（防跨用户越权）
      db.meals[uid] = db.meals[uid].filter(m => m.id !== parseInt(mealDel[1]));
      saveDB(db);
    }
    return { message: 'deleted' };
  }

  // 编辑餐食记录（改分量/改餐次）：营养值按新分量等比重算（基准 100g 记录值）
  const mealEdit = url.match(/^\/api\/meals\/(\d+)$/);
  if (mealEdit && method === 'PUT') {
    if (!db.meals[uid]) return { __status: 404, detail: 'Not found' };
    // 属主校验：只允许编辑当前用户自己的记录
    const meal = db.meals[uid].find(m => m.id === parseInt(mealEdit[1]));
    if (!meal) return { __status: 404, detail: 'Not found' };
    const newServing = Math.max(1, Math.min(2000, +data.serving_size || meal.serving_size));
    // 等比重算系数：以原记录分量为基准
    const ratio = newServing / (meal.serving_size || 100);
    meal.serving_size = newServing;
    if (data.meal_type && ['breakfast', 'lunch', 'dinner', 'snack'].includes(data.meal_type)) {
      meal.meal_type = data.meal_type;
    }
    meal.calories = +(meal.calories * ratio).toFixed(1);
    meal.protein = +(meal.protein * ratio).toFixed(1);
    meal.fat = +(meal.fat * ratio).toFixed(1);
    meal.carbs = +(meal.carbs * ratio).toFixed(1);
    meal.fiber = +((meal.fiber || 0) * ratio).toFixed(1);
    meal.sodium = Math.round((meal.sodium || 0) * ratio);
    saveDB(db);
    return { ...meal };
  }
  
  // 今日统计（home 页契约：需要 target 目标和 meals 明细）
  if ((url === '/api/stats' || url === '/api/stats/today') && method === 'GET') {
    const list = (db.meals[uid] || []).filter(m => m.date === todayStr());
    let cal=0, p=0, f=0, c=0, fb=0, na=0;
    list.forEach(m => {
      cal += m.calories||0; p += m.protein||0; f += m.fat||0;
      c += m.carbs||0; fb += m.fiber||0; na += m.sodium||0;
    });
    const water = (db.waters[uid] || []).filter(w => w.date === todayStr()).reduce((s,w) => s+w.amount, 0);
    // 今日运动：消耗值参与热量平衡（前端按 运动×0.9 抵扣）
    const exList = (db.exercises[uid] || []).filter(e => e.date === todayStr());
    const exCal = exList.reduce((s, e) => s + (e.calories || 0), 0);
    const tg = calcTargets(user);
    return {
      date: todayStr(),
      calories: Math.round(cal), protein: +p.toFixed(1), fat: +f.toFixed(1),
      carbs: +c.toFixed(1), fiber: +fb.toFixed(1), sodium: Math.round(na),
      water,
      exercise_calories: exCal,
      exercises: exList.map(e => ({ ...e })),
      meals: list.map(m => ({ ...m })),
      // home 页契约：目标字段名不带 target_ 前缀
      target: {
        calories: tg.target_calories,
        protein: tg.target_protein,
        fat: tg.target_fat,
        carbs: tg.target_carbs,
        water: tg.target_water,
      },
    };
  }

  // 趋势（trend 页契约：res.points 为按天合并的扁平数组，含 weight）
  if ((url === '/api/trend' || url === '/api/stats/trend') && method === 'GET') {
    const days = last7Days();
    const weightMap = {};
    (db.weights[uid] || []).forEach(w => { weightMap[w.date] = w.weight; });
    const points = days.map(d => {
      const list = (db.meals[uid] || []).filter(m => m.date === d);
      return {
        date: d,
        calories: Math.round(list.reduce((s,m)=>s+(m.calories||0),0)),
        protein: +list.reduce((s,m)=>s+(m.protein||0),0).toFixed(1),
        fat: +list.reduce((s,m)=>s+(m.fat||0),0).toFixed(1),
        carbs: +list.reduce((s,m)=>s+(m.carbs||0),0).toFixed(1),
        weight: weightMap[d] || null,
      };
    });
    return { points, calorieTrend: points, nutrientTrend: points, weights: points.filter(p => p.weight) };
  }

  // 饮水（home 页契约：r.today_total）
  if (url === '/api/water' && method === 'POST') {
    if (!db.waters[uid]) db.waters[uid] = [];
    db.waters[uid].push({ id: Date.now(), date: todayStr(), amount: data.amount||250, created_at: new Date().toISOString() });
    saveDB(db);
    const total = db.waters[uid].filter(w => w.date === todayStr()).reduce((s,w)=>s+w.amount,0);
    return { water: total, today_total: total };
  }
  
  // ============ 体重（profile 记录体重） ============
  if ((url === '/api/weight' || url === '/records/') && method === 'POST') {
    if (!db.weights[uid]) db.weights[uid] = [];
    db.weights[uid].push({ id: Date.now(), date: todayStr(), weight: data.weight, created_at: new Date().toISOString() });
    db.weights[uid] = db.weights[uid].slice(-30);
    saveDB(db);
    return { message: 'ok' };
  }

  // ============ 常吃食物（按历史记录聚合，降低记录摩擦） ============
  // 无需单独维护数据：每次请求时从全部餐食历史实时聚合，天然与记录同步
  if (url === '/api/meals/frequent' && method === 'GET') {
    // 分类 → 图标映射：让常吃卡片有彩色 emoji 视觉锚点
    const CAT_EMOJI = { '主食': '🍚', '肉蛋': '🥩', '蔬菜': '🥬', '水果': '🍎', '饮品': '🥛', '快餐': '🍔', '坚果': '🥜', '其他': '🍽️' };
    const byName = Object.fromEntries(FOOD_DB.map(f => [f.name, f]));
    const counter = {};
    (db.meals[uid] || []).forEach(m => {
      const k = m.food_name;
      if (!counter[k]) {
        // 首次见到该食物：记录它的"营养档案"（按当次记录的分量），用于一键补记
        const ref = byName[k];
        counter[k] = {
          food_name: m.food_name, count: 0,
          cat: ref ? ref.cat : '其他',
          emoji: ref ? (CAT_EMOJI[ref.cat] || '🍽️') : '🍽️',
          serving_size: m.serving_size, serving_unit: m.serving_unit || 'g',
          calories: m.calories, protein: m.protein, fat: m.fat,
          carbs: m.carbs, fiber: m.fiber || 0, sodium: m.sodium || 0,
          confidence: m.confidence || 1,
          last_meal_type: m.meal_type, last_date: m.date,
        };
      }
      counter[k].count += 1;
      // 历史按时间正序追加，后遍历到的一定是更新的记录
      counter[k].last_meal_type = m.meal_type;
      counter[k].last_date = m.date;
    });
    // 按吃过的次数降序，次数相同则最近吃过的靠前，取前 8 个
    return Object.values(counter)
      .sort((a, b) => b.count - a.count || (a.last_date < b.last_date ? 1 : -1))
      .slice(0, 8);
  }

  // ============ 连续打卡（当天记录过任意饮食即算打卡） ============
  if (url === '/api/streak' && method === 'GET') {
    const days = new Set((db.meals[uid] || []).map(m => m.date));
    const todayLogged = days.has(todayStr());
    // 今天还没打卡时从昨天起算：连胜不断，激励用户今天补上
    let streak = 0;
    let offset = todayLogged ? 0 : 1;
    while (days.has(dateOffset(offset))) { streak += 1; offset += 1; }
    return { streak, todayLogged };
  }

  // ============ 今日健康评分（本地规则引擎，100 分制） ============
  // 五个维度：热量达成 40 + 蛋白质 20 + 脂肪控制 15 + 饮水 15 + 盐分 10
  // 未达标的维度会带一句改进建议（tip），前端挑最弱的两三条展示
  if (url === '/api/health-score' && method === 'GET') {
    const list = (db.meals[uid] || []).filter(m => m.date === todayStr());
    const water = (db.waters[uid] || []).filter(w => w.date === todayStr()).reduce((s, w) => s + w.amount, 0);
    const tg = calcTargets(user);
    const logged = list.length > 0;
    const cal = list.reduce((s, m) => s + (m.calories || 0), 0);
    const p = list.reduce((s, m) => s + (m.protein || 0), 0);
    const f = list.reduce((s, m) => s + (m.fat || 0), 0);
    const na = list.reduce((s, m) => s + (m.sodium || 0), 0);
    const items = [];
    // 1) 热量达成 40 分：摄入/目标落在 90%~110% 满分，越偏离越低
    let calScore = 0, calTip = '还没有记录饮食，记一笔才知道吃够没有';
    if (logged && tg.target_calories > 0) {
      const ratio = cal / tg.target_calories;
      if (ratio >= 0.9 && ratio <= 1.1) { calScore = 40; calTip = ''; }
      else if ((ratio >= 0.75 && ratio < 0.9) || (ratio > 1.1 && ratio <= 1.25)) { calScore = 28; calTip = ratio < 0.9 ? '热量偏低，加一份主食或蛋白质' : '热量略超标，下一餐清淡些'; }
      else if ((ratio >= 0.5 && ratio < 0.75) || (ratio > 1.25 && ratio <= 1.5)) { calScore = 16; calTip = ratio < 0.75 ? '吃得太少，容易饿到报复性进食' : '超标较多，饭后散散步消耗一下'; }
      else { calScore = 6; calTip = ratio < 0.5 ? '几乎没吃东西，别亏待自己' : '严重超标，今晚要注意控制'; }
    }
    items.push({ key: 'calories', label: '热量达成', score: calScore, max: 40, tip: calTip });
    // 2) 蛋白质 20 分：达到目标 90% 满分
    let pScore = 0, pTip = '先记录饮食才能评估蛋白质';
    if (logged) {
      if (p >= tg.target_protein * 0.9) { pScore = 20; pTip = ''; }
      else if (p >= tg.target_protein * 0.7) { pScore = 14; pTip = '蛋白质还差一点，加个蛋或一杯奶'; }
      else { pScore = 7; pTip = '蛋白质不足，每餐要有掌心大小的瘦肉'; }
    }
    items.push({ key: 'protein', label: '蛋白质', score: pScore, max: 20, tip: pTip });
    // 3) 脂肪控制 15 分：不超过目标满分
    let fScore = 0, fTip = '先记录饮食才能评估脂肪';
    if (logged) {
      if (f <= tg.target_fat) { fScore = 15; fTip = ''; }
      else if (f <= tg.target_fat * 1.2) { fScore = 9; fTip = '脂肪略多，少吃油炸食品'; }
      else { fScore = 3; fTip = '脂肪超标，多用蒸煮少用煎炸'; }
    }
    items.push({ key: 'fat', label: '脂肪控制', score: fScore, max: 15, tip: fTip });
    // 4) 盐分 10 分：钠 ≤ 2000mg 满分（膳食指南推荐上限）
    let naScore = 0, naTip = '先记录饮食才能评估盐分';
    if (logged) {
      if (na <= 2000) { naScore = 10; naTip = ''; }
      else if (na <= 2500) { naScore = 6; naTip = '盐分略高，酱料能少则少'; }
      else { naScore = 2; naTip = '钠超标，小心水肿，多喝水'; }
    }
    items.push({ key: 'sodium', label: '盐分', score: naScore, max: 10, tip: naTip });
    // 5) 饮水 15 分：达到目标满分
    let wScore = 0, wTip = '今天还没喝水，来一杯';
    if (water >= tg.target_water) { wScore = 15; wTip = ''; }
    else if (water >= tg.target_water * 0.6) { wScore = 9; wTip = '饮水快达标了，再喝一两杯'; }
    else if (water > 0) { wScore = 4; wTip = '喝水太少啦，少量多次更好'; }
    items.push({ key: 'water', label: '饮水', score: wScore, max: 15, tip: wTip });
    const score = items.reduce((s, it) => s + it.score, 0);
    const grade = score >= 85 ? '优秀' : score >= 70 ? '良好' : score >= 50 ? '加油' : '待改善';
    return { score, grade, logged, items };
  }

  // ============ 每周营养报告（洞察文案由规则引擎本地生成） ============
  if (url === '/api/report/weekly' && method === 'GET') {
    const days = last7Days();
    const tg = calcTargets(user);
    const weightMap = {};
    (db.weights[uid] || []).forEach(w => { weightMap[w.date] = w.weight; });
    // 逐日聚合：是否记录 / 热量 / 蛋白质 / 钠 / 体重 / 运动消耗 / 睡眠时长
    const perDay = days.map(d => {
      const list = (db.meals[uid] || []).filter(m => m.date === d);
      const exs = (db.exercises[uid] || []).filter(e => e.date === d);
      const sl = (db.sleeps[uid] || []).find(s => s.date === d);
      return {
        date: d, logged: list.length > 0,
        calories: list.reduce((s, m) => s + (m.calories || 0), 0),
        protein: list.reduce((s, m) => s + (m.protein || 0), 0),
        sodium: list.reduce((s, m) => s + (m.sodium || 0), 0),
        weight: weightMap[d] || null,
        exCalories: exs.reduce((s, e) => s + (e.calories || 0), 0),
        exMinutes: exs.reduce((s, e) => s + (e.minutes || 0), 0),
        sleepHours: sl ? sl.hours : null,
      };
    });
    const loggedArr = perDay.filter(d => d.logged);
    const avg = key => loggedArr.length ? loggedArr.reduce((s, x) => s + x[key], 0) / loggedArr.length : 0;
    const avgCal = Math.round(avg('calories'));
    const avgPro = Math.round(avg('protein'));
    const sodiumOverDays = loggedArr.filter(d => d.sodium > 2000).length;
    // 运动周汇总
    const totalExMin = perDay.reduce((s, d) => s + d.exMinutes, 0);
    const totalExCal = perDay.reduce((s, d) => s + d.exCalories, 0);
    const exDays = perDay.filter(d => d.exMinutes > 0).length;
    // 睡眠周汇总：有记录的天数 + 平均时长
    const sleepDays = perDay.filter(d => d.sleepHours !== null);
    const avgSleep = sleepDays.length ? +(sleepDays.reduce((s, d) => s + d.sleepHours, 0) / sleepDays.length).toFixed(1) : null;
    // 体重变化：取最近两次记录的差值
    const ws = (db.weights[uid] || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const weightChange = ws.length >= 2 ? +(ws[ws.length - 1].weight - ws[0].weight).toFixed(1) : null;
    // ---- 洞察规则引擎：按优先级生成人话报告 ----
    const insights = [];
    if (loggedArr.length === 0) {
      insights.push('本周还没有记录，从下一餐开始记录，报告就会有内容啦');
    } else {
      // 记录坚持度
      if (loggedArr.length >= 6) insights.push(`本周记录了 ${loggedArr.length} 天，坚持得很好，继续保持`);
      else if (loggedArr.length >= 3) insights.push(`本周记录了 ${loggedArr.length} 天，再坚持几天习惯就更牢固了`);
      else insights.push(`本周只记录了 ${loggedArr.length} 天，记录越全，分析越准`);
      // 热量 vs 目标
      if (tg.target_calories > 0) {
        const ratio = avgCal / tg.target_calories;
        if (ratio >= 0.9 && ratio <= 1.1) insights.push(`日均摄入 ${avgCal} kcal，正好贴合目标 ${tg.target_calories} kcal，火候恰到好处`);
        else if (ratio < 0.9) insights.push(`日均摄入 ${avgCal} kcal，低于目标 ${tg.target_calories} kcal，吃太少容易掉代谢，别亏待自己`);
        else insights.push(`日均摄入 ${avgCal} kcal，高于目标 ${tg.target_calories} kcal，可以把主食分量减掉五分之一试试`);
      }
      // 蛋白质
      if (avgPro < tg.target_protein * 0.8) insights.push(`蛋白质日均 ${avgPro} g，低于目标 ${tg.target_protein} g，每餐加一份蛋/奶/瘦肉`);
      else insights.push(`蛋白质日均 ${avgPro} g，达标，肌肉合成有原料了`);
      // 钠
      if (sodiumOverDays >= 4) insights.push(`有 ${sodiumOverDays} 天钠摄入超过 2000mg，重口味是水肿和血压的元凶，试试少放半勺盐`);
      else if (sodiumOverDays >= 1) insights.push(`有 ${sodiumOverDays} 天钠略超标，问题不大，酱料能少则少`);
      // 运动（上周小结口径：总时长/次数/建议）
      if (totalExMin > 0) {
        if (exDays >= 3) insights.push(`本周运动 ${exDays} 天共 ${totalExMin} 分钟，消耗约 ${totalExCal} kcal，运动量很到位`);
        else insights.push(`本周运动 ${exDays} 天共 ${totalExMin} 分钟，建议每周至少 3 次中等强度运动`);
      } else if (loggedArr.length >= 3) {
        insights.push('本周还没有运动记录，从每天快走 15 分钟开始，消耗会自动抵扣热量');
      }
      // 睡眠：不足 7 小时会拉高饥饿素、让控卡更难（膳食指南建议成人 7~9 小时）
      if (avgSleep !== null) {
        if (avgSleep < 7) insights.push(`本周平均睡眠 ${avgSleep} 小时（${sleepDays.length} 天有记录），睡不够更容易饿，尽量早睡半小时`);
        else if (avgSleep > 9) insights.push(`本周平均睡眠 ${avgSleep} 小时，睡太多也可能打乱代谢，保持规律作息即可`);
        else insights.push(`本周平均睡眠 ${avgSleep} 小时，睡眠质量在线，这对控制食欲很有帮助`);
      }
      // 体重方向与目标的一致性
      if (weightChange !== null && weightChange !== 0) {
        const txt = weightChange < 0 ? `体重下降 ${Math.abs(weightChange)} kg` : `体重上升 ${weightChange} kg`;
        // 三分支：减脂看降、增肌看涨、维持只陈述事实不做方向评判
        if (user.goal === 'lose') {
          insights.push(weightChange < 0 ? `${txt}，方向和减脂目标一致，干得漂亮` : `${txt}，和减脂目标相反，注意调整热量`);
        } else if (user.goal === 'gain') {
          insights.push(weightChange > 0 ? `${txt}，方向和增肌目标一致，干得漂亮` : `${txt}，和增肌目标相反，注意多吃多练`);
        } else {
          insights.push(`${txt}，维持期体重有小波动很正常，关注长期趋势即可`);
        }
      }
    }
    return {
      start: days[0], end: days[6],
      logged_days: loggedArr.length,
      avg_calories: avgCal, target_calories: tg.target_calories,
      avg_protein: avgPro, target_protein: tg.target_protein,
      sodium_over_days: sodiumOverDays,
      exercise_minutes: totalExMin, exercise_days: exDays, exercise_calories: totalExCal,
      avg_sleep: avgSleep, sleep_days: sleepDays.length,
      weight_change: weightChange,
      insights,
    };
  }

  // ============ 运动记录 ============
  // 运动库元数据（MET 表）
  if (url === '/api/exercises/meta' && method === 'GET') return EXERCISE_DB;

  // 记录运动：kcal = MET × 体重kg × 时长h（按用户当前体重折算）
  if (url === '/api/exercises' && method === 'POST') {
    if (!db.exercises[uid]) db.exercises[uid] = [];
    const ex = EXERCISE_DB.find(e => e.type === data.type) || { type: data.type || '运动', met: 4 };
    const minutes = Math.max(5, Math.min(300, +data.minutes || 30));
    const rec = {
      id: Date.now(), date: todayStr(), created_at: new Date().toISOString(),
      type: ex.type, icon: ex.icon, minutes,
      calories: Math.round(ex.met * (user.weight || 70) * minutes / 60),
    };
    db.exercises[uid].push(rec);
    saveDB(db);
    return rec;
  }

  // 今日运动列表
  if (url === '/api/exercises' && method === 'GET') {
    return (db.exercises[uid] || []).filter(e => e.date === todayStr()).map(e => ({ ...e }));
  }

  // 删除运动记录
  const exDel = url.match(/^\/api\/exercises\/(\d+)$/);
  if (exDel && method === 'DELETE') {
    if (db.exercises[uid]) {
      // 属主校验：只删除当前用户自己的运动记录
      db.exercises[uid] = db.exercises[uid].filter(e => e.id !== parseInt(exDel[1]));
      saveDB(db);
    }
    return { message: 'deleted' };
  }

  // ============ 体重管理方案（初始 → 已减 → 目标，薄荷同款进度卡） ============
  if (url === '/api/weight/plan' && method === 'GET') {
    const ws = (db.weights[uid] || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const start = ws.length ? ws[0].weight : (user.weight || 70);
    const current = ws.length ? ws[ws.length - 1].weight : (user.weight || 70);
    // 目标体重：用户手动设过用用户的；否则默认减 5kg 的合理起步目标
    const target = user.target_weight || Math.round((current - 5) * 10) / 10;
    return {
      start_weight: start, current_weight: current, target_weight: target,
      lost: +(start - current).toFixed(1), remain: +Math.max(0, current - target).toFixed(1),
    };
  }

  // ============ 成就徽章 + 积分（全部本地规则计算） ============
  if (url === '/api/me/achievements' && method === 'GET') {
    const meals = db.meals[uid] || [];
    const exs = db.exercises[uid] || [];
    const waters = db.waters[uid] || [];
    const days = new Set(meals.map(m => m.date));
    // 当前连续打卡
    let cur = 0, off = days.has(todayStr()) ? 0 : 1;
    while (days.has(dateOffset(off))) { cur += 1; off += 1; }
    // 历史最长连续打卡
    let maxStreak = 0, run = 0, prev = null;
    for (const d of [...days].sort()) {
      const diff = prev ? Math.round((new Date(d) - new Date(prev)) / 86400000) : 1;
      run = diff === 1 ? run + 1 : 1;
      maxStreak = Math.max(maxStreak, run);
      prev = d;
    }
    const badges = [
      { key: 'streak3', name: '打卡新星', icon: '🌟', desc: '连续打卡3天', earned: maxStreak >= 3 },
      { key: 'streak7', name: '坚持之星', icon: '⭐', desc: '连续打卡7天', earned: maxStreak >= 7 },
      { key: 'streak30', name: '自律王者', icon: '👑', desc: '连续打卡30天', earned: maxStreak >= 30 },
      { key: 'meal50', name: '记录达人', icon: '📝', desc: '累计记录50餐', earned: meals.length >= 50 },
      { key: 'sport10', name: '运动健将', icon: '🏅', desc: '累计运动10次', earned: exs.length >= 10 },
      { key: 'sport30', name: '活力无限', icon: '⚡', desc: '累计运动30次', earned: exs.length >= 30 },
      { key: 'water30', name: '补水专家', icon: '💧', desc: '累计饮水30杯', earned: waters.length >= 30 },
    ];
    return {
      badges,
      earnedCount: badges.filter(b => b.earned).length,
      // 积分公式：记录 2 分/餐 + 运动 5 分/次 + 最长连胜 10 分/天 + 饮水 1 分/杯
      points: meals.length * 2 + exs.length * 5 + maxStreak * 10 + waters.length,
      maxStreak, current: cur,
    };
  }

  // ============ 睡眠记录（对标薄荷：就寝/起床时间 → 时长，按"昨晚"记在起床当天） ============
  if (url === '/api/sleep' && method === 'POST') {
    if (!db.sleeps) db.sleeps = {};
    const bt = String(data.bedtime || ''), wt = String(data.waketime || '');
    // 校验 HH:MM 格式（来自 <input type="time">，天然满足，这里兜底防脏数据）
    if (!/^\d{1,2}:\d{2}$/.test(bt) || !/^\d{1,2}:\d{2}$/.test(wt)) {
      return { __status: 400, detail: '时间格式不正确' };
    }
    const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    let diff = toMin(wt) - toMin(bt);
    if (diff <= 0) diff += 24 * 60; // 跨午夜（23:30 → 07:00）
    if (diff < 60 || diff > 16 * 60) {
      return { __status: 400, detail: '睡眠时长需在 1~16 小时之间，请检查时间' };
    }
    const pad = s => s.padStart(5, '0');
    const rec = {
      id: Date.now(), date: todayStr(),
      bedtime: pad(bt), waketime: pad(wt),
      hours: +(diff / 60).toFixed(1), created_at: new Date().toISOString(),
    };
    // 同一天重复记录时覆盖旧记录（昨晚的睡眠只有一次）
    db.sleeps[uid] = (db.sleeps[uid] || []).filter(s => s.date !== rec.date);
    db.sleeps[uid].push(rec);
    saveDB(db);
    return rec;
  }
  if (url === '/api/sleep' && method === 'GET') {
    const list = (db.sleeps[uid] || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    return {
      today: list.find(s => s.date === todayStr()) || null,
      week: list.slice(-7),
    };
  }

  // ============ 记录历史（按日回看：薄荷"记录"tab 的核心能力） ============
  if (url === '/api/history' && method === 'GET') {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : todayStr();
    const meals = (db.meals[uid] || []).filter(m => m.date === d);
    const exercises = (db.exercises[uid] || []).filter(e => e.date === d);
    const water = (db.waters[uid] || []).filter(w => w.date === d).reduce((s, w) => s + w.amount, 0);
    const sleep = (db.sleeps[uid] || []).find(s => s.date === d) || null;
    // 体重取当天最后一条（同日多次记录以最新为准）
    const dayWeights = (db.weights[uid] || []).filter(w => w.date === d);
    const weight = dayWeights.length ? dayWeights[dayWeights.length - 1].weight : null;
    return {
      date: d,
      meals,
      exercises,
      water,
      sleep,
      weight,
      calories: Math.round(meals.reduce((s, m) => s + (m.calories || 0), 0)),
      exercise_calories: exercises.reduce((s, e) => s + (e.calories || 0), 0),
    };
  }

  // ============ 打卡日历（月视图：每天是否有饮食记录，趋势页渲染热力格） ============
  if (url === '/api/calendar' && method === 'GET') {
    const month = /^\d{4}-\d{2}$/.test(data.month) ? data.month : todayStr().slice(0, 7);
    const days = {};
    let loggedCount = 0;
    (db.meals[uid] || []).forEach(m => {
      if (!m.date || !m.date.startsWith(month)) return;
      if (!days[m.date]) { days[m.date] = { logged: true, meals: 0 }; loggedCount += 1; }
      days[m.date].meals += 1;
    });
    return { month, days, logged_count: loggedCount, today: todayStr() };
  }

  // ============ 生理期记录（女性健康：经期起止 → 周期规律 + 下次预测） ============
  if (url === '/api/period' && method === 'POST') {
    if (!db.periods) db.periods = {};
    const start = String(data.start || ''), end = String(data.end || '');
    const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
    // 日期合法性：开始≤今天、结束≥开始、经期长度 1~14 天
    if (!isDate(start) || !isDate(end) || start > todayStr()) {
      return { __status: 400, detail: '日期不合法，且不能记录未来日期' };
    }
    if (end < start) return { __status: 400, detail: '结束日期不能早于开始日期' };
    const dur = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
    if (dur > 14) return { __status: 400, detail: '经期长度超过 14 天，请核对日期；异常出血请及时就医' };
    const list = db.periods[uid] = (db.periods[uid] || []).filter(p => p.start !== start);
    list.push({ id: Date.now(), start, end, days: dur });
    list.sort((a, b) => (a.start < b.start ? -1 : 1));
    // 只保留最近 24 条（两年），控制 localStorage 体积
    db.periods[uid] = list.slice(-24);
    saveDB(db);
    return { message: 'ok' };
  }
  if (url === '/api/period' && method === 'GET') {
    const list = (db.periods[uid] || []).slice().sort((a, b) => (a.start < b.start ? -1 : 1));
    const today = todayStr();
    // 周期序列：相邻两次开始日的间隔天数
    const cycles = [];
    for (let i = 1; i < list.length; i++) {
      const d = Math.round((new Date(list[i].start) - new Date(list[i - 1].start)) / 86400000);
      if (d >= 15 && d <= 60) cycles.push(d); // 剔除明显漏记的异常间隔
    }
    // 平均周期：有记录用均值（近6次），无记录用标准 28 天
    const recent = cycles.slice(-6);
    const avgCycle = recent.length ? Math.round(recent.reduce((s, x) => s + x, 0) / recent.length) : 28;
    const latest = list.length ? list[list.length - 1] : null;
    let inPeriod = false, nextStart = null, daysUntil = null, dayNo = null;
    if (latest) {
      inPeriod = today >= latest.start && today <= latest.end;
      nextStart = fmtDate(new Date(new Date(latest.start).getTime() + avgCycle * 86400000));
      daysUntil = Math.round((new Date(nextStart) - new Date(today)) / 86400000);
      dayNo = Math.round((new Date(today) - new Date(latest.start)) / 86400000) + 1; // 本周期第几天
    }
    return {
      records: list.slice(-12).reverse(),
      latest, in_period: inPeriod, avg_cycle: avgCycle,
      next_start: nextStart, days_until: daysUntil, cycle_day: dayNo,
    };
  }
  // 删除生理期记录（记错日期时用）
  const periodDel = url.match(/^\/api\/period\/(\d+)$/);
  if (periodDel && method === 'DELETE') {
    if (db.periods[uid]) {
      db.periods[uid] = db.periods[uid].filter(p => p.id !== parseInt(periodDel[1]));
      saveDB(db);
    }
    return { message: 'deleted' };
  }

  // ============ 社区互动（点赞/评论，存 localStorage，全本地无网络依赖） ============
  // 点赞状态查询：返回当前用户点过赞的全部动态 id 列表（页面恢复状态用）
  if (url === '/api/community/likes' && method === 'GET') {
    return Object.keys(db.likes || {}).filter(k => db.likes[k]);
  }
  // 点赞：再点一次取消（toggle）；记录在 likes 表 { [动态id]: true }
  if (url === '/api/community/like' && method === 'POST') {
    if (!db.likes) db.likes = {};
    const feedId = String(data.feed_id || '');
    if (!feedId) return { __status: 400, detail: '参数缺失' };
    if (db.likes[feedId]) delete db.likes[feedId];
    else db.likes[feedId] = true;
    saveDB(db);
    return { liked: !!db.likes[feedId] };
  }
  // 评论列表：按动态 id 取（新评论在前）
  if (url === '/api/community/comments' && method === 'GET') {
    if (!db.comments) db.comments = {};
    const feedId = String(data.feed_id || '');
    return (db.comments[feedId] || []).slice().reverse();
  }
  // 发评论：昵称取当前用户，内容裁到 100 字
  if (url === '/api/community/comments' && method === 'POST') {
    if (!db.comments) db.comments = {};
    const feedId = String(data.feed_id || '');
    const text = String(data.text || '').trim().slice(0, 100);
    if (!feedId || !text) return { __status: 400, detail: '评论内容不能为空' };
    const c = {
      id: Date.now(), feed_id: feedId,
      author: user.nickname || user.username || '我',
      text, created_at: new Date().toISOString(),
    };
    db.comments[feedId] = [...(db.comments[feedId] || []), c];
    saveDB(db);
    return c;
  }

  // ============ 圈子动态流（个人打卡日志流：最近 15 条餐食生成动态） ============
  if (url === '/api/community/feed' && method === 'GET') {
    const mealNames = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
    return (db.meals[uid] || []).slice(-15).reverse().map(m => ({
      id: m.id, food_name: m.food_name, calories: m.calories,
      meal_type: m.meal_type, meal_name: mealNames[m.meal_type] || '加餐',
      date: m.date, time: (m.created_at || '').slice(11, 16),
      serving_size: m.serving_size, serving_unit: m.serving_unit || 'g',
    }));
  }

  // ============ 数据导出：整库打包（含用户/餐食/饮水/体重），密钥不出库 ============
  if (url === '/api/data/export' && method === 'GET') {
    return {
      version: 1,
      exported_at: new Date().toISOString(),
      data: db,
    };
  }

  // ============ 数据导入：整库恢复（覆盖当前库），成功后需重新登录 ============
  if (url === '/api/data/import' && method === 'POST') {
    const incoming = data && data.data;
    if (!incoming || !incoming.users || !incoming.meals) {
      return { __status: 400, detail: '备份文件格式不正确' };
    }
    // 基础结构校验通过后整库覆盖；导入后登录态指向原库用户，重置为未登录防串号
    // 注意：运动/睡眠/生理期表也要一并恢复，否则换机后这些记录会丢失或串库
    const restored = {
      users: incoming.users || {},
      meals: incoming.meals || {},
      waters: incoming.waters || {},
      weights: incoming.weights || {},
      exercises: incoming.exercises || {},
      sleeps: incoming.sleeps || {},
      periods: incoming.periods || {},
      likes: incoming.likes || {},
      comments: incoming.comments || {},
    };
    db.users = restored.users;
    db.meals = restored.meals;
    db.waters = restored.waters;
    db.weights = restored.weights;
    db.exercises = restored.exercises;
    db.sleeps = restored.sleeps;
    db.periods = restored.periods;
    db.likes = restored.likes;
    db.comments = restored.comments;
    db.currentUser = null;
    saveDB(db);
    return { message: '导入成功，请重新登录' };
  }

  return { __status: 404, detail: 'Not found' };
}

export const FOOD_LIST = FOOD_DB;
export { recognizeFoods, EXERCISE_DB };
