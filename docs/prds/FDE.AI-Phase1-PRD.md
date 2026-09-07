# FDE.AI 第一阶段 PRD

> 版本：v0.2  
> 阶段：Phase 1 / Runtime & Observability MVP  
> 状态：Draft for Engineering Review

## 1. 文档目的

本 PRD 定义 FDE.AI 第一阶段产品范围、核心用户流程、功能需求、数据与事件模型、交互要求、验收标准及明确不做事项。

第一阶段不追求完整实现“自动发现流程优化机会”，而是先建立一个可运行、可观察、可调试的 FDE Runtime：系统能够通过 Plugin 持续获得业务环境中的 Observation，形成/更新 Memory，并让用户能够追溯“哪个 Plugin 在什么时候感知到了什么，以及这次感知如何影响 Memory”。

## 2. 产品背景

FDE.AI 的定位是“像 FDE 一样进入客户业务现场，理解客户工作，并持续发现流程优化、自动化和 AI 化机会的通用 Agent”。其核心闭环为：

```text
客户日常工作
  ↓
无感感知
  ↓
理解并写入 Memory
  ↓
Daily Review / Daily Ask
  ↓
长期积累
  ↓
发现模式 / 问题
  ↓
生成优化机会
  ↓
客户 Review
  ↓
实施 / 自动化 / AI 化
  ↓
继续感知
```

第一阶段聚焦这个闭环最底层的可观测基础设施，即：

```text
Plugin
  ↓
Observation
  ↓
Agent Event
  ↓
Memory
  ↓
Memory Revision / Diff
  ↓
Timeline
```

产品原则沿用项目 README：插件化、默认无感、选择性提问、Memory 优先、长期发现。

## 3. Phase 1 目标

### 3.1 产品目标

Phase 1 完成后，内部研发人员、产品人员或客户管理员应当能够回答以下问题：

1. 当前 FDE.AI 安装了哪些 Plugin？哪些正在运行？
2. 每个 Plugin 能提供哪些能力？
3. 最近发生了哪些 Observation？来自哪个 Plugin？
4. Agent 对 Observation 做了什么处理？
5. 哪些 Memory 被创建、修改或删除？
6. 一条 Memory 当前内容是什么？它来自哪些证据？
7. 一条 Memory 为什么变成今天的样子？历史 Diff 是什么？
8. 如果一个 Plugin 停用，系统能否明确显示它已经停止产生新的 Observation？

### 3.2 工程目标

建立统一的 Runtime 扩展和事件基础模型，使后续 CRM、ERP、WMS、SRM、浏览器、邮件、文档等能力都可以采用相同方式接入。

### 3.3 Phase 1 成功标准

完成一条可重复演示的最小闭环：

```text
外部系统发生业务变化
  ↓
Observation Source 感知
  ↓
产生 Observation
  ↓
Core Agent 处理
  ↓
Memory 创建或更新
  ↓
产生 Memory Revision
  ↓
Timeline 可追溯完整链路
```

## 4. 非目标

Phase 1 不包含：

- 自动发现完整业务流程优化机会
- 自动实施 RPA / 自动化流程
- 自动修改客户业务系统中的数据
- 完整 Daily Review / Daily Ask 产品化
- 多租户企业权限体系的完整实现
- Plugin 市场、在线安装市场
- 完整的远程 Plugin 沙箱与安全策略
- Memory 自动合并、复杂知识图谱和高级推理
- 大规模生产环境的高可用与多区域部署

## 5. 用户角色

### 5.1 Admin / Developer

管理 Plugin、查看 Runtime 状态、排查 Observation 和 Memory 问题，是 Phase 1 的主要用户。

### 5.2 FDE / Product

查看 Agent 当前“感知到什么”和“记住什么”，验证 FDE.AI 是否形成正确的客户业务认知。

### 5.3 Customer User

Phase 1 暂不作为主要目标用户。客户主要通过被动授权和观察结果参与，不承担复杂配置工作。

## 6. 信息架构

