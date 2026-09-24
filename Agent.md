# FDE.AI Coding Agent 开发规范

## 1. 文档目的

本文件是 FDE.AI 项目的 Coding Agent 开发规范。

所有 Coding Agent 在执行开发任务前，必须阅读本文件以及当前任务对应的技术开发文档。

本规范用于保证：

- 技术栈统一
- 架构边界稳定
- Plugin 模型统一
- 每次开发修改范围可控
- 单次代码变更原则上不超过 1000 行
- 不因局部需求引入不必要的框架、基础设施或架构复杂度
- 每个任务可以独立验证、回滚和继续开发

本规范优先级高于 Coding Agent 的默认技术偏好。

---

## 2. 项目定位

FDE.AI 是一个通用型 FDE Agent。

系统通过持续感知客户实际工作环境，理解岗位、任务、流程、系统和问题，将理解结果写入 Memory，并通过长期积累发现流程优化、自动化和 AI 化机会。

Phase 1 的主要目标不是实现完整的 FDE 自动化，而是建立一个可运行、可观察、可调试的 Agent Runtime：

```text
External World
      ↓
Observation Source
      ↓
Observation
      ↓
Core Agent
      ↓
Memory
      ↓
Memory Revision / Diff
      ↓
Timeline / Console
```

Plugin 是 Runtime 的扩展单元。

Plugin 可以提供：

```text
Plugin
├── Service
├── Tool
├── Skill
├── Observation Source
├── Memory Handler
└── UI / Renderer（可选）
```

重要定义：

- Plugin：Runtime 扩展单元，不等于 Tool，也不等于 Skill。
- Service：Plugin 对 Runtime 或其他 Plugin 提供的运行时能力。
- Tool：Agent 可以主动调用的能力。
- Skill：Agent 可以按需加载的知识、规则、方法或指令。
- Observation Source：持续从外部世界产生 Observation 的能力。
- Memory：Agent 长期保留的结构化认知。
- Memory Revision：Memory 的一次可追踪变化。

---

# 3. 强制技术栈

## 3.1 基础语言

- TypeScript
- Node.js

要求：

- `strict: true`
- 不使用 JavaScript 作为核心业务代码
- 类型优先
- 禁止使用 `any` 规避类型问题，除非有明确注释说明原因

---

## 3.2 Monorepo

使用：

- pnpm
- Turborepo

推荐结构：

```text
fde-ai/
├── apps/
│   ├── console/
│   └── runtime/
│
├── packages/
│   ├── domain/
│   ├── plugin-sdk/
│   ├── database/
│   ├── event-bus/
│   ├── api-client/
│   └── config/
│
├── plugins/
│   └── examples/
│       └── demo-observer/
│
├── tests/
│
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

不得擅自改变 Monorepo 结构。

---

## 3.3 Backend

使用：

- Fastify
- Zod
- Pino

职责：

- Runtime API
- Plugin Lifecycle
- Event / Observation
- Memory
- Timeline Query
- Plugin Management

禁止：

- GraphQL
- 为局部需求引入额外 Backend Framework
- 在 Runtime 中直接混入 Frontend UI 逻辑

---

## 3.4 Frontend

使用：

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

Frontend 主要负责：

- Plugin Console
- Memory Viewer
- Timeline
- Runtime 状态展示

Frontend 不应直接访问数据库。

正确链路：

```text
Next.js
   ↓
REST API
   ↓
Runtime
   ↓
Domain / Database
```

---

## 3.5 Database

使用：

- PostgreSQL
- Drizzle ORM

Phase 1 不使用：

- MongoDB
- Neo4j
- Elasticsearch
- 独立 Vector Database

Memory 的可变结构内容优先使用 PostgreSQL `JSONB`。

核心数据实体：

```text
plugins
plugin_capabilities
observations
agent_events
memories
memory_revisions
```

不得因为单个功能需求随意增加数据库类型。

---

## 3.6 Event Bus

Phase 1 使用进程内 Event Bus。

必须保留抽象接口：

```ts
interface EventBus {
  publish(event: DomainEvent): Promise<void>;

  subscribe(
    eventType: string,
    handler: EventHandler,
  ): () => void;
}
```

初期实现：

```text
InMemoryEventBus
```

未来可以替换：

```text
Redis
NATS
Kafka
```

但 Phase 1 不引入以上基础设施。

业务代码必须依赖 EventBus 接口，而不是直接依赖具体实现。

---

## 3.7 API

使用：

- REST
- OpenAPI

命名保持资源导向。

示例：

```text
GET  /api/plugins
GET  /api/plugins/:id

