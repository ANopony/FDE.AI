# FDE.AI Plugin 定义与开发说明

> 版本：v0.2  
> 适用阶段：Phase 1 及后续 Runtime 扩展

## 1. 文档目的

本文定义 FDE.AI 中 Plugin 的架构角色、能力模型、生命周期、接口、开发规范，以及如何开发一个可运行的感知类 Plugin。

核心结论：

> **Plugin 不是 Tool，也不是 Skill。Plugin 是 FDE.AI Runtime 的扩展单元。Tool、Skill、Service、Observation Source、Memory Handler 都可以由 Plugin 提供。**

这一设计受到 DeepSeek Harness 的 “everything is a plugin” 架构启发。DeepSeek Harness 当前官方架构文档明确描述：插件可以贡献 Service、类型化 Event 和可逆 Effect；模型适配器、Tool Registry、Session Log、Agent Loop 等系统部分也可以是 Plugin。citeturn888557search0turn888557search5

## 2. Plugin 的定义

### 2.1 正式定义

**Plugin 是一个可独立注册、加载、初始化、启用、停用、卸载的 Runtime Extension Unit。**

Plugin 的职责不是规定“Agent 能做什么”，而是向 Runtime 注册能力。

```text
Plugin
├── Services
├── Tools
├── Skills
├── Observation Sources
├── Memory Handlers
└── UI / Renderers
```

Plugin 可以只提供其中一种能力，也可以同时提供多种能力。

### 2.2 Plugin 与 Tool 的区别

```text
Tool
= Agent 可以主动调用的一次能力
```

例如：

```text
crm.search_customer()
crm.get_opportunity()
```

Plugin：

```text
CRM Plugin
├── CRM Service
├── CRM Tools
├── CRM Observation Sources
└── CRM Memory Handlers
```

因此：

```text
Plugin > Tool
```

Tool 是 Plugin 的一种可选暴露方式。

### 2.3 Plugin 与 Skill 的区别

Skill 更适合承载：

```text
规则
方法
知识
操作指导
领域 Instructions
```

例如：

```text
sales-opportunity-analysis
manufacturing-quotation-process
```

它不负责持续感知外部系统。

DeepSeek Harness 官方文档同样把 Skill 定义为可选 instructions，并通过 Skill Service / Provider / Consumer 组织，而不是把它当成 Session Event。citeturn888557search3turn888557search8

## 3. FDE.AI Capability Model

### 3.1 Service

Service 是 Plugin 向 Runtime 或其他 Plugin 暴露的稳定能力。

```text
ctx.<service>
```

例如：

```text
ctx.crm
ctx.observations
ctx.memory
ctx.tools
```

DeepSeek Harness 的官方设计也采用这种模式：Service 是 Plugin 暴露给其他 Plugin 的能力，消费者通过 dependency / inject 声明需要哪些 Service。citeturn888557search1turn888557search4

### 3.2 Tool

Tool 是面向 Agent 的可调用操作。

特点：

- 有名称
- 有输入 Schema
- 有执行函数
- 有结果
- 通常由模型主动调用

例如：

```text
crm.search_customer
crm.get_opportunity
```

### 3.3 Skill

Skill 是可按需加载的 instructions / domain knowledge。

特点：

- 面向 Agent
- 不等同于 Runtime Event
- 通常不是持续运行
- 可以独立于具体系统接入

### 3.4 Observation Source

这是 FDE.AI 特有的核心扩展点。

它负责：

```text
持续观察
 ↓
产生 Observation
```

例如：

```text
Browser Observer
CRM Observer
Email Observer
ERP Observer
File Observer
```

Observation Source 可以：

- 订阅 webhook
- polling
- 监听本地事件
- 监听浏览器行为
- 读取系统 audit log
- 使用其他 Service 获取变化

### 3.5 Memory Handler

负责把 Observation 或 Agent Event 转换成 Memory mutation。

建议不要让普通 Plugin 直接修改数据库，而是通过 Memory Service：

```text
ctx.memory.create(...)
ctx.memory.update(...)
ctx.memory.revise(...)
```

这样 Runtime 才能统一产生 Memory Revision。

## 4. 推荐的 Plugin 结构

```text
plugins/
└── crm/
    ├── plugin.ts
    ├── manifest.json
    ├── service.ts
    ├── observation/
    │   ├── customer.ts
    │   ├── opportunity.ts
    │   └── activity.ts
    ├── tools/
    │   ├── search-customer.ts
    │   └── get-opportunity.ts
    ├── skills/
    │   └── sales-context.md
    ├── memory/
    │   └── opportunity-handler.ts
    ├── ui/
    │   └── event-renderer.ts
    └── tests/
```

