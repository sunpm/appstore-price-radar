# Roadmap: App Store Price Radar

## Overview

这个路线图把已有的 brownfield 价格监听产品，从“功能基本可用”推进到“可以稳定迭代与发布”。执行顺序遵循一个明确原则：先修部署与数据基线，再修价格正确性和高风险入口，随后收敛契约与前端稳态，最后补上性能与测试护栏。

## Phases

**Phase Numbering:**
- 整数 phase（1, 2, 3...）表示当前计划内的正式阶段
- 小数 phase（如 2.1）预留给后续插队的紧急工作

- [x] **Phase 1: 数据基线与可部署性** - 统一迁移、部署文档与 fresh install 验证路径
- [x] **Phase 2: 价格数据正确性** - 修正采集与落库一致性，确保价格和提醒可信
- [x] **Phase 3: 调度与认证安全** - 为巡检和认证入口补互斥、限流和强制鉴权
- [x] **Phase 4: 契约与前端稳态** - 收敛 DTO、统一前端鉴权处理、丰富详情页决策信息并优化历史查看体验
- [ ] **Phase 5: Feed 性能与回归保障** - 优化公开降价流并建立持续验证基线

## Phase Details

### Phase 1: 数据基线与可部署性
**Goal**: 让新环境可以沿着单一路径完成数据库初始化、服务启动和核心 smoke path 验证。
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
1. 维护者可以按一套文档完成数据库初始化并成功启动 Web 与 Worker
2. 新环境可以完成订阅创建、手动巡检和价格历史查询的基础 smoke path
3. 关键环境变量和安全前提在文档中被清楚标出，生产环境不会因漏配进入不安全状态
**Plans**: 3 plans

Plans:
- [x] 01-01: 统一 Drizzle schema、SQL 基线与初始化路径
- [x] 01-02: 校正文档、环境变量说明和部署步骤
- [x] 01-03: 增加 fresh install / smoke verification 基线

### Phase 2: 价格数据正确性
**Goal**: 确保价格采集、快照更新、变化事件和提醒判断只基于可信数据执行。
**Depends on**: Phase 1
**Requirements**: PRICE-01, PRICE-02, PRICE-05
**Success Criteria** (what must be TRUE):
1. 缺失或异常 App Store 价格不会被写成 `0` 元或触发假降价
2. 单个 `(appId, country)` 刷新不会留下快照、事件和通知状态不一致的半完成数据
3. 订阅创建后的即时刷新与定时巡检共用同一套价格校验规则
**Plans**: 3 plans

Plans:
- [x] 02-01: 重构 App Store 价格解析与无效数据分支
- [x] 02-02: 为单应用刷新增加一致性边界与持久化测试
- [x] 02-03: 统一即时刷新与巡检共享规则

### Phase 3: 调度与认证安全
**Goal**: 限制高风险入口并让巡检任务具备互斥、统计和排障能力。
**Depends on**: Phase 2
**Requirements**: PRICE-03, PRICE-04, AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
1. 重复触发巡检时不会产生重复价格事件或重复邮件
2. 运维者可以看到一轮巡检的成功、跳过和失败统计，并定位失败原因
3. 登录、验证码和重置密码流程具备可验证的限流与凭证生命周期策略
4. 缺失 `CRON_SECRET` 时，手动巡检入口不会对公网可用
**Plans**: 4 plans

Plans:
- [x] 03-01: 为巡检增加互斥机制和任务级统计
- [x] 03-02: 为认证链路增加限流、失败次数和凭证淘汰策略
- [x] 03-03: 强化 `/api/jobs/check` 的生产鉴权与配置保护
- [x] 03-04: 补调度与认证高风险边界测试

### Phase 4: 契约与前端稳态
**Goal**: 统一前后端契约和前端鉴权请求行为，补齐详情页关键决策信息，降低页面抖动与字段漂移。
**Depends on**: Phase 3
**Requirements**: AUTH-04, API-01, API-02, API-04, API-05
**Success Criteria** (what must be TRUE):
1. 认证和订阅相关接口的返回结构有统一来源，页面不再依赖不存在字段
2. 会话失效或过期时，前端能稳定前置处理并引导重新登录
3. 工作台和详情页查看历史价格时，不会因为超长 payload 或频繁切换明显卡顿
4. 401 处理和错误反馈在认证页、工作台和安全页表现一致
5. 详情页首屏展示影响购买或继续关注决策的核心 App 信息，长尾元数据采用折叠展示而不是无差别堆叠
**Plans**: 4 plans

Plans:
- [x] 04-01: 收敛认证与订阅 DTO 契约
- [x] 04-02: 提取共享前端鉴权请求与错误处理逻辑
- [x] 04-03: 优化历史查询接口与前端加载策略
- [x] 04-04: 丰富详情页 App 元数据并做分层展示

### Phase 5: Feed 性能与回归保障
**Goal**: 让公开降价流、自动化测试和发布验证达到可持续迭代基线。
**Depends on**: Phase 4
**Requirements**: API-03, QA-01, QA-02, QA-03
**Success Criteria** (what must be TRUE):
1. 首页公开降价流在数据增长后仍能稳定返回去重结果和正确关注人数
2. Worker 关键路由与服务拥有覆盖核心风险的回归测试
3. 前端关键登录态与订阅路径具备基础自动化保护
4. 团队在部署前可以通过统一命令完成类型检查、lint、测试与 smoke path 验证
**Plans**: 3 plans

Plans:
- [x] 05-01: 优化公开降价流查询与聚合策略
- [x] 05-02: 补 Worker 关键路由/服务回归测试
- [ ] 05-03: 建立前端关键路径测试与统一验证命令

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 数据基线与可部署性 | 3/3 | Complete | 2026-03-18 |
| 2. 价格数据正确性 | 3/3 | Complete | 2026-03-18 |
| 3. 调度与认证安全 | 4/4 | Complete | 2026-03-18 |
| 4. 契约与前端稳态 | 4/4 | Complete | 2026-03-18 |
| 5. Feed 性能与回归保障 | 2/3 | In Progress | - |
