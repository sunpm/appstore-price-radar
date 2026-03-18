# Project Research Summary

**Project:** App Store Price Radar
**Domain:** App Store 价格监听与降价提醒平台（brownfield）
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

这是一个已经具备基础功能闭环的 brownfield 价格监听产品：用户可以注册登录、订阅 App 与国家/地区、等待定时巡检、接收降价邮件，并在前端查看公开降价流和历史详情。当前真正阻碍它进入稳定迭代阶段的，不是缺少新页面，而是几条直接关系到“提醒是否可信”的底层链路还不够稳。

基于现有代码与 codebase map，推荐策略不是换栈重写，而是在现有 `Vue 3 + Cloudflare Worker + Drizzle + Neon` 架构上，分阶段修正迁移基线、价格采集一致性、巡检互斥、认证防护、契约共享和回归测试。这样既能保留现有功能价值，也能尽快把“可用”推进到“可依赖”。

最大的风险来自三类问题：错误价格入库导致误报、任务/安全边界不稳导致副作用失控、以及前后端契约漂移导致 UI 在用户侧才暴露问题。路线图需要优先围绕这些风险排序，而不是先扩产品边界。

## Key Findings

### Recommended Stack

当前仓库的技术栈本身没有成为瓶颈。`Vue 3 + Vite`、`Cloudflare Workers + Hono`、`Drizzle + Neon`、`Zod` 与 `Resend` 的组合仍然适合这类低运维、定时采集型产品。与其引入新的框架或服务，不如先把 schema、任务与契约边界做扎实。

**Core technologies:**
- Vue 3 + Vite: 前端 SPA 与页面交互 — 现有页面结构已经成型
- Cloudflare Workers + Hono: API 与定时任务执行 — 适合当前低运维形态
- Drizzle + Neon: 数据模型与持久化 — 适合继续治理 schema 漂移和查询边界

### Expected Features

该领域的 table stakes 已基本具备，但“可信价格历史”和“可信提醒”还需要进一步固化。当前里程碑应优先补稳现有核心价值，而不是追求更多外延功能。

**Must have (table stakes):**
- 统一初始化与部署链路 — 否则新环境无法稳定运行
- 可信价格快照、历史与降价提醒 — 这是产品核心价值
- 基础认证、订阅管理与公开 feed — 用户已经默认需要这些能力

**Should have (competitive):**
- 按国家/地区监听与即时刷新体验
- 公开降价流与 App 历史详情的稳定展示

**Defer (v2+):**
- 多商店支持
- 原生移动端
- 高频实时抓价与复杂分析能力

### Architecture Approach

继续沿用现有双应用结构，但要把高风险链路拆得更可控：route 继续保持薄，service 继续承担业务语义，采集/持久化/通知/任务编排要逐步从热点函数中解耦出来。前后端之间最该新增的不是更多共享状态，而是共享契约。

**Major components:**
1. `apps/web` — 用户工作台、公开 feed、详情与认证页面
2. `apps/worker` — API、定时巡检、认证服务与外部集成
3. `Neon + Resend + Apple Lookup API` — 数据存储、通知与价格来源

### Critical Pitfalls

1. **迁移基线漂移** — 统一 schema / 文档 / smoke path，先让新环境能可靠起步
2. **缺失价格被写成 `0`** — 把无效价格视为异常，不写快照/事件/邮件
3. **巡检无互斥且写入非原子** — 增加任务互斥与单刷新一致性边界
4. **认证入口缺少限流** — 为登录、验证码和重置流程增加防爆破保护
5. **前后端契约漂移** — 共享 DTO 来源并补回归测试

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: 数据基线与可部署性
**Rationale:** 先让新环境和文档可信，否则后续修复无法稳定验证。
**Delivers:** 统一迁移基线、部署说明和 fresh install smoke path。
**Addresses:** DATA-01, DATA-02, DATA-03
**Avoids:** 迁移漂移导致的运行期缺表问题

### Phase 2: 价格数据正确性
**Rationale:** 产品最核心的价值是“价格信号可信”，必须先修采集与落库一致性。
**Delivers:** 有效价格判断、单刷新一致性和共享刷新规则。
**Uses:** 现有 checker / appstore / db 链路
**Implements:** 采集与事件持久化边界

### Phase 3: 调度与认证安全
**Rationale:** 在正确性之后，下一优先级是防止任务重叠与高风险入口被滥用。
**Delivers:** 任务互斥、巡检统计、认证限流、凭证生命周期治理和强制鉴权。

### Phase 4: 契约与前端稳态
**Rationale:** 当后端边界稳定后，再收敛 DTO 与页面共享逻辑，能显著降低回归噪音。
**Delivers:** 统一 DTO、共享鉴权处理、历史查询体验优化。

### Phase 5: Feed 性能与回归保障
**Rationale:** 把公开 feed 与测试/验证链路补齐，才能支撑持续迭代和更放心地发布。
**Delivers:** 首页聚合优化、关键 Worker 测试、前端关键路径测试、统一验证命令。

### Phase Ordering Rationale

- 先修部署基线，再修核心采集链路，避免在不稳定环境里排查高副作用问题。
- 任务互斥和认证安全要晚于数据正确性，但早于大规模前端整理，因为它们直接影响线上风险。
- DTO/前端稳态应建立在后端行为更稳定之后，否则共享契约会反复变化。
- 测试与发布验证放在收尾阶段，但会覆盖前面阶段产出的核心风险点。

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** 如要引入 Cloudflare 原生限流或任务租约实现，需要结合当前运行环境细化方案
- **Phase 5:** 若公开 feed 采用预聚合或缓存策略，需根据真实数据规模决定实现方式

Phases with standard patterns (skip research-phase):
- **Phase 1:** 迁移基线统一、文档校正和 smoke path 属于明确的 brownfield 收敛工作
- **Phase 2:** 价格有效性判断与单刷新一致性目标已经足够明确

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 基于仓库当前实际依赖与运行结构 |
| Features | HIGH | 基于 README、现有页面与 codebase map |
| Architecture | HIGH | 关键分层、数据流与热点模块都已梳理清楚 |
| Pitfalls | HIGH | 已有 concern 文档给出了明确风险证据 |

**Overall confidence:** HIGH

### Gaps to Address

- 真实线上数据规模未知 — 在 Phase 5 规划 feed 优化时再决定是否需要缓存/预聚合
- 认证限流与任务互斥的具体 Cloudflare 实现方式尚未定案 — 在 Phase 3 规划时补技术选型

## Sources

### Primary (HIGH confidence)
- `README.md` — 产品能力、开发和部署路径
- `.planning/codebase/ARCHITECTURE.md` — 系统结构与数据流
- `.planning/codebase/CONCERNS.md` — 当前高风险问题
- `.planning/codebase/STACK.md` — 当前栈与部署边界

### Secondary (MEDIUM confidence)
- `.planning/codebase/TESTING.md` — 测试实践与缺口
- `.planning/codebase/INTEGRATIONS.md` — 外部依赖与配置线索

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
