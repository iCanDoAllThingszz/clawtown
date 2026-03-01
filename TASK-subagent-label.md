# TASK: 会话详情面板区分子代理消息

## 问题描述
会话详情面板中，子代理返回的消息被标记为"👤 用户"，应该标记为"🤖 子代理"或"🤖 助手"。

## 文件位置
`app/sessions/page.tsx` 中的 `SessionDetailPanel` 组件

## 当前逻辑
```typescript
{msg.role === "user" ? "👤 用户" : msg.role === "assistant" ? "🤖 助手" : "⚙️ 系统"}
```

所有 role="user" 的消息都显示为"👤 用户"，但实际上子代理的消息也是role="user"。

## 修复方案
需要从消息内容或上下文判断是否为子代理消息。可能的判断依据：
1. 消息文本包含"子代理"、"subagent"等关键词
2. 消息来自特定的session key（包含":subagent:"）
3. API返回的消息结构中有额外标识

建议：
1. 先检查API `/api/sessions/[agentId]/[sessionId]` 返回的消息结构，看是否有字段能区分
2. 如果没有，可以从session key判断（当前session是subagent类型时，所有assistant消息都是子代理）
3. 或者从消息文本特征判断（包含"Stats: runtime"、"sessionKey agent:main:subagent"等）

## 验收标准
1. 子代理的消息显示为"🤖 子代理"而不是"👤 用户"
2. 普通用户消息仍显示为"👤 用户"
3. `npm run build` 零错误
4. commit 并 push