POST /api/plugins/:id/enable
POST /api/plugins/:id/disable

GET  /api/memories
GET  /api/memories/:id
GET  /api/memories/:id/revisions

GET  /api/timeline
GET  /api/observations
GET  /api/events
```

禁止为了局部方便创建大量非标准 RPC 风格接口。

---

## 3.8 Validation

所有：

- HTTP Input
- Plugin Manifest
- Event Payload
- Observation
- Memory
- 配置

优先使用 Zod Schema 进行运行时验证。

推荐模式：

```ts
const ObservationSchema = z.object({
  id: z.string(),
  pluginId: z.string(),
  sourceId: z.string(),
  type: z.string(),
  timestamp: z.string(),
  payload: z.unknown(),
});

type Observation = z.infer<typeof ObservationSchema>;
```

原则：

```text
Schema = Runtime Contract
Type = Compile-time Contract
```

二者不要重复维护两套不一致定义。

---

## 3.9 Logging

使用：

- Pino

日志必须包含结构化字段。

推荐：

```ts
logger.info(
  {
    pluginId,
    eventId,
    observationId,
  },
  "Observation received",
);
```

不要主要依赖：

```ts
console.log(...)
```

生产 Runtime 禁止使用散乱的 `console.log` 作为主要日志机制。

---

## 4. Plugin 架构规范

## 4.1 Plugin 定义

Plugin 是可以：

- 注册
- 启动
- 停止
- 启用
- 禁用
- 配置
- 查询 Runtime 状态

的独立 Runtime 扩展单元。

Plugin 可以包含多个能力。

示例：

```text
CRM Plugin
├── CRM Service
├── CRM Observation Sources
├── CRM Tools
└── Customer Memory Handler
```

不要把：

```text
Tool = Plugin
```

作为架构假设。

---

## 4.2 Plugin Manifest

每个 Plugin 必须拥有 Manifest。

示例：

```ts
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;

  capabilities: PluginCapability[];

  dependencies?: PluginDependency[];
}
```

Plugin ID 必须稳定。

建议：

```text
crm
browser
filesystem
memory
demo-observer
```

禁止使用：

```text
plugin1
test2
new-plugin-final
```

作为正式 ID。

---

## 4.3 Plugin Lifecycle

至少支持：

```text
discovered
↓
registered
↓
enabled
↓
started
↓
running
↓
stopped
↓
disabled
```

Runtime 必须能够处理：

- Plugin 启动失败
- Plugin 停止
- Plugin 重复注册
- Plugin 不存在
- Plugin 依赖缺失

生命周期逻辑由 Plugin Manager 统一管理。

业务 Plugin 不应自己修改全局 Plugin Registry。

---

## 4.4 Observation Source

Observation Source 是 FDE.AI 的核心能力之一。

它负责：

```text
External System
      ↓
Observation Source
      ↓
Observation
```

Observation Source 可以：

- 定时轮询
- 订阅外部事件
- 监听本地环境
- 监听用户操作

Observation 必须包含：

```ts
{
  id,
  pluginId,
  sourceId,
  type,
  timestamp,
  payload,
}
```

Observation 是事实记录。

不要在 Observation 中直接混入未经明确区分的 Agent 推理结论。

---

## 4.5 Tool

Tool 是 Agent 主动调用的能力。

例如：

```text
crm.search_customer
crm.get_opportunity
crm.get_quote
```

Tool 不应该承担“持续感知”的职责。

关系：

```text
主动获取：

Agent
 ↓
Tool
 ↓
Plugin Service
 ↓
External System
```

持续感知：

```text
External System
 ↓
Observation Source
 ↓
Observation
 ↓
Agent
```

两条链不能混淆。

---

## 4.6 Skill

Skill 用于：

- 知识
- 方法
- Instructions
- 工作规则
- 专业领域上下文

Skill 不直接承担系统接入或持续感知职责。

例如：

```text
sales-opportunity-analysis
manufacturing-quotation-process
fde-process-analysis
```

Phase 1 可以定义接口，但不要求实现完整 Skill Runtime。

---

# 5. Domain Architecture

推荐依赖方向：

```text
apps
  ↓
application
  ↓
domain
  ↓
infrastructure
```

更具体：

```text
API
 ↓
Application Service
 ↓
