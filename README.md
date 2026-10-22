# 健康饮食助手 (HealthPro)

> 一款**纯前端、零服务器成本**的健康饮食管理 App：拍照 AI 识别 → 营养分析 → 智能推荐 → 习惯养成，覆盖"记录 → 分析 → 改变 → 陪伴"完整闭环。
>
> Vue 3 + Vite 构建，DCloud 5+ 壳云打包 Android APK（v1.2.0），AI 视觉识别由 Cloudflare Worker 代理（可降级离线运行）。

---

## 为什么做这个项目

市面上的健康饮食 App（薄荷健康等）功能很全，但作为 AI 专业的学生，我更想回答一个工程问题：**一个健康类 App，能不能在不依赖自建后端的前提下，做到功能完整、数据私有、成本为零？**

这个项目就是这个问题的答案：所有业务数据存 `localStorage`（整库可导出/导入 JSON），AI 识别走 Cloudflare Worker 免费额度代理，构建产物直接打进 DCloud 壳生成 APK——**运行成本 0 元/月**，同时保留了完整的用户功能面（507 条食物库、评分引擎、轻断食、生理期、周报、社区互动等 30+ 功能）。

## 快速开始（3 分钟）

```bash
# 1) 启动 Web 预览（无需任何后端）
cd desktop-src
npm install
npm run dev        # 浏览器打开，演示账号 demo / 123456

# 2) 构建 + 电脑预览（仓库根目录）
cd ..
双击 双击预览.bat    # 或: python -m http.server 8100 --directory web_dist
```

APK 打包：HBuilderX 打开仓库根目录 → 发行 → 原生 App 云打包（manifest 已配好 5+ 壳）。

## 架构

```
┌─────────────────────────────────────────────────────┐
│                 Android APK (DCloud 5+ 壳)           │
│                                                     │
│   Vue 3 + vue-router(hash) + Vite                   │
│   ┌──────────────┬──────────────┬────────────────┐  │
│   │  12 个页面    │  uni API 兼容层 │  主题系统      │  │
│   │  home/scan/  │  polyfill.js  │  CSS 变量      │  │
│   │  trend/community │ (storage/ │  浅色/深色/跟随 │  │
│   │  fasting/... │  toast/nav/   │  系统三态      │  │
│   │              │  canvas...)   │               │  │
│   └──────┬───────┴──────┬───────┴───────┬───────┘  │
│          │              │               │          │
│   ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼───────┐  │
│   │ request.js  │ │ food-db   │ │ localStorage │  │
│   │ 统一请求层   │ │ 507条食物库│ │ mock.js 整库 │  │
│   │ SSE流式+降级 │ │ +评分引擎  │ │ (可导出备份) │  │
│   └──────┬──────┘ └───────────┘ └──────────────┘  │
└──────────┼──────────────────────────────────────────┘
           │ POST {image} + x-app-client 头
   ┌───────▼───────────────┐
   │  Cloudflare Worker     │  免费额度 · 免运维
   │  ① 客户端标识校验       │
   │  ② 单IP限流 10次/60s   │
   │  ③ 图片 6MB 上限       │
   │  ④ 转发阿里云百炼       │
   │     qwen-vl 视觉模型   │
   └────────────────────────┘
```

**关键取舍**：不引入 Node 后端 + 数据库，换取零成本与数据私有；代价是单机数据（用整库导出/导入迁移弥补）。这个取舍在健康数据"敏感 + 低频写 + 单用户"的场景下是划算的。

## 五个技术亮点（面试向）

### 1. 分类评分引擎——"一把尺子量所有食物"是不对的

最初用单一公式给所有食物打分，结果可乐 71 分（黄灯）、鸡胸肉也 71 分——显然失真。重构为**按食物大类使用不同评分模板**：饮品重罚"空热量糖水"（高糖+无蛋白一票定性红灯），肉蛋看蛋白质与脂肪比，果蔬看纤维与热量密度，坚果认可好脂肪但重罚盐焗高钠。线性计分函数 `lin(value, good, bad, max)` 支持**双向**（"越低越好"与"越高越好"两种方向），16 项抽样校准：鸡胸肉 99 绿 / 可乐 45 红 / 糙米饭 82 绿 > 白米饭 65 黄（全谷物分度正确）。

代码：[`desktop-src/src/js/food-db.js`](desktop-src/src/js/food-db.js) · [`scoreFood()`](desktop-src/src/js/food-db.js)

### 2. SSE 流式识别 + 离线降级——AI 不可用时不卡死用户

拍照识别走 Cloudflare Worker → 阿里云百炼 qwen-vl。两个工程细节：

- **流式**：模型逐菜认出（SSE `data:` 事件），前端每认出一道菜立即上屏，首包 45s、间隔 30s 双超时闸门；
- **降级**：网络故障/服务 5xx 时自动回退到**本地颜色启发式估算**（canvas 采样 24×24 像素统计冷暖色/饱和度 → 确定性伪随机组合一餐家常菜），结果标注"离线估算（仅供参考）"，用户永不面对白屏。用户主动取消和"图片里没有食物"是正常业务结果，不触发降级。

