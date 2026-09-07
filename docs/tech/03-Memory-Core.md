# 技术开发文档 03：Memory Core 与 Revision / Diff

## 1. 目标

建立 Phase 1 的最小 Memory Service，使 Memory 成为可追溯、可版本化的长期认知对象。

## 2. Memory 模型

```ts
interface Memory {
  id: string
  type: string
  content: unknown
  sourceEventIds: string[]
  confidence?: number
  createdAt: string
  updatedAt: string
  revision: number
}
```

Memory 不允许只有无来源的黑盒文本；至少保留一个或多个来源 Event ID。

## 3. Revision

```ts
interface MemoryRevision {
  id: string
  memoryId: string
  revision: number
  timestamp: string
  sourceEventIds: string[]
  before: unknown | null
  after: unknown | null
  diff: unknown
  reason?: string
}
```

创建 Memory 也产生第一条 Revision：

```text
before = null
after = initial content
```

删除 Memory：

```text
before = old content
after = null
```

## 4. MemoryService

最小 API：

```text
create(input)
get(id)
list(query)
update(id, input)
delete(id, reason)
revisions(id)
```

所有 update/delete 必须自动产生 Revision，不允许业务代码绕过 Service 直接修改 Memory 主表。

## 5. Diff

第一阶段不要求复杂 JSON Patch；可采用稳定、可读的结构：

```json
{
  "changed": [
    {
      "path": "stage",
      "before": "lead",
      "after": "opportunity"
    }
  ],
  "added": [],
  "removed": []
}
```

对于纯字符串/非结构化内容，可保存 before/after，并提供简单文本 diff。

## 6. 与 Observation 的关系

建议 Memory mutation 接受：

```ts
sourceEventIds: string[]
```

典型链路：

```text
Observation #123
  ↓
Agent Event #456
  ↓
MemoryService.update()
  ↓
MemoryRevision #789
```

Agent Event 在本任务不实现完整模型，只保留 source event id 兼容位。

## 7. 文件边界

优先：

```text
src/runtime/memory/**
src/storage/memory/**
tests/runtime/memory/**
```

禁止：
- 建立知识图谱。
- 自动 Memory merge。
- 向量数据库。
- 复杂检索。
- 实现 Memory UI。

## 8. 验收

1. create 后能查询 Memory。
2. update 后 revision +1。
3. revisions() 能看到 before/after/diff。
4. delete 有 Revision。
5. 每条 Revision 能追溯 sourceEventIds。
6. 至少覆盖 create/update/delete 的单元测试。

## 9. 变更预算

目标：**≤ 900 行代码变更**。