Domain Model
 ↓
Repository Interface
 ↓
Database Implementation
```

Domain 不应该直接导入：

- Fastify
- Drizzle
- Next.js
- Pino

例如：

```text
packages/domain
```

应该保持框架无关。

---

## 5.1 Domain Event

推荐：

```ts
interface DomainEvent {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: unknown;
}
```

Event 必须：

- 有唯一 ID
- 有类型
- 有时间戳
- 有来源
- 可以追踪

---

## 5.2 Observation 与 Agent Event

需要严格区分：

```text
Observation
=
外部世界发生了什么
```

```text
AgentEvent
=
Agent 对 Observation 做了什么
```

例如：

```text
Observation:
CRM opportunity changed

AgentEvent:
interpret observation

AgentEvent:
update memory
```

不要用一个万能 `Event` 表混淆所有语义而不保留事件类型。

---

# 6. Memory Architecture

## 6.1 Memory

Memory 是 Agent 的长期认知结果。

Memory 至少应该能够回答：

- 内容是什么
- 类型是什么
- 从哪里得到
- 什么时候创建
- 什么时候更新
- 当前置信度
- 对应哪些证据

建议：

```ts
interface Memory {
  id: string;
  type: string;
  content: unknown;

  source?: string;
  confidence?: number;

  createdAt: string;
  updatedAt: string;
}
```

---

## 6.2 Memory Revision

任何重要 Memory 修改必须保留 Revision。

```text
Memory
  ↓
Revision 1
  ↓
Revision 2
  ↓
Revision 3
```

Revision 至少包含：

```text
memoryId
revisionId
timestamp
before
after
diff
sourceEventId
```

核心目标：

> 能回答“这个 Memory 为什么变成现在这样？”

---

# 7. Timeline / Trace

Timeline 是 Phase 1 的主要可观察性能力。

推荐形成：

```text
Observation
    ↓
AgentEvent
    ↓
Memory Revision
```

Timeline 中的每一个记录都必须尽可能能够回到来源。

例如：

```text
10:32:14
Observation
CRM Observer
Sales created opportunity

10:32:15
Agent Event
Interpretation

10:32:16
Memory Revision
Opportunity memory created
```

要求：

- 时间可排序
- 来源可查询
- Event ID 可追踪
- Plugin ID 可追踪
- Memory Revision 可追踪

---

# 8. 开发边界

## 8.1 单次修改预算

每一个 Coding Agent 任务：

```text
目标：<= 700 行变更
硬上限：<= 1000 行变更
```

“变更”包括：

- 新增代码
- 修改代码
- 删除代码
- 测试代码

不包括：

- 自动生成的 lockfile 大规模变化，前提是依赖已经在任务中明确批准
- 构建产物

如果预计超过 1000 行：

必须停止继续扩张当前任务，并拆成新的任务。

---

## 8.2 单任务单目标

一次 Coding Agent 执行只解决一个明确问题。

正确：

```text
实现 Plugin Registry
```

不正确：

```text
实现 Plugin Registry
+ Event Bus
+ Memory
+ UI
+ API
+ E2E
```

---

## 8.3 禁止顺手重构

Coding Agent 不得因为看到代码“不够优雅”而：

- 重写目录
- 更换框架
- 更换 ORM
- 更换状态管理
- 重命名整个模块
- 修改无关 API
- 大规模格式化整个仓库

除非任务文档明确要求。

---

## 8.4 禁止引入未经批准的依赖

新增 npm package 必须有明确理由。

优先：

```text
已有依赖
>
Node.js 原生能力
>
小型内部实现
>
新增第三方包
```

不要因为一个很小的功能引入大型依赖。

---

# 9. 文件修改规则

Coding Agent 收到任务后，必须先检查：

```text
1. 当前 Git 状态
2. package.json
3. workspace 结构
4. 当前任务文档
5. 相关现有实现
```

开发之前必须识别：

```text
Allowed Files
```

和：

```text
Do Not Modify
```

原则上：

> 没有被当前任务授权的目录，不修改。

如果需要跨越任务边界才能完成当前任务，应停止并将依赖说明写入结果，而不是擅自扩大范围。

---

# 10. 测试规范

使用：

- Vitest：Unit / Integration
- Playwright：E2E

每个功能必须优先提供最小自动化测试。

至少测试：

```text
Happy Path
Invalid Input
Error Path
```

Plugin 相关至少测试：

```text
注册
启动
停止
启用
禁用
重复注册
启动失败
```

Memory 相关至少测试：

```text
创建
更新
Revision
Diff
```

Timeline 至少测试：

```text
时间排序
过滤
来源关联
Memory Revision 关联
```

---

# 11. Definition of Done

一个 Coding Agent 任务只有在以下条件全部满足时才算完成：

```text
[ ] 需求已实现
[ ] 未修改无关模块
[ ] TypeScript 类型检查通过
[ ] Lint 通过
[ ] 单元测试通过
[ ] 相关集成测试通过
[ ] 没有明显的 console.log 残留
[ ] 没有未经批准的新依赖
[ ] 没有超过 1000 行变更
[ ] API / Domain Contract 与任务文档一致
[ ] README / 技术文档在任务要求时已更新
```

---

# 12. 每次任务结束时的报告格式

Coding Agent 完成任务后必须输出：

```text
## Task Completed

