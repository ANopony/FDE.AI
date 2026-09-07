# 技术开发文档 08：Timeline UI

## 1. 目标

实现按时间线查看所有感知记录、Agent Event（若已有）以及 Memory Change。

## 2. 时间线主视图

示例：

```text
10:32:14  Observation
CRM Observer
Sales 创建 Opportunity

10:32:15  Agent Event
Core Agent
识别为 opportunity_created

10:32:16  Memory Change
Opportunity Memory
stage: lead → opportunity
```

## 3. 筛选

第一阶段支持：

```text
Time Range
Plugin
Event Kind
Source
```

不做复杂全文检索。

## 4. 详情展开

Observation：

```text
Plugin
Source
Type
Timestamp
Payload / Summary
Correlation ID
```

Agent Event：

```text
Action
Source Event
Summary
```

Memory Change：

```text
Memory ID
Revision
Before
After
Diff
Source Event IDs
Reason
```

## 5. 数据来源

只使用 Timeline API 与详情 API，不在前端自行聚合多个数据库接口。

## 6. 交互原则

- 默认最新事件在顶部。
- 展开详情不丢失当前筛选条件。
- 从 Memory Change 可以跳到 Memory Detail。
- 从 Observation 可以跳到来源 Plugin Detail。

## 7. 文件边界

优先：

```text
src/pages/timeline/**
src/components/timeline/**
```

禁止：
- 修改 Timeline API 数据模型。
- 增加新的日志基础设施。
- 实现高级图谱可视化。

## 8. 验收

至少构造：

```text
Observation → Memory Change
```

两类事件能按时间顺序显示，并可展开详情。

## 9. 变更预算

目标：**≤ 900 行代码变更**。
