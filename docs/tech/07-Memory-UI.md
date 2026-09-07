# 技术开发文档 07：Memory Viewer UI

## 1. 目标

实现 Memory 列表、详情和 Revision History，使用户能回答“Agent 现在记住了什么，以及为什么”。

## 2. Memory List

展示：

```text
Type
Summary / Content
Confidence
Updated At
Revision
Source Count
```

提供基础筛选：

```text
Type
Updated Time
```

## 3. Memory Detail

结构：

```text
Current Memory
Source Evidence
Revision History
```

Current Memory 展示：

```text
ID
Type
Content
Confidence
Created At
Updated At
Revision
```

## 4. Revision Detail

点击某一 revision 展示：

```text
Timestamp
Reason
Source Event IDs
Before
After
Diff
```

Diff 优先可读性，而不是复杂技术格式。

例如：

```text
stage
- lead
+ opportunity
```

## 5. Source Evidence

至少允许点击 source event id 跳转 Timeline；如果本阶段 Timeline UI 尚未完成，可以提供可复制 ID 或预留链接。

## 6. 数据来源

只调用：

```text
Memory API
Timeline / Observation API
```

禁止前端自行推导 revision。

## 7. 文件边界

优先：

```text
src/pages/memory/**
src/components/memory/**
```

禁止：
- 修改 Memory 数据模型。
- 实现 Memory 自动合并。
- 接入向量数据库。

## 8. 验收

给定一条有两次 Revision 的 Memory：

```text
List → Detail → Revision 1 → Revision 2 → Diff
```

完整链路可查看。

## 9. 变更预算

目标：**≤ 800 行代码变更**。
