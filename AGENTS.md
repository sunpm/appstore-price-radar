# Repository Guidelines

## Project Structure & Module Organization
This repository is a `pnpm` workspace with two apps in [`apps/`](/Users/sunpm/i/appstore-price-radar/apps):
- [`apps/web`](/Users/sunpm/i/appstore-price-radar/apps/web): Vue 3 + Vite frontend.
- [`apps/worker`](/Users/sunpm/i/appstore-price-radar/apps/worker): Cloudflare Worker API, scheduled jobs, and Drizzle ORM.

Worker code is organized by responsibility: routes in `src/routes`, business logic in `src/services`, shared utilities in `src/lib`, and database schema/client in `src/db`. SQL migrations live in `apps/worker/drizzle`. Tests live in `apps/worker/test`.

## Build, Test, and Development Commands
- `pnpm install`: install all workspace dependencies.
- `pnpm dev`: run web and worker together (`vite` + `wrangler dev`).
- `pnpm dev:web`: run only the frontend.
- `pnpm dev:worker`: run only the worker with scheduled test support.
- `pnpm build`: build all workspace packages.
- `pnpm typecheck`: run TypeScript checks across workspace.
- `pnpm lint`: lint frontend code (`apps/web`) using ESLint.
- `pnpm --filter @appstore-price-radar/worker test`: run worker tests (Vitest).
- `pnpm --filter @appstore-price-radar/worker db:generate|db:push`: manage Drizzle schema changes.

## Coding Style & Naming Conventions
Use TypeScript with `strict` mode (see [`tsconfig.base.json`](/Users/sunpm/i/appstore-price-radar/tsconfig.base.json)). Prefer 2-space indentation and single quotes.

Frontend style is enforced by `@antfu/eslint-config` in [`apps/web/eslint.config.mjs`](/Users/sunpm/i/appstore-price-radar/apps/web/eslint.config.mjs). Vue SFCs use PascalCase filenames (for example, `ProfileView.vue`), and composables use `useXxx.ts`.

Worker files are domain-oriented (`auth.ts`, `prices.ts`, `subscriptions.ts`). Keep route and service naming aligned.

## Testing Guidelines
Vitest is configured in the worker package. Add tests under `apps/worker/test` with `*.test.ts` naming (for example, `checker.price-change.test.ts`). New features and bug fixes should include deterministic unit tests with mocks for network/database boundaries.

No coverage threshold is currently enforced, but PRs should include meaningful regression coverage.

## Commit & Pull Request Guidelines
Follow Conventional Commit style seen in history: `feat(scope): ...`, `fix(scope): ...`, `test: ...`, `docs: ...`, `refactor: ...`, `chore: ...`.

PRs should include:
- concise problem/solution summary,
- linked issue or task ID,
- verification steps (commands run),
- screenshots for frontend UI changes,
- notes for env or migration impacts (`drizzle/*.sql`, secrets, vars).

## Security & Configuration Tips
Never commit secrets. Start from `.env.example` and `apps/worker/.dev.vars.example`. Keep production runtime variables in Cloudflare Dashboard/Netlify settings, not in committed config files.

## 前端界面规则

- 顶部导航不要做“当前路由高亮”。如果高亮状态不稳定、容易误判，宁可统一使用无激活态的普通导航样式。
- PC 页面默认不要放“返回上一页”“返回列表”“返回公开情报”这类页面级返回按钮，优先依赖顶部导航和信息架构完成跳转。
- 整体界面以 PC 工作台为准，不要做成移动端卡片堆叠感或 App 式页面头图。
- 谨慎使用大圆角。面板、列表项、按钮、输入框都应保持克制，避免满屏胶囊和过度圆润的视觉语言。
- 控制页面留白和模块间距，避免每一块内容都被拉得很开，导致页面像很多独立卡片拼起来。
- 页面结构要强调“整体性”和“连续性”，让相邻模块像同一个工作区，而不是彼此割裂的多个信息岛。
- 做桌面端视觉调整时，优先先收紧顶部区、主内容区、卡片半径、阴影强度和模块间距，再考虑增加装饰。
- 默认使用浅色桌面数据面板风格，优先蓝色与橙色作为强调色，避免大面积黑白高反差、整块深色 Hero、黑底统计卡和 `slate-950` 风格主视觉。
- 首页、应用详情、个人中心、账号安全等页面必须保持同一套视觉基线，不能首页是浅色桌面风格、内页又退回深色卡片风格。
- 不要添加“说明式文案”“流程介绍”“设计概念说明”“工作流介绍”“feature chips”这类弱信息密度内容；除标题、字段名、按钮、状态文案外，尽量不额外生成解释性 copy。
- 功能型页面不要混入 landing page 叙事结构；不要为了“更有设计感”额外加入 workflow 区、三段式说明、步骤文案、口号文案或大段副标题。
- 已有全局导航时，页面内部不要再重复渲染同级页面切换导航；同一个动作也不要在同一屏重复出现多个入口。
- 未登录状态可以保留必要的登录入口；已登录状态不要额外堆叠“进入工作台”之类的重复 CTA。
- 前端界面文案默认全部使用中文，不要残留英文标签、英文分区名、英文 chips、英文辅助标题，除非内容本身必须保留原文。
- 截图容器、统计块、侧栏摘要卡、下载入口等高可见区域，应优先使用浅色卡片和轻量强调，不要再用黑底外壳或深色反白方案。

## 回复

- 使用中文交流和回复
- 文档使用中文 markdown 格式
