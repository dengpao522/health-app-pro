// ============================================================
// 食谱静态库 —— 打包进 APP 的本地数据，零服务器成本
// 设计原则：
//   1. 全部家常食材、做法不超过 4 步，用户真能做出来
//   2. 每个食谱标注适用目标（goals），推荐时按用户目标过滤
//   3. 营养数据为每份估算值，与食物库口径一致（kcal/克）
// goals 取值：lose=减脂  maintain=维持  gain=增肌
// ============================================================

export const RECIPES = [
  // ---------------- 早餐 ----------------
  {
    id: 'b1', name: '全麦鸡蛋三明治', mealType: 'breakfast', goals: ['lose', 'maintain'],
    calories: 320, protein: 20, fat: 11, carbs: 36, fiber: 5, sodium: 480,
    ingredients: ['全麦面包 2片', '鸡蛋 1个', '生菜 2片', '番茄 2片', '脱脂牛奶 200ml'],
    steps: ['平底锅少油煎蛋', '面包夹入蛋、生菜、番茄', '配一杯温牛奶'],
    reason: '高蛋白+全谷物，饱腹感强，热量压在 320 kcal，减脂期早餐首选',
  },
  {
    id: 'b2', name: '燕麦香蕉杯', mealType: 'breakfast', goals: ['lose', 'maintain'],
    calories: 280, protein: 12, fat: 7, carbs: 46, fiber: 7, sodium: 60,
    ingredients: ['即食燕麦 40g', '牛奶 250ml', '香蕉 半根', '奇亚籽 5g（可选）'],
    steps: ['燕麦加热牛奶泡 3 分钟', '铺上香蕉片', '撒奇亚籽增加口感'],
    reason: '膳食纤维爆表，升糖平缓，适合控糖控卡的慢能量早餐',
  },
  {
    id: 'b3', name: '牛奶燕麦粥+水煮蛋', mealType: 'breakfast', goals: ['maintain', 'gain'],
    calories: 420, protein: 24, fat: 13, carbs: 52, fiber: 6, sodium: 180,
    ingredients: ['燕麦 50g', '牛奶 300ml', '鸡蛋 2个', '坚果 一小把'],
    steps: ['燕麦用牛奶煮成粥', '鸡蛋冷水下锅煮 8 分钟', '撒坚果碎一起吃'],
    reason: '碳水+蛋白双充足，增肌期早晨的黄金组合',
  },
  {
    id: 'b4', name: '豆浆套餐', mealType: 'breakfast', goals: ['maintain', 'gain'],
    calories: 450, protein: 22, fat: 14, carbs: 58, fiber: 4, sodium: 320,
    ingredients: ['豆浆 300ml', '菜包 1个', '茶叶蛋 1个', '小番茄 5颗'],
    steps: ['豆浆加热', '包子蒸 5 分钟', '配蛋和水果，方便带走的早餐'],
    reason: '中式经典搭配，植物蛋白+主食均衡，赶时间的上班上学日友好',
  },

  // ---------------- 午餐 ----------------
  {
    id: 'l1', name: '鸡胸肉沙拉餐', mealType: 'lunch', goals: ['lose'],
    calories: 380, protein: 35, fat: 12, carbs: 28, fiber: 8, sodium: 520,
    ingredients: ['鸡胸肉 150g', '生菜/苦菊 150g', '小番茄 6颗', '玉米 半根', '油醋汁 15ml'],
    steps: ['鸡胸肉用黑胡椒腌 10 分钟后煎熟切片', '蔬菜洗净装盘', '淋油醋汁拌匀'],
    reason: '35g 蛋白质+超低热量，减脂午餐的天花板组合',
  },
  {
    id: 'l2', name: '杂粮饭+清蒸鲈鱼', mealType: 'lunch', goals: ['lose', 'maintain'],
    calories: 520, protein: 38, fat: 14, carbs: 58, fiber: 6, sodium: 460,
    ingredients: ['杂粮饭 1碗', '鲈鱼 1段(约150g)', '西兰花 100g', '姜丝葱丝少许'],
    steps: ['杂粮饭电饭煲焖熟', '鲈鱼铺姜丝蒸 8 分钟，淋少许蒸鱼豉油', '西兰花焯水 2 分钟围边'],
    reason: '清蒸做法控住油脂，优质蛋白+复合碳水，营养密度拉满',
  },
  {
    id: 'l3', name: '番茄牛腩面', mealType: 'lunch', goals: ['maintain', 'gain'],
    calories: 640, protein: 32, fat: 18, carbs: 82, fiber: 7, sodium: 880,
    ingredients: ['生面条 150g', '牛腩 100g', '番茄 2个', '青菜 2棵'],
    steps: ['牛腩炖软（可提前批量做好）', '番茄炒出沙加水做汤底', '下面条和青菜煮 3 分钟'],
    reason: '训练日午餐的好选择，碳水充足帮你有劲练、练完长得快',
  },
  {
    id: 'l4', name: '虾仁滑蛋盖饭', mealType: 'lunch', goals: ['maintain', 'gain'],
    calories: 580, protein: 34, fat: 15, carbs: 72, fiber: 3, sodium: 620,
    ingredients: ['米饭 1碗', '虾仁 100g', '鸡蛋 2个', '胡萝卜丁+豌豆 少许'],
    steps: ['虾仁焯水 30 秒捞起', '蛋液炒到半凝固下虾仁', '盖在热米饭上'],
    reason: '高蛋白易吸收，口感嫩滑，增肌期吃不腻的基础款',
  },

  // ---------------- 晚餐 ----------------
  {
    id: 'd1', name: '虾仁冬瓜汤+凉拌豆腐', mealType: 'dinner', goals: ['lose'],
    calories: 260, protein: 24, fat: 9, carbs: 14, fiber: 3, sodium: 640,
    ingredients: ['虾仁 80g', '冬瓜 200g', '嫩豆腐 1块', '香菜香油少许'],
    steps: ['冬瓜切片煮汤，水开下虾仁煮 2 分钟', '豆腐焯水后凉拌', '一汤一凉菜，清爽收尾'],
    reason: '整餐不到 300 kcal，高蛋白低热量，晚上吃不怕堆积',
  },
  {
    id: 'd2', name: '彩椒鸡丁+小碗糙米饭', mealType: 'dinner', goals: ['lose', 'maintain'],
    calories: 450, protein: 32, fat: 12, carbs: 48, fiber: 6, sodium: 520,
    ingredients: ['鸡胸肉 120g', '彩椒 2个', '糙米饭 小碗', '蒜末少许'],
    steps: ['鸡丁生抽腌 10 分钟', '大火滑炒鸡丁，下彩椒 1 分钟', '配小碗糙米饭'],
    reason: '有肉有菜有饭的完整晚餐，热量控制在 450 kcal 不将就',
  },
  {
    id: 'd3', name: '清炒牛肉+蒜蓉油麦菜', mealType: 'dinner', goals: ['maintain', 'gain'],
    calories: 520, protein: 36, fat: 20, carbs: 42, fiber: 5, sodium: 580,
    ingredients: ['牛肉 120g', '油麦菜 200g', '米饭 1碗', '蒜 3瓣'],
    steps: ['牛肉逆纹切薄片，淀粉抓匀', '热锅快炒牛肉至变色盛出', '蒜蓉炒油麦菜，合炒装盘'],
    reason: '铁+蛋白双高的增肌晚餐，绿叶菜补足微量元素',
  },
  {
    id: 'd4', name: '三文鱼藜麦碗', mealType: 'dinner', goals: ['maintain', 'gain'],
    calories: 540, protein: 33, fat: 22, carbs: 46, fiber: 6, sodium: 380,
    ingredients: ['三文鱼 120g', '藜麦(或糙米) 60g', '牛油果 1/4个', '海苔碎少许'],
    steps: ['藜麦煮 15 分钟', '三文鱼煎至两面微焦', '装碗摆牛油果，撒海苔碎'],
    reason: 'Omega-3 优质脂肪+完整蛋白，训练恢复期的营养充电站',
  },
];

// 按用户目标 + 餐次过滤推荐
// 规则：优先取 goals 包含用户目标的食谱；若该餐次可选太少，放宽到全部
export function recommendRecipes(goal, mealType) {
  const pool = RECIPES.filter(r => r.mealType === mealType);
  const matched = pool.filter(r => r.goals.includes(goal));
  // 匹配目标 >=2 个就用匹配结果，否则返回该餐次全部（避免没得选）
  return matched.length >= 2 ? matched : pool;
}

// 根据当前时间返回默认展示的餐次
export function mealTypeByHour() {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 21) return 'dinner';
  return 'breakfast'; // 深夜看就推荐明天的早餐
}