### Implemented
- ...

### Files Changed
- ...

### Tests
- ...

### Validation
- TypeScript: PASS
- Lint: PASS
- Unit Tests: PASS

### Change Size
- Added: XXX
- Modified: XXX
- Deleted: XXX
- Total Changed: XXX

### Git Commit Message
...

### Dependencies Added
- None

### Known Limitations
- ...

### Next Task Dependency
- ...
```

不得只回复：

```text
Done.
```

---

# 13. Phase 1 禁止事项

Phase 1 默认禁止：

- 微服务拆分
- Kubernetes
- Kafka
- Redis
- NATS
- GraphQL
- MongoDB
- Neo4j
- Elasticsearch
- 独立 Vector DB
- 独立 Plugin Server
- 复杂分布式任务系统
- 大规模权限系统
- 多租户企业级架构
- 完整 Agent 自动化执行系统

这些能力未来可能需要，但不属于当前 Phase 1 的最小闭环。

---

# 14. Phase 1 推荐开发顺序

```text
01 Runtime Core / Plugin
        ↓
02 Event / Observation
        ↓
03 Memory Core / Revision / Diff
        ↓
04 Timeline Query API
        ↓
05 Plugin Management API
        ↓
06 Console Shell / Plugin UI
        ↓
07 Memory UI
        ↓
08 Timeline UI
        ↓
09 E2E Demo / Hardening
```

Coding Agent 不得跳过依赖任务直接实现后续能力，除非任务文档明确允许使用临时 Mock。

---

# 15. 最重要的架构原则

## 15.1 Plugin ≠ Tool

```text
Plugin
 ├── Service
 ├── Tool
 ├── Skill
 ├── Observation Source
 └── Memory Handler
```

---

## 15.2 Observation 是一等对象

FDE.AI 不只是“等待用户调用 Tool”。

系统必须支持：

```text
External World
 ↓
Observation
 ↓
Understanding
 ↓
Memory
```

---

## 15.3 Memory 必须可追溯

任何重要 Memory 都应该能够回溯：

```text
Memory
 ↓
Revision
 ↓
Agent Event
 ↓
Observation
 ↓
Plugin
 ↓
External World
```

---

## 15.4 先模块化单体，再考虑分布式

Phase 1：

```text
Modular Monolith
```

未来：

```text
Distributed Runtime
```

中间通过接口和边界保证可演进，而不是提前引入基础设施复杂度。

---

## 15.5 可观察性优先

Phase 1 的一个核心目标是：

> 系统不仅能够运行，而且开发者能够看见它为什么这样运行。

因此：

```text
Plugin
Observation
AgentEvent
Memory
MemoryRevision
Timeline
```

都必须设计为可查询、可关联、可解释。

---

# 16. Coding Agent 执行原则

执行任何任务时，遵循：

```text
Read
 ↓
Understand
 ↓
Inspect Existing Code
 ↓
Plan Smallest Change
 ↓
Implement
 ↓
Test
 ↓
Validate
 ↓
Report
```

而不是：

```text
Read Task
 ↓
Rewrite Project
 ↓
Add Many Dependencies
 ↓
Implement Everything
```

核心要求：

> **小步、可验证、可回滚、严格遵守边界。**

如果任务文档与现有代码冲突：

1. 不擅自重构。
2. 优先保持现有可运行状态。
3. 在结果中明确冲突。
4. 只修改当前任务能够合理覆盖的范围。

最终目标不是一次生成大量代码，而是通过多次小规模、可验证的修改，逐步构建稳定的 FDE.AI Runtime。
