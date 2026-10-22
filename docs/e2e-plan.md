# E2E 测试方案（规划中）

> 现状：39 个单元/集成测试覆盖数据层与纯函数（`npm test`）。本文档是 UI 端到端测试的实施蓝图，
> 按本方案落地后可补上"用户操作 → 界面反馈 → 数据持久化"全链路的自动化验证。

## 为什么选 Playwright

| 候选 | 结论 |
|---|---|
| **Playwright** | ✅ 选它：微软维护、自动等待（免手写 sleep）、支持多浏览器、对 Vite 开发服务器有原生集成 |
| Cypress | 生态好但架构受限（同源代理），对 hash 路由 + localStorage 密集应用的调试体验一般 |
| Selenium | 太重，现代前端项目不推荐 |

## 目标架构

```
desktop-src/               # 业务源码
tests/e2e/                 # E2E 用例（Playwright）
├── fixture/seed.mjs       # 测试种子：预置 localStorage 库（注册/登录态/历史数据）
└── *.spec.mjs             # 按用户旅程组织的用例
playwright.config.mjs      # webServer 指向 vite dev server
```

关键设计：**每个用例从已知状态出发**——`storageState` 或 `addInitScript` 预注入种子库，
不依赖用例执行顺序，可任意并行。

## 首批用例清单（按用户旅程）

### 旅程 1：新用户注册 → 首页仪表盘
1. 打开 `/register`，填用户名密码提交
2. 断言：跳转 `/home`，问候语含用户昵称
3. 断言：localStorage 出现 `health_app_mock_db` 且 currentUser 指向新用户

### 旅程 2：一键体验 → 记录一餐 → 数据联动
1. 登录页点「一键体验」
2. 断言：进入 `/home`，热量环显示 0
3. 点「常吃」第一格（或搜索"鸡胸肉"添加）
4. 断言：toast 出现"已记入"，热量环数值增长，餐次列表出现该食物
5. **刷新页面**，断言记录仍在（持久化验证）

### 旅程 3：搜索 → 食物详情 → 评分
1. 拍照页搜索"鸡胸肉" → 点详情
2. 断言：详情页评分环 ≥ 75（绿灯）、NRV 表格 5 行
3. 点「对比」→ 搜"五花肉" → 断言对比表出现且结论为绿灯侧胜出

### 旅程 4：轻断食计时器（时钟推进）
1. 进入 `/fasting`，选 14:10，点开始
2. 断言：倒计时显示 `13:59:xx` 区间
3. **mock Date.now()** 快进 14h（Playwright `page.clock`），断言自动切换"进食窗口"

### 旅程 5：深色模式全量
1. 「我的」→ 切深色 → 遍历 5 个 tab
2. 断言：每页 `data-theme="dark"` 且无白色残块（采样 `.dash-card` 背景色非 #fff）

### 旅程 6：数据备份闭环
1. 导出 JSON（拦截 download 事件拿内容）
2. 清库 → 导入同一文件 → 断言：餐食记录与导出前一致

## 运行方式（落地后）

```bash
npx playwright install chromium
npx playwright test        # 本地全量
npx playwright test --ui   # 有头调试模式
```

CI 集成：在现有 `.github/workflows/ci.yml` 的 matrix job 后追加 `e2e` job
（`npm run build && npx playwright test`），预计单次运行 2~3 分钟。

## 排期说明

单元层（39 用例）已覆盖业务规则的正确性；E2E 解决的是"页面接线"回归——
建议在功能进入维护期（不再频繁改动 UI）后落地，避免 UI 频繁变动导致用例维护成本失控。
