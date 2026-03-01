# 任务：修复会话列表页标题显示

## 问题
会话列表页（`/sessions?agent=main`）的标题显示的是 agent id（main），而不是 agent 名字（酪酪）。

## 位置
文件：`app/sessions/page.tsx`
行号：约368行

## 当前代码
```tsx
<h1 className="text-2xl font-bold">📋 {agentId} {t("sessions.title")}</h1>
```

## 期望修复
```tsx
<h1 className="text-2xl font-bold">📋 {agentName} {t("sessions.title")}</h1>
{agentName !== agentId && (
  <p className="text-xs text-[var(--text-muted)] mt-0.5">Agent ID: {agentId}</p>
)}
```

## 说明
- 主标题显示 `agentName`（酪酪）
- 如果 name 和 id 不同，在下方显示 id（main）
- 保持与 agent 卡片的显示逻辑一致（参考第165-170行）

## 验证
1. 访问 http://localhost:3001/sessions?agent=main
2. 标题应该显示 "📋 酪酪 会话历史"
3. 下方应该显示 "Agent ID: main"
