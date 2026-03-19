# Requirements: App Store Price Radar

**Defined:** 2026-03-18
**Core Value:** 用户订阅的 App 必须能被持续、准确、可解释地监控，并在真实降价时收到可信且不重复的提醒。

## v1 Requirements

### Data & Deployment

- [x] **DATA-01**: 维护者可以通过单一官方迁移链路初始化数据库，并创建当前运行代码所需的完整 schema
- [x] **DATA-02**: fresh install 环境可以完成订阅创建、价格巡检和价格历史查询的基础 smoke path，而不会因迁移漂移失败
- [x] **DATA-03**: 部署文档和环境变量说明与实际运行要求保持一致，新的生产环境不会因遗漏关键配置进入不安全或不可用状态

### Price Integrity

- [ ] **PRICE-01**: 系统只会在拿到有效 App Store 价格时更新快照，不会把缺失价格当成 `0`
- [ ] **PRICE-02**: 单个 `(appId, country)` 刷新过程中，快照、价格变化事件、降价事件和通知状态保持一致，不留下部分写入
- [x] **PRICE-03**: 同一时间最多只有一个巡检任务处理同一批价格检查，避免重复事件和重复通知
- [x] **PRICE-04**: 运维者可以看到一轮巡检的成功、跳过和失败统计，以及明确的失败原因
- [ ] **PRICE-05**: 订阅创建后的即时刷新与定时巡检共用一致的价格校验规则，并能区分是否允许发送提醒

### Auth & Task Security

- [x] **AUTH-01**: 用户的密码登录、验证码发送、验证码验证和密码重置流程具备失败次数或频率限制
- [x] **AUTH-02**: 用户同一时刻只保留符合策略的有效登录码或重置令牌，新发放会显式废弃旧凭证
- [x] **AUTH-03**: 生产环境中的手动巡检入口必须强制鉴权，缺失 `CRON_SECRET` 时不会对公网开放
- [ ] **AUTH-04**: 前端可以在会话失效或过期时稳定识别状态并引导用户重新登录，避免页面先出错后清理

### API & Frontend Stability

- [ ] **API-01**: 前后端对核心认证与订阅 DTO 共享统一契约，避免接口字段漂移
- [ ] **API-02**: 用户在工作台和详情页查看价格历史时，不会因为超长 payload 或频繁切换导致明显卡顿
- [x] **API-03**: 首页公开降价流在数据增长后仍能稳定返回去重后的结果与正确的关注人数
- [ ] **API-04**: 前端的鉴权请求、401 处理和错误反馈被收敛为共享逻辑，避免页面行为分叉
- [ ] **API-05**: 用户在 App 详情页可以查看足够支持购买或继续关注决策的 App 信息，核心信息首屏可见，扩展元数据采用折叠展示，避免无差别堆叠字段

### Quality Assurance

- [x] **QA-01**: Worker 的关键路由和服务具备回归测试，覆盖认证、订阅、公开 feed、手动巡检鉴权和错误边界
- [x] **QA-02**: 前端至少覆盖登录态恢复、工作台订阅流程和价格历史查看的自动化回归
- [x] **QA-03**: 团队可以通过统一验证命令完成类型检查、lint、测试和关键 smoke path 后再部署

## v2 Requirements

### Expansion

- **EXP-01**: 支持 Apple App Store 之外的更多应用商店
- **EXP-02**: 提供原生移动客户端
- **EXP-03**: 支持更高频率或近实时的价格检测与提醒
- **EXP-04**: 提供更丰富的个性化分析、推荐或市场洞察

## Out of Scope

| Feature | Reason |
|---------|--------|
| 原生移动端 | 当前核心问题在可靠性与可发布性，不在访问载体 |
| 多商店支持 | 会显著增加采集、归一化和 UI 复杂度，当前不利于聚焦 |
| 高频实时抓价 | 成本与限流复杂度过高，先把现有定时巡检做稳 |
| 社区化内容能力 | 偏离价格监听产品的核心价值 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| PRICE-01 | Phase 2 | Pending |
| PRICE-02 | Phase 2 | Pending |
| PRICE-05 | Phase 2 | Pending |
| PRICE-03 | Phase 3 | Complete |
| PRICE-04 | Phase 3 | Complete |
| AUTH-01 | Phase 3 | Complete |
| AUTH-02 | Phase 3 | Complete |
| AUTH-03 | Phase 3 | Complete |
| AUTH-04 | Phase 4 | Pending |
| API-01 | Phase 4 | Pending |
| API-02 | Phase 4 | Pending |
| API-04 | Phase 4 | Pending |
| API-05 | Phase 4 | Pending |
| API-03 | Phase 5 | Complete |
| QA-01 | Phase 5 | Complete |
| QA-02 | Phase 5 | Complete |
| QA-03 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after adding app detail metadata requirement to Phase 4*