不是所有目录都必须存在。

## 5. Plugin Manifest

建议第一阶段建立 manifest。

```json
{
  "id": "crm",
  "name": "CRM Integration",
  "version": "0.1.0",
  "description": "Connects FDE.AI to a CRM system",
  "author": "FDE.AI",
  "runtime": {
    "minVersion": "0.1.0"
  },
  "capabilities": {
    "services": ["crm"],
    "tools": ["crm.search_customer", "crm.get_opportunity"],
    "skills": ["sales-context"],
    "observationSources": [
      "crm.customer",
      "crm.opportunity",
      "crm.activity"
    ],
    "memoryHandlers": ["crm.opportunity"]
  },
  "config": {
    "required": ["baseUrl", "credentialRef"]
  }
}
```

## 6. Plugin Runtime Contract

第一阶段推荐建立最小统一接口：

```ts
export interface Plugin {
  id: string
  name: string
  version: string
  description?: string

  setup(ctx: PluginContext): Promise<void> | void
  start?(ctx: PluginContext): Promise<void> | void
  stop?(ctx: PluginContext): Promise<void> | void
}
```

### PluginContext

```ts
export interface PluginContext {
  events: EventBus
  tools: ToolRegistry
  skills: SkillRegistry
  memory: MemoryService
  observations: ObservationService
  config: ConfigService
  logger: Logger
}
```

说明：这是 FDE.AI 建议的概念模型，并不要求 Phase 1 必须完全采用该 TypeScript 命名。

如果最终采用类似 Cordis 的运行时框架，也应保持相同的语义：Plugin 声明/注册能力，由 Runtime 管理生命周期与依赖，而不是让各插件自行互相硬编码引用。DeepSeek Harness 的官方实现中，Plugin 可以通过 dependency / `inject` 使用其他 Service，并由 Runtime 处理依赖就绪关系。citeturn888557search1turn888557search9

## 7. Observation API

### 7.1 Observation Source

建议：

```ts
export interface ObservationSource {
  id: string
  name: string
  start(ctx: ObservationContext): Promise<void> | void
  stop?(ctx: ObservationContext): Promise<void> | void
}
```

### 7.2 发布 Observation

```ts
await ctx.observations.emit({
  sourceId: 'crm.opportunity',
  type: 'opportunity.updated',
  timestamp: new Date(),
  payload: data,
  correlationId: traceId,
})
```

Observation Service 负责：

- 标准化事件
- 持久化
- 生成 event id
- 记录 source/plugin
- 生成 correlation id（如调用方未提供）
- 发布到 Event Bus

## 8. Tool API

一个 Plugin 可以注册 Tool：

```ts
ctx.tools.register({
  name: 'crm.search_customer',
  description: 'Search customers in CRM',
  inputSchema: SearchCustomerSchema,
  execute: async (input, ctx) => {
    return ctx.crm.searchCustomer(input)
  },
})
```

重要原则：

```text
Tool
  ↓
Plugin Service
  ↓
External System
```

不要让 Tool 绕过 Plugin Service 直接创建 CRM Client。

这样可以确保同一能力既能被 Observation Source 使用，也能被 Tool 使用。

## 9. Service API

例如 CRM Plugin 提供：

```ts
interface CRMService {
  searchCustomer(query: string): Promise<Customer[]>
  getOpportunity(id: string): Promise<Opportunity>
}
```

实现：

```ts
class CRMServiceImpl implements CRMService {
  ...
}
```

Runtime：

```text
Plugin
  ↓ register
ctx.crm
```

其他 Plugin：

```ts
const crm = ctx.crm
await crm.searchCustomer('Acme')
```

这种 Service/Consumer 解耦方式与 DeepSeek Harness 的设计一致：消费者依赖命名 Service，而不是直接 import provider，从而允许在配置层替换 provider。citeturn888557search9

## 10. Memory Handler

Memory Handler 不应该直接写 Memory 数据库。

推荐：

```ts
export interface MemoryHandler {
  id: string
  match(observation: Observation): boolean
  handle(
    observation: Observation,
    ctx: MemoryHandlerContext,
  ): Promise<MemoryMutation[]>
}
```

例如：

