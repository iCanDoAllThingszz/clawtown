# TASK: 完善子代理消息区分逻辑

## 问题
当前代码只区分了assistant消息（子代理的回复显示为"🤖 子代理"），但用户输入的消息（role=user）仍然都显示为"👤 用户"。

实际上在子代理会话中：
- role=user 的消息可能是：
  1. 真实用户输入（应显示"👤 用户"）
  2. 子代理任务描述（应显示"📋 任务"或"⚙️ 系统"）
  3. 子代理返回的announce消息（应显示"🤖 子代理"）

## 当前实现
```typescript
{msg.role === "user" ? "👤 用户" : msg.role === "assistant" ? (sessionType === "subagent" ? "🤖 子代理" : "🤖 助手") : "⚙️ 系统"}
```

## 修复方案
在子代理会话中，需要进一步判断user消息的来源：
1. 如果消息文本包含"Stats: runtime"、"Findings:"等子代理特征，显示为"🤖 子代理"
2. 如果是任务描述（通常是第一条user消息），显示为"📋 任务"
3. 其他user消息显示为"👤 用户"

建议实现：
```typescript
const getUserLabel = (msg: SessionMessage, sessionType: string, isFirstUserMsg: boolean) => {
  if (sessionType === "subagent") {
    if (isFirstUserMsg) return "📋 任务";
    if (msg.text.includes("Stats: runtime") || msg.text.includes("Findings:")) return "🤖 子代理";
  }
  return "👤 用户";
};
```

## 验收标准
1. 子代理会话中，第一条user消息显示为"📋 任务"
2. 子代理的announce消息显示为"🤖 子代理"
3. 真实用户消息显示为"👤 用户"
4. `npm run build` 零错误
5. commit 并 push