代码：[`desktop-src/src/js/request.js`](desktop-src/src/js/request.js) · [`uploadFileStream()`](desktop-src/src/js/request.js)

### 3. 防刷三层——开源代理接口的自保

Worker 是公开接口，必须假设会被扫到。三层防护全部在请求路径内完成：① 自定义请求头 `x-app-client: healthpro-v1` 校验（挡住裸 curl）；② 单 IP 滑动窗口限流 10 次/60s（内存 Map + **请求路径内惰性过期清理**——Cloudflare Workers 禁止全局定时器 `setInterval`，这是平台约束下的设计妥协）；③ base64 图片 6MB 上限（挡大 payload 放大攻击）。线上已验证：裸调用 403、带头 200。

代码：[`worker.js`](worker.js)

### 4. 自研 uni API 兼容层——一套业务代码，Web 与 APK 双端运行

不引入 uni-app 全家桶编译链，而是抽了一个 ~340 行的 **uni API polyfill**：`storage/toast/modal/actionSheet/chooseImage(含压缩)/createCanvasContext(design 缩放)/导航` 等 20+ API 映射到 Web 实现，页面代码全部按 uni 风格写（`onLoad/onShow/uni.showToast`），既能在浏览器直接跑（本地开发效率），又能无缝进 DCloud 壳云打包 APK（上架形态）。导航 polyfill 将 uni 风格路径（`/pages/x/x?k=v`）转换为 vue-router 路由对象并**完整保留查询参数**——这里曾有一个把 `?name=xxx` 一起截掉的 bug，导致详情页必空白，修复过程让我对"抽象层吞信息"这类问题格外警惕。

代码：[`desktop-src/src/uni/polyfill.js`](desktop-src/src/uni/polyfill.js)

### 5. 本地规则引擎替代云端 AI——零成本的"智能"

健康评分（热量达成/蛋白质/脂肪/盐分/饮水五维）、每周营养报告（记录坚持度/热量偏差/钠超标/运动量/体重方向与目标一致性，全部生成人话洞察）、食谱智能推荐（按"今日余量热量"动态排序，超量的食谱主动提示减半）、生理期周期预测（近 6 次周期均值 + 异常间隔剔除）——这些"智能感"功能全部是**可测试的纯函数**，不依赖任何云端模型，成本为零且行为确定。

代码：[`desktop-src/src/js/mock.js`](desktop-src/src/js/mock.js) · [`recipes.js`](desktop-src/src/js/recipes.js)

## 功能全景

| 模块 | 功能 |
|---|---|
| 记录 | 拍照 AI 识别（流式）/ 手动搜索（507 条食物库，拼音+别名）/ 常吃一键记录 / 运动（MET 公式）/ 饮水 / 体重 / 睡眠 / 生理期（周期预测，女性账号才显示） |
| 分析 | 今日热量仪表盘（四营养素迷你环）/ 食物详情（NRV 占比）/ 食物对比 / 健康评分五维 / 趋势图表（canvas 手绘）/ 打卡日历 / 每周营养报告 + 分享图（canvas 海报） |
| 改变 | 食谱推荐（按余量智能排序）/ 轻断食计时器（14:10/16:8/18:6 周期引擎）/ 健康工具箱（BMI/BMR/TDEE/体脂率/理想体重/饮水 六计算器联动）/ 饮水提醒 |
| 陪伴 | 社区动态（点赞/评论/话题）/ 成就徽章 + 积分 / 连续打卡 |
| 基建 | 深色模式全量适配（含 canvas 图表主题感知）/ 数据整库导出导入 / 全局错误兜底 / 存储容量预警 |

## 测试

```bash
npm test    # 评分引擎抽样 / 断食周期公式 / 工具箱健康公式 / mock 全接口冒烟 / 安全回归（越权与字段覆盖）
```

## 目录结构

```
health-app-pro/
├── desktop-src/          # 前端源码工程（Vue3 + Vite）
│   └── src/
│       ├── pages/        # 12 个页面
│       ├── js/           # request(AI/降级) mock(数据层) food-db(库+评分) recipes
│       └── uni/          # 自研 uni API 兼容层 + 组件映射
├── assets/               # 构建产物（由 desktop-src 构建同步，APK 打包引用）
├── index.html            # 壳入口（隐私弹窗 + 资源引用）
├── worker.js             # Cloudflare Worker（AI 代理 + 防刷三层）
├── huawei-function/      # 同逻辑的华为函数计算副本（容灾）
├── privacy.html          # 隐私政策（上架合规）
├── repack.ps1            # HBuilderX CLI 云打包脚本
└── tests/                # Node 原生测试（npm test）
```

## 作者

赵建辉 · AI 专业本科 · [GitHub](https://github.com/dengpao522)

这个项目仍在迭代中。如果你对"零后端健康 App 的边界"、"uni 兼容层的取舍"或"评分引擎的校准方法"感兴趣，欢迎交流。
