# TASK: ClawTown会话消息显示优化

## 问题1：用户和助手名称太生硬
**当前：** "👤 用户" / "🤖 助手"
**期望：** "👤 禹哥" / "🤖 酪酪"

**方案：**
1. 从 `/api/config` 获取agent名称（已有：`agents[0].name = "酪酪"`）
2. 从 `~/.openclaw/workspace/USER.md` 读取用户名称（第一行 `**Name:** 赵禹`）
3. 在 `SessionDetailPanel` 组件中传入 `agentName` 和 `userName`
4. 显示时用真实名称替代"用户"/"助手"

## 问题2：子代理announce消息仍显示为"用户"
**当前逻辑：** 只判断 `sessionType === "subagent"` 和消息文本特征
**问题：** 子代理的announce消息（role=user）没有被正确识别

**示例：**
```
role=user text=[Sun 2026-03-01 05:33 UTC] ## 任务：用Claude Code完善子代理消息区分
```

**方案：**
在 `getSubagentUserLabel` 中增加判断：
- 如果消息文本以 `[` 开头且包含 `UTC]`，判定为系统消息，显示"⚙️ 系统"
- 或者判断是否包含 `## 任务：` 等特征

## 问题3：cron任务重复卡片且展开冲突
**根因：** 同一个cron任务有两个key：
- `agent:main:cron:xxx` （任务定义）
- `agent:main:cron:xxx:run:yyy` （执行记录）

两者的 `sessionId` 相同，导致：
1. 显示两个卡片
2. 点击任一卡片，两个都展开（因为用sessionId判断）

**方案：**
1. 在会话列表中过滤掉 `:run:` 的key，只显示任务定义
2. 或者改用 `key` 而不是 `sessionId` 作为展开状态的标识

## 验收标准
1. 消息显示为"👤 禹哥" / "🤖 酪酪" / "🤖 子代理"
2. 子代理announce消息不再显示为"用户"
3. cron任务只显示一个卡片，点击不冲突
4. `npm run build` 零错误
5. commit 并 push