```text
Observation
opportunity.updated
        ↓
Opportunity Memory Handler
        ↓
MemoryMutation
        ↓
Memory Service
        ↓
Revision
```

## 11. Memory Mutation

推荐统一抽象：

```ts
interface MemoryMutation {
  operation: 'create' | 'update' | 'delete'
  memoryId?: string
  type: string
  before?: unknown
  after?: unknown
  reason: string
  sourceEventId: string
}
```

Memory Service 负责：

```text
Mutation
  ↓
Validation
  ↓
Persist
  ↓
Revision
  ↓
Event
```

## 12. Event Model

建议统一 Event Envelope：

```ts
interface RuntimeEvent<T = unknown> {
  id: string
  type: string
  timestamp: string
  source: {
    pluginId?: string
    capabilityId?: string
  }
  correlationId: string
  causationId?: string
  payload: T
  metadata?: Record<string, unknown>
}
```

### correlationId

用于把同一次业务链路串起来：

```text
trace_001
  ├── observation.created
  ├── agent.started
  ├── agent.completed
  ├── memory.updated
  └── memory.revision
```

### causationId

用于表达直接因果关系：

```text
Observation
   ↓ causationId
Agent Event
   ↓ causationId
Memory Revision
```

## 13. Plugin Lifecycle

```text
Discovered
   ↓
Loaded
   ↓
Validated
   ↓
Initialized
   ↓
Enabled
   ↓
Running
   ↓
Stopping
   ↓
Disabled
```

异常：

```text
任意阶段
   ↓
Error
```

每一次 lifecycle transition 都应该产生 Runtime Event。

## 14. Plugin Enable / Disable 语义

### Enable

启用一个 Plugin 应完成：

```text
1. Load manifest
2. Validate dependencies
3. Create services
4. Register tools / skills / observers
5. Start observation sources
6. Status = running
7. Emit plugin.enabled
```

### Disable

停用：

```text
1. Stop observation sources
2. Unregister runtime registrations
3. Release resources
4. Status = disabled
5. Emit plugin.disabled
```

之前已经写入的 Observation / Memory 不删除。

这与 DeepSeek Harness 关于插件挂载/卸载时 registration effects 可逆的架构理念一致。citeturn888557search0

## 15. Dependency Model

Plugin 不应该通过硬编码 import 依赖其他具体 Provider。

不推荐：

```ts
import { MysqlMemoryProvider } from '../mysql'
```

推荐：

```ts
const memory = ctx.memory
```

或者声明：

```ts
inject: ['memory', 'events']
```

这样以后可以替换：

```text
Memory Provider A
       ↕
    ctx.memory
       ↕
Memory Provider B
```

而消费者无需改变。

## 16. 感知插件开发模式

### Example: CRM Observer Plugin

```text
crm-plugin
│
├── CRM Service
│       ↓
│   API Client
│
├── Opportunity Observer
│       ↓
│   webhook / polling
│       ↓
│   Observation
│
├── CRM Tools
│       ↓
│   search / get
│
└── CRM Memory Handler
        ↓
    Opportunity Memory
```

完整运行：

```text
CRM
 ↓
CRM Plugin
 ↓
ObservationSource
 ↓
Observation
 ↓
Core Agent
 ↓
Memory Handler
 ↓
Memory Service
 ↓
Memory Revision
 ↓
Timeline
```

## 17. Plugin 开发规范

### 17.1 一个 Plugin 应有清晰边界

例如：

```text
crm-plugin
```

负责 CRM 能力。

不要同时负责：

```text
CRM + ERP + Email + Browser
```

除非它们在同一个外部平台且生命周期无法合理分离。

### 17.2 能力优先于实现

先定义：

```text
Service Contract
Observation Contract
Tool Contract
Memory Contract
```

再决定：

```text
HTTP
WebSocket
Polling
SDK
Browser automation
```

### 17.3 Observation 必须是事实

Observation 尽量描述“发生了什么”，不要在 Observation 层混入 Agent 的最终判断。

推荐：

```text
opportunity.stage_changed
```

而不是：

```text
sales_process_has_a_bottleneck
```

后者属于 Agent Interpretation / Pattern Detection。

### 17.4 Memory 必须有证据

每条 Memory 更新至少能追溯到：

```text
Memory Revision
 → Source Event
 → Plugin
 → Observation
```

### 17.5 Plugin 不应直接操纵 Core

不要：

```ts
coreAgent.updateMemory(...)
```

推荐：

```ts
ctx.memory.update(...)
```