```text
FDE.AI Console
│
├── Overview
│   ├── Runtime Status
│   ├── Plugin Summary
│   ├── Recent Activity
│   └── Memory Summary
│
├── Plugins
│   ├── Plugin List
│   └── Plugin Detail
│
├── Memory
│   ├── Memory List
│   └── Memory Detail
│       └── Revision History
│
└── Timeline
    ├── All Events
    ├── Observation
    ├── Agent Event
    └── Memory Change
```

## 7. 核心概念

### 7.1 Plugin

Plugin 是 FDE.AI Runtime 的可安装、可启停、可配置、可卸载扩展单元。Plugin 本身不是 Tool，也不是 Skill。

一个 Plugin 可以提供一个或多个能力：

- Service
- Tool
- Skill
- Observation Source
- Memory Handler
- UI / Renderer

### 7.2 Observation Source

Observation Source 是持续从外部工作环境获得事实/变化的组件，是 FDE.AI 特有的一等能力。

例如：

```text
CRM Plugin
└── Opportunity Observer
    ├── opportunity_created
    ├── opportunity_updated
    └── opportunity_stage_changed
```

### 7.3 Observation

Observation 是系统对外部环境一次可追溯感知的标准事件，包含来源、时间、类型、载荷及关联上下文。

### 7.4 Agent Event

Agent Event 描述 Core Agent 对 Observation 或其他输入执行的理解、决策、调用或处理动作。

### 7.5 Memory

Memory 是 FDE.AI 长期积累的结构化认知。Memory 必须具备来源和版本信息，不能被设计为无来源的黑盒文本。

### 7.6 Memory Revision

每一次对 Memory 的有效变更都产生一个 Revision，并保留 before / after / diff / reason / source event。

## 8. 功能需求

## 8.1 Overview

### 目标

提供系统当前状态的总览，不承担复杂分析功能。

### 展示

- Plugin 总数
- Enabled Plugin 数
- 最近 Observation 数
- 最近 Memory Change 数
- 当前运行状态
- 最近事件时间线

### 验收

页面能够在进入 Console 后 3 秒内展示最新 Runtime 状态；点击统计数字可以进入对应列表。

## 8.2 Plugin Management

### 8.2.1 Plugin List

每个 Plugin 至少展示：

| 字段 | 说明 |
|---|---|
| Name | Plugin 名称 |
| Description | 简短描述 |
| Type | Integration / Perception / Memory / Core / Other |
| Status | Enabled / Disabled / Error |
| Version | 当前版本 |
| Capabilities | Services / Tools / Skills / Observation Sources / Memory Handlers 数量 |
| Last Activity | 最近活动时间 |
| Error Count | 最近运行错误数量 |

### 8.2.2 Enable / Disable

管理员可以启用或停用 Plugin。

启用：

```text
Disabled
  ↓ enable
Loading
  ↓
Enabled
```

停用：

```text
Enabled
  ↓ disable
Stopping
  ↓
Disabled
```

要求：

- 停用后不得产生新的 Runtime Activity。
- 停用前已经产生的 Observation / Memory 不删除。
- Plugin 启停操作自身必须进入 Timeline。
- 启用失败必须有明确错误状态和错误原因。

### 8.2.3 Plugin Detail

建议页面结构：

```text
Plugin Detail
├── Overview
├── Capabilities
│   ├── Services
│   ├── Tools
│   ├── Skills
│   ├── Observation Sources
│   └── Memory Handlers
├── Configuration
├── Runtime
│   ├── Status
│   ├── Started At
│   ├── Last Activity
│   ├── Event Count
│   └── Error Count
└── Recent Events
```

### 8.2.4 Capability Detail

用户能够知道一个 Plugin “能做什么”，但不要求 Phase 1 支持复杂配置编辑。

## 8.3 Memory Viewer

### 8.3.1 Memory List

支持：

- 类型筛选
- 来源 Plugin 筛选
- 创建/更新时间筛选
- 关键词搜索
- 状态筛选

Memory 类型建议预留：

```text
customer
person
process
system
opportunity
task
preference
observation
other
```

### 8.3.2 Memory Detail

