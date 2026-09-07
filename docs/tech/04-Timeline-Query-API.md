# 技术开发文档 04：Timeline Query API

## 1. 目标

把 Observation、Agent Event、Memory Revision 统一成可按时间查询的 Timeline 视图，为 UI 提供稳定 API。

本任务只做查询和聚合，不新增复杂事件处理逻辑。

## 2. Timeline Item

建议统一返回：

```ts
interface TimelineItem {
  id: string
  kind: 'observation' | 'agent_event' | 'memory_change'
  timestamp: string
  source?: string
  pluginId?: string
  title: string
  summary?: string
  relatedIds: string[]
  detailRef: string
}
```

其中 `detailRef` 用于前端请求详情，不在 Timeline 列表中塞入完整 payload。

## 3. Query

支持：

```text
from / to
kind
pluginId
sourceId
memoryId
limit
cursor
```

默认按 `timestamp DESC`。

## 4. API

建议：

```text
GET /api/timeline
GET /api/observations/:id
GET /api/memory/:id/revisions
```

若项目已有 API 前缀/Router 规范，必须遵循现有规范。

## 5. 关联规则

最小关联链：

```text
Observation
  relatedIds → Agent Event / Memory Revision

Memory Revision
  sourceEventIds → Observation / Agent Event
```

如果当前 Agent Event 尚未实际存在，允许 Timeline 暂时返回 Observation + Memory Change 两类。

## 6. 性能原则

Phase 1 不做复杂 OLAP。

要求：
- 列表接口分页。
- 不默认返回大 payload。
- 对时间范围进行过滤。

## 7. 文件边界

优先：

```text
src/api/timeline/**
src/runtime/timeline/**
tests/api/timeline/**
```

禁止：
- 修改 Plugin 生命周期。
- 增加新的数据库技术栈。
- 实现 Timeline 前端页面。

## 8. 验收

构造至少：
- 2 条 Observation。
- 1 条 Memory Change。

查询 Timeline 后按时间倒序返回，并可跳转到具体详情。

## 9. 变更预算

目标：**≤ 700 行代码变更**。
