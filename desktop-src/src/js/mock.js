// 纯前端 Mock 层 —— 所有数据存 localStorage，无需后端
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
    db = { users: {}, meals: {}, waters: {}, weights: {}, currentUser: null };
    changed = true;
  }
  // 老用户升级到新版时也补上演示账号（demo / 123456），不影响其已有账号
  if (!Object.values(db.users).some(u => u.username === 'demo')) {
    seedDemo(db);
    changed = true;
  }
  if (changed) saveDB(db);
  return db;
}
function saveDB(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    // 配额溢出：清理旧餐食数据（保留最近 30 天），再试
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.warn('[mock] localStorage 配额溢出，清理旧数据...');
      for (const uid of Object.keys(db.meals || {})) {
        const cutoff = dateOffset(30);
        db.meals[uid] = (db.meals[uid] || []).filter(m => m.date >= cutoff);
      }
      try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e2) { console.error('[mock] 清理后仍溢出', e2); }
    } else { throw e; }
  }
}

// 预置演示数据（demo / 123456），让趋势图等页面开箱即用
function seedDemo(db) {
  const uid = db.users[1] ? Date.now() : 1;
  const demoUser = {
    id: uid, username: 'demo', password: '123456', email: '',
    nickname: '演示用户', gender: 'male', age: 25, height: 175, weight: 70,
    activity_level: 'light', goal: 'maintain', avatar: '',
  };
  db.users[uid] = demoUser;
  if (!db.meals) db.meals = {};
  if (!db.waters) db.waters = {};
  if (!db.weights) db.weights = {};
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
  let bmr;
  if (u.gender === 'male') {
    bmr = 10*u.weight + 6.25*u.height - 5*u.age + 5;
  } else {
    bmr = 10*u.weight + 6.25*u.height - 5*u.age - 161;
  }
  const actMap = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 };
  const tdee = bmr * (actMap[u.activity_level] || 1.375);
  let cal = tdee;
  if (u.goal === 'lose') cal = tdee - 400;
  else if (u.goal === 'gain') cal = tdee + 400;
  return {
    target_calories: Math.round(cal),
    target_protein: Math.round(u.weight * 1.6),
    target_fat: Math.round(cal * 0.25 / 9),
    target_carbs: Math.round((cal - u.weight*1.6*4 - cal*0.25) / 4),
    target_water: Math.round(u.weight * 35),
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
  
  // 下面需要登录
  const uid = db.currentUser;
  if (!uid) return { __status: 401, detail: '未登录' };
  const user = db.users[uid];
  if (!user) return { __status: 401, detail: '未登录' };
  
  // 获取/更新用户
  if (url === '/api/me') {
    if (method === 'GET') return { ...userFromDB(user), ...calcTargets(user) };
    if (method === 'PUT') {
      Object.assign(user, data);
      db.users[uid] = user; saveDB(db);
      return { ...userFromDB(user), ...calcTargets(user) };
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

  // 食物搜索（支持别名/拼音/模糊匹配）
  const FOOD_ALIASES = {
    '米饭': ['饭', '白饭', '蒸饭', 'mifan'],
    '面条': ['面', '挂面', '拉面', 'miantiao'],
    '鸡蛋': ['蛋', '水煮蛋', '煮蛋', 'jidan'],
    '牛奶': ['milk', '鲜奶'],
    '鸡胸肉': ['鸡胸', '鸡胸脯肉', 'jixiongrou'],
    '番茄炒蛋': ['西红柿炒蛋', '番茄鸡蛋', 'fanqie'],
    '清炒时蔬': ['青菜', '蔬菜', '炒青菜', 'qingshao'],
    '凉拌黄瓜': ['拍黄瓜', '黄瓜', 'huanggua'],
    '红烧肉': ['扣肉', '东坡肉', 'hongshaorou'],
    '宫保鸡丁': ['宫爆鸡丁', 'gongbao'],
    '鱼香肉丝': ['yuxiang', '肉丝'],
    '麻婆豆腐': ['麻婆', '豆腐', 'mapodoufu'],
    '三明治': ['三文治', 'sanmingzhi'],
    '汉堡': ['汉堡包', 'hanbao'],
    '可乐': ['cola', 'coke'],
    '奶茶': ['珍珠奶茶', 'naicha'],
  };
  if (url === '/api/meals/foods/search' && method === 'GET') {
    const kw = (data.keyword || '').trim().toLowerCase();
    if (!kw) return FOOD_DB.slice(0, 20).map(f => ({ name: f.name, cat: f.cat, category: f.cat, calories: f.calories, protein: f.protein, fat: f.fat, carbs: f.carbs, fiber: f.fiber, sodium: f.sodium, serving_hint: '约 ' + f.unit }));
    const match = (f) => {
      if (f.name.toLowerCase().includes(kw)) return true;
      const aliases = FOOD_ALIASES[f.name] || [];
      return aliases.some(a => a.toLowerCase().includes(kw));
    };
    const picked = FOOD_DB.filter(match).slice(0, 20);
    return picked.map(f => ({ name: f.name, cat: f.cat, category: f.cat, calories: f.calories, protein: f.protein, fat: f.fat, carbs: f.carbs, fiber: f.fiber, sodium: f.sodium, serving_hint: '约 ' + f.unit }));
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
      db.meals[uid] = db.meals[uid].filter(m => m.id !== parseInt(mealDel[1]));
      saveDB(db);
    }
    return { message: 'deleted' };
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
    const tg = calcTargets(user);
    return {
      date: todayStr(),
      calories: Math.round(cal), protein: +p.toFixed(1), fat: +f.toFixed(1),
      carbs: +c.toFixed(1), fiber: +fb.toFixed(1), sodium: Math.round(na),
      water,
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
  
  // 体重（profile 记录体重）
  if ((url === '/api/weight' || url === '/records/') && method === 'POST') {
    if (!db.weights[uid]) db.weights[uid] = [];
    db.weights[uid].push({ id: Date.now(), date: todayStr(), weight: data.weight, created_at: new Date().toISOString() });
    db.weights[uid] = db.weights[uid].slice(-30);
    saveDB(db);
    return { message: 'ok' };
  }
  
  return { __status: 404, detail: 'Not found' };
}

export const FOOD_LIST = FOOD_DB;
export { recognizeFoods };