至少展示：

```text
Memory
├── Current Content
├── Type
├── Confidence
├── Created At
├── Updated At
├── Source
├── Evidence
└── Revision History
```

### 8.3.3 Revision History

用户可以查看某条 Memory 的版本历史：

```text
Revision #3
- stage: proposal
+ stage: negotiation

Reason
CRM opportunity updated

Source
Observation #obs_123
```

要求：Memory Detail 必须可以跳转到产生该 Revision 的 Observation / Agent Event。

## 8.4 Timeline / Logs

### 8.4.1 目标

Timeline 是 Phase 1 的核心 Debug / Audit 能力。

### 8.4.2 Event 类型

Phase 1 支持：

```text
plugin.enabled
plugin.disabled
plugin.error
observation.created
agent.started
agent.completed
memory.created
memory.updated
memory.deleted
memory.revision
```

### 8.4.3 Timeline UI

默认按时间倒序展示：

```text
10:32:18  Memory Revision
Opportunity / Acme

10:32:17  Agent Event
识别为商机阶段变更

10:32:16  Observation
CRM Observer
Opportunity #10293 updated
```

### 8.4.4 Event Detail

点击事件后展示：

- Event ID
- Event Type
- Timestamp
- Plugin / Source
- Parent Event
- Raw Payload（可折叠）
- Agent Interpretation（如有）
- Memory Impact（如有）
- Error（如有）
- Correlation ID / Trace ID

### 8.4.5 过滤

支持：

- 时间范围
- Plugin
- Event Type
- Memory
- Correlation ID
- Error only

### 8.4.6 事件关联

Timeline 必须支持沿链路跳转：

```text
Observation
   ↕
Agent Event
   ↕
Memory Revision
   ↕
Memory
```

这是 Phase 1 的关键验收项。

## 9. 最小数据模型

### Plugin

```json
{
  "id": "crm-observer",
  "name": "CRM Observer",
  "version": "0.1.0",
  "description": "Observe CRM changes",
  "status": "enabled",
  "capabilities": {
    "services": [],
    "tools": [],
    "skills": [],
    "observationSources": ["crm.opportunity"],
    "memoryHandlers": []
  }
}
```

### Observation

```json
{
  "id": "obs_123",
  "timestamp": "2026-09-07T10:32:16+08:00",
  "pluginId": "crm-observer",
  "sourceId": "crm.opportunity",
  "type": "opportunity.updated",
  "payload": {},
  "correlationId": "trace_001"
}
```

### Agent Event

```json
{
  "id": "agent_evt_123",
  "type": "agent.completed",
  "inputEventId": "obs_123",
  "action": "update_memory",
  "correlationId": "trace_001"
}
```

### Memory

```json
{
  "id": "mem_123",
  "type": "opportunity",
  "content": {},
  "confidence": 0.87,
  "createdAt": "...",
  "updatedAt": "...",
  "currentRevisionId": "rev_003"
}
```

### Memory Revision

```json
{
  "id": "rev_003",
  "memoryId": "mem_123",
  "version": 3,
  "before": {},
  "after": {},
  "diff": [],
  "reason": "CRM opportunity updated",
  "sourceEventId": "obs_123",
  "createdAt": "..."
}
```

## 10. API 建议

第一阶段建议采用 REST + Event Stream 的组合。

### Plugin

```text
GET    /api/plugins
GET    /api/plugins/:id
POST   /api/plugins/:id/enable
POST   /api/plugins/:id/disable
GET    /api/plugins/:id/events
```

### Memory

```text
GET    /api/memories
GET    /api/memories/:id
GET    /api/memories/:id/revisions
```

### Timeline

```text
GET    /api/events
GET    /api/events/:id
GET    /api/events/:id/related
```

后续如需实时 Console，可增加：

```text
GET /api/events/stream
```

采用 SSE 或 WebSocket 均可，Phase 1 不强制。

## 11. 运行时要求

### 11.1 Plugin 生命周期

```text
Discovered
   ↓
Loaded
   ↓
Initialized
   ↓
Enabled
   ↓
Running
   ↓
Stopping
   ↓
Disabled / Error
```

