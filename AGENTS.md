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

## 回复

- 使用中文交流和回复
- 文档使用中文 markdown 格式
