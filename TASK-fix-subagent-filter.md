# TASK: 修复子代理卡片消失 + 用户名兜底逻辑

## 问题1：子代理卡片全部消失
**根因：** 过滤`:run:`的逻辑太粗暴
```typescript
const filtered = (data.sessions || []).filter((s: Session) => !s.key.includes(":run:"));
```

这会把所有包含`:run:`的key都过滤掉，但子代理key可能也包含这个字符串（比如sessionId中有`run`）。

**正确方案：** 只过滤cron类型的`:run:`
```typescript
const filtered = (data.sessions || []).filter((s: Session) => 
  !(s.type === "cron" && s.key.includes(":run:"))
);
```

## 问题2：用户名/agent名应该从配置读取，兜底为"用户"/"助手"
**当前实现：** 硬编码从 `USER.md` 读取"赵禹"，从 `IDENTITY.md` 读取"酪酪"

**问题：** 不同部署环境的用户名和agent名不同，不应该硬编码。

**正确方案：**
1. 从 `/api/config` 读取 `agents[0].name`（agent名称）
2. 从 `/api/config` 读取用户名（如果API返回的话）
3. 如果读取失败，兜底为"用户"/"助手"

**API修改：**
在 `app/api/config/route.ts` 中，除了返回agent名称，还应该返回用户名：
- 从 `USER.md` 第一行 `**Name:**` 读取
- 如果读取失败，返回 `null`

**前端使用：**
```typescript
const userName = config?.userName || "用户";
const agentName = config?.agents?.[0]?.name || "助手";
```

## 验收标准
1. 子代理卡片正常显示
2. cron任务不重复
3. 用户名/agent名从config API读取，读取失败时兜底为"用户"/"助手"
4. `npm run build` 零错误
5. commit 并 push