### 11.2 可观测性

每个 Runtime Event 必须具备：

- event id
- timestamp
- event type
- source
- correlation id
- payload / metadata

涉及 Agent 或 Memory 的事件必须能够关联回同一个 trace。

### 11.3 错误处理

Plugin 错误不得导致整个 Console 崩溃。错误必须被记录为可查询 Event，并在 Plugin 状态中反映。

## 12. 关键用户流程

### 流程 A：首次启用 CRM Plugin

```text
Plugins
 → CRM Plugin
 → Enable
 → Plugin initialized
 → Observation Source started
 → Timeline 出现 plugin.enabled
```

### 流程 B：查看一次业务感知如何改变 Memory

```text
Timeline
 → Observation
 → Event Detail
 → Memory Impact
 → Memory Detail
 → Revision History
 → 查看 Diff
```

### 流程 C：排查错误

```text
Plugins
 → CRM Plugin
 → Error Count
 → Recent Events
 → plugin.error
 → 查看 Error Detail
```

## 13. 权限与安全

Phase 1 至少区分：

- Viewer：查看 Plugin / Memory / Timeline
- Admin：Enable / Disable Plugin、修改配置

Raw Observation Payload 可能包含客户数据。默认仅允许拥有相应权限的用户查看原始 payload；UI 默认优先显示结构化摘要。

## 14. 性能与数据保留

Phase 1 可按单实例 MVP 设计。

建议：

- Console 列表查询 P95 < 1s
- Timeline 首屏 P95 < 2s
- Event 写入与持久化成功率 > 99.9%
- Memory Revision 不可覆盖历史版本

具体容量、归档和冷热存储策略在生产化阶段定义。

## 15. Phase 1 Demo 验收

使用一个简单 CRM Mock Plugin 完成演示：

```text
1. Admin 打开 Plugin 页面
2. Enable CRM Plugin
3. Mock CRM 创建 Opportunity
4. Timeline 出现 Observation
5. Agent 处理 Observation
6. Memory 创建 Opportunity
7. Timeline 出现 Memory Revision
8. 打开 Memory Detail
9. 查看 Evidence
10. 查看 Revision Diff
11. 返回 Observation
12. 停用 CRM Plugin
13. 确认后续不再产生 Observation
```

全部步骤可追溯，则 Phase 1 MVP 达标。

## 16. Definition of Done

### Product

- Plugin List / Detail 完成
- Enable / Disable 完成
- Memory List / Detail / Revision 完成
- Timeline / Event Detail 完成
- Observation → Agent Event → Memory Revision 可互相跳转

### Runtime

- Plugin 生命周期完整
- Plugin 能注册 Observation Source
- Observation 能标准化持久化
- Agent Event 能关联 Observation
- Memory Revision 能关联 Source Event

### Quality

- 核心流程有自动化测试
- Plugin 启停、Observation、Memory Revision、Timeline 查询有基本错误处理
- 所有核心 Event 带 correlationId

## 17. 后续阶段接口

Phase 1 的数据模型必须为后续能力留出接口：

```text
Phase 1
Plugin → Observation → Memory → Timeline

Phase 2
             ↓
        Daily Review
             ↓
        Daily Ask

Phase 3
             ↓
       Pattern Detection
             ↓
       Optimization Opportunity

Phase 4
             ↓
      Automation / AI Action
```

因此 Phase 1 不应把 Observation、Memory、Plugin 做成只能服务 UI 的临时对象，而应把它们作为 FDE Runtime 的稳定领域模型。

## 18. 参考资料

- FDE.AI README：项目愿景、核心闭环、Plugin 化原则。
- DeepSeek Harness Architecture：Everything is a Plugin、Plugin 提供 Service / Event / Effect 的架构思想。 https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md
- DeepSeek Harness Services：Service 是 Plugin 向其他 Plugin 暴露的命名能力。 https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/framework/service.md
- DeepSeek Harness Skills：Skill 是可选指令能力，而非 Session Event。 https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/skills.md