或者发布标准 Runtime Event，由 Core / Memory Runtime 消费。

## 18. Security Model

第一阶段把 Plugin 视为 Trusted Runtime Code。

Plugin 可能具有：

- 网络访问
- 客户业务系统访问
- 文件访问
- 本地进程能力

因此 Plugin 安装、启用应被视为高权限操作。

后续生产版应增加：

- capability permission
- credential isolation
- secret reference
- network policy
- sandbox / worker isolation
- audit log

## 19. Plugin 类型建议

Plugin 本身不需要靠 Type 限制能力，但 UI 可根据主要用途标记：

```text
Core
Integration
Perception
Memory
Knowledge
Automation
UI
Developer
```

例如：

```text
CRM Plugin        Integration
Browser Plugin    Perception
Memory Plugin     Memory
Sales Skill Pack  Knowledge
RPA Plugin        Automation
```

注意：Type 是分类标签，不是 Runtime 能力边界。

## 20. Package / Distribution

Phase 1 建议只支持本地 / 内置 Plugin：

```text
Builtin Plugin
Local Plugin
```

暂不要求 Marketplace。

推荐未来支持：

```text
Plugin Package
 ├── manifest.json
 ├── runtime code
 ├── assets
 ├── skills
 └── metadata
```

## 21. 测试要求

每个 Plugin 至少包含：

### Unit Test

- manifest 校验
- service 方法
- observation parser
- memory handler

### Runtime Test

- enable
- disable
- dependency failure
- event emission
- cleanup

### Contract Test

验证：

```text
Observation → Runtime
Tool → Agent
Memory Mutation → Memory Service
```

## 22. Phase 1 最小 Plugin SDK

Phase 1 不需要实现完整复杂 SDK，但应至少提供：

```text
PluginContext
EventBus
Plugin Registry
Observation Service
Memory Service
Tool Registry
Skill Registry
Logger
Config Service
```

开发者应该能够用以下最小代码完成一个 Plugin：

```ts
export default function crmPlugin(ctx: PluginContext) {
  ctx.registerService('crm', new CRMService(...))

  ctx.observations.register({
    id: 'crm.opportunity',
    start(ctx) {
      // subscribe / poll / observe
    },
  })

  ctx.tools.register({
    name: 'crm.search_customer',
    ...
  })
}
```

具体 API 命名可以在工程实现阶段调整，但语义必须保持稳定。

## 23. 与 DeepSeek Harness 的关系

FDE.AI 借鉴 DeepSeek Harness 的关键不是复制其 API，而是借鉴其架构原则：

```text
Runtime
  ↓
Plugin Composition
  ↓
Capabilities via Services
  ↓
Typed Events
  ↓
Composable Extensions
```

DeepSeek Harness 官方文档明确提出“没有特权 Core，系统各部分都可以是 Plugin”，同时 Plugin 通过 Service、Event 和可逆 Effect 扩展共享 Context。citeturn888557search0turn888557search2

其官方 Service 文档进一步说明 Service 是一个 Plugin 向其他 Plugin 暴露的能力，Tool、LLM、Agent Runtime 都可以表现为 Service。citeturn888557search1turn888557search4

FDE.AI 不必机械复制“everything is a plugin”，但应保留以下核心思想：

1. Plugin 是扩展边界。
2. Service 是稳定的能力接口。
3. Tool 是面向 Agent 的调用接口。
4. Skill 是可按需加载的知识 / 指令。
5. Observation Source 是 FDE.AI 持续感知世界的一等能力。
6. Event 是跨 Plugin 的可追溯通信和审计基础。
7. Memory Revision 是长期认知的版本化证据链。

## 24. 最终架构

```text
                        FDE.AI Runtime
                              │
                  ┌───────────┴───────────┐
                  │        Plugin         │
                  └───────────┬───────────┘
                              │
        ┌─────────────┬───────┼─────────┬──────────────┐
        ↓             ↓       ↓         ↓              ↓
     Service         Tool    Skill   Observation    Memory
                                      Source         Handler
        │             │       │         │              │
        │             └───────┴────┐    │              │
        │                          ↓    ↓              ↓
        └────────────────────── Core Agent ────────────┘
                                      │
                                      ↓
                                   Memory
                                      │
                                      ↓
                              Memory Revision
                                      │
                                      ↓
                                  Timeline
```

该模型是 FDE.AI 后续连接 CRM、ERP、WMS、SRM、Browser、Email、Document、Data 等环境的基础架构。
