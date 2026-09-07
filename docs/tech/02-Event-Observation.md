# 技术开发文档 02：Event Bus 与 Observation Runtime

## 1. 目标

建立统一事件基础设施，支持 Plugin 持续产生 Observation，并让后续 Agent Event / Memory Revision 可以关联到同一条事件链。

## 2. 核心模型

### Observation

```ts
interface Observation {
  id: string
  pluginId: string
  sourceId: string
  type: string
  timestamp: string
  payload: unknown
  correlationId?: string
  metadata?: Record<string, unknown>
}
```

必须保证每条 Observation 有唯一 `id`、明确 `pluginId/sourceId/type/timestamp`。

### Runtime Event

建议统一：

```ts
interface RuntimeEvent<T = unknown> {
  id: string
  type: string
  timestamp: string
  source?: string
  correlationId?: string
  payload: T
}
```

Observation 是 Runtime Event 的领域对象，不要求所有 Runtime Event 都是 Observation。

## 3. EventBus

最小接口：

```text
publish(event)
subscribe(type, handler)
unsubscribe(...)
```

要求：
- 同步或异步实现均可，但接口必须允许 async handler。
- handler 异常不能阻止其他 subscriber。
- 返回 publish 的 event id 或等价结果。

## 4. ObservationService

```text
emit(observationInput)
get(id)
list(query)
```

`emit` 负责：

1. 生成 Observation ID。
2. 补齐时间。
3. 持久化。
4. 发布事件。
5. 返回标准化 Observation。

推荐链路：

```text
Plugin Observer
  ↓
ObservationService.emit()
  ↓
Event Store
  ↓
EventBus.publish()
```

## 5. 持久化

优先使用现有数据库/ORM。如果尚无数据库，允许使用轻量 SQLite 或项目已经采用的本地存储方案。

不要在本任务引入生产级消息队列。

至少能按照以下条件查询：

- pluginId
- sourceId
- type
- time range
- limit / cursor

## 6. 开发测试 Plugin

增加一个 Test Observation Plugin：

```text
sourceId = test.source
 type = test.observation
```

允许测试代码主动 emit，用于后续 Memory/E2E 测试。

## 7. 文件边界

优先：

```text
src/runtime/events/**
src/runtime/observation/**
src/storage/**（仅必要改动）
tests/runtime/events/**
tests/runtime/observation/**
plugins/examples/test-observer/**
```

禁止：
- 实现 Memory。
- 实现 Timeline UI。
- 接入真实 CRM。
- 改动 Agent 推理循环。

## 8. 验收

给定 Test Plugin emit 一条 Observation：

```text
emit
 ↓
数据库可查到
 ↓
EventBus subscriber 收到
 ↓
ID / timestamp / pluginId / sourceId 一致
```

异常 subscriber 不得阻断事件发布。

## 9. 变更预算

目标：**≤ 800 行代码变更**。
