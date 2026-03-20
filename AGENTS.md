# 仓库指南

## 项目结构
本仓库是一个 `pnpm` workspace，主要包含两个应用，位于 [`apps/`](/Users/sunpm/i/appstore-price-radar/apps)：
- [`apps/web`](/Users/sunpm/i/appstore-price-radar/apps/web)：基于 Vue 3 + Vite 的前端应用。
- [`apps/worker`](/Users/sunpm/i/appstore-price-radar/apps/worker)：Cloudflare Worker API、定时任务与 Drizzle ORM。

Worker 代码按职责划分：
- 路由位于 `src/routes`
- 业务逻辑位于 `src/services`
- 通用工具位于 `src/lib`
- 数据库 schema 与 client 位于 `src/db`

SQL 迁移文件位于 `apps/worker/drizzle`，测试位于 `apps/worker/test`。

## 常用命令
- `pnpm install`：安装工作区依赖
- `pnpm dev`：同时启动 web 与 worker（`vite` + `wrangler dev`）
- `pnpm dev:web`：仅启动前端
- `pnpm dev:worker`：仅启动 worker，并启用 scheduled test support
- `pnpm build`：构建所有工作区包
- `pnpm typecheck`：运行整个工作区的 TypeScript 检查
- `pnpm lint`：对前端代码（`apps/web`）执行 ESLint
- `pnpm --filter @appstore-price-radar/worker test`：运行 worker 的 Vitest 测试
- `pnpm --filter @appstore-price-radar/worker db:generate|db:push`：管理 Drizzle schema 变更

## 编码风格与命名
使用 TypeScript `strict` 模式，相关配置见 [`tsconfig.base.json`](/Users/sunpm/i/appstore-price-radar/tsconfig.base.json)。统一使用 2 空格缩进和单引号。

前端风格由 [`apps/web/eslint.config.mjs`](/Users/sunpm/i/appstore-price-radar/apps/web/eslint.config.mjs) 中的 `@antfu/eslint-config` 约束。Vue 单文件组件使用 PascalCase 文件名，例如 `ProfileView.vue`；组合式函数使用 `useXxx.ts` 命名。

Worker 文件按领域命名，例如 `auth.ts`、`prices.ts`、`subscriptions.ts`。路由与服务命名应保持一致。

## 测试规范
Worker 包使用 Vitest。新增功能和 bug 修复应尽量补充可重复、可确定的单元测试，并对网络请求、数据库等边界进行 mock。

测试文件放在 `apps/worker/test` 下，使用 `*.test.ts` 命名，例如 `checker.price-change.test.ts`。

当前仓库没有强制 coverage 门槛，但 PR 应提供有意义的回归验证。

## 提交与 PR 规范
提交信息遵循 Conventional Commit，例如：
- `feat(scope): ...`
- `fix(scope): ...`
- `test: ...`
- `docs: ...`
- `refactor: ...`
- `chore: ...`

PR 说明建议包含：
- 问题与解决方案的简要说明
- 关联的 issue 或任务编号
- 验证步骤与执行命令
- 前端 UI 变更截图
- 环境变量、迁移或部署影响说明，例如 `drizzle/*.sql`、secrets、vars

## 安全与配置
不要提交任何 secrets。优先从 `.env.example` 和 `apps/worker/.dev.vars.example` 开始配置。本地以外的运行时变量应保存在 Cloudflare Dashboard 或 Netlify 配置中，而不是提交到仓库。

## 文案规范
- 界面文案优先表达动作、状态和结果，不写空泛口号。
- 标题、按钮、提示语尽量短，优先使用“记录、价格、评分、订阅、登录、重置密码”这类具体词。
- 避免使用“情报、洞察、中枢、信号、策略、工作台、市场动态”等包装性词语；除非它们是不可替代的正式产品概念。
- 避免使用“不是……而是……”“帮助你……”“轻松……”“高效……”“快速完成……”这类宣传句式。
- 空状态、错误提示、成功提示只说明当前状态和下一步，不重复背景，不写废话。

## 前端界面规则

- 整体界面以 PC 工作台为准，不要做成移动端卡片堆叠感、App 式页面头图或偏 landing page 的营销首页。
- 首页、应用详情、个人中心、账号安全等页面必须保持同一套视觉基线，不能首页是浅色桌面风格、内页又退回深色卡片风格。
- 默认使用浅色桌面数据面板风格，优先蓝色与橙色作为强调色，避免大面积黑白高反差、整块深色 Hero、黑底统计卡和 `slate-950` 风格主视觉。
- 截图容器、统计块、侧栏摘要卡、下载入口等高可见区域，应优先使用浅色卡片和轻量强调，不要再用黑底外壳或深色反白方案。
- 顶部导航可以有轻量级当前项提示，但不要依赖高对比激活态；如果高亮状态不稳定、容易误判，宁可统一使用普通导航样式。
- 已有全局导航时，页面内部不要再重复渲染同级页面切换导航；同一个动作也不要在同一屏重复出现多个入口或重复 CTA。
- PC 页面默认不要放“返回上一页”“返回列表”“返回公开情报”这类页面级返回按钮；只有在信息层级明显更深、单靠全局导航不足时才补充。
- 未登录状态可以保留必要的登录入口；已登录状态不要额外堆叠“进入工作台”之类的重复入口。
- 不要添加“说明式文案”“流程介绍”“设计概念说明”“工作流介绍”“feature chips”这类弱信息密度内容；除标题、字段名、按钮、状态文案外，尽量不额外生成解释性 copy。
- 功能型页面不要混入 landing page 叙事结构；不要为了“更有设计感”额外加入 workflow 区、三段式说明、步骤文案、口号文案或大段副标题。
- 前端界面文案默认全部使用中文，不要残留英文标签、英文分区名、英文 chips、英文辅助标题，除非内容本身必须保留原文。
- 谨慎使用大圆角。面板、列表项、按钮、输入框都应保持克制，避免满屏胶囊和过度圆润的视觉语言。
- 控制页面留白和模块间距，避免每一块内容都被拉得很开，导致页面像很多独立卡片拼起来。
- 页面结构要强调“整体性”和“连续性”，让相邻模块像同一个工作区，而不是彼此割裂的多个信息岛。
- 做桌面端视觉调整时，优先先收紧顶部区、主内容区、卡片半径、阴影强度和模块间距，再考虑增加装饰。

## 回复
- 使用中文交流和回复
- 文档使用中文 Markdown 格式
