# ClawTown 像素小人行为逻辑重构

## 需求概述
重新设计主agent和子代理的房间移动逻辑，让小人行为更符合实际工作流程。

---

## 核心逻辑

### 主Agent（酪酪）

**专属房间：** 聊天室（Chat Room）

**状态判断：**
- **工作中（working）：** 正在执行任务（非HEARTBEAT_OK的回复）
  - 行为：在聊天室自由移动
  - 收发消息时：回到聊天室电脑前
- **休息中（idle）：** 无任务、HEARTBEAT_OK、长时间无活动
  - 行为：去休息室沙发
- **分派任务（delegating）：** 创建子代理时（sessions_spawn）
  - 行为：走到工作室，和子代理"交头接耳"（停留3-5秒）
  - 完成后：回到聊天室

**判断规则：**
```typescript
// 检查最近的消息
if (最近回复是 "HEARTBEAT_OK") {
  status = 'idle'  // 休息室
} else if (最近有 sessions_spawn 调用) {
  status = 'delegating'  // 去工作室分派任务
} else if (最近有消息/工具调用) {
  status = 'working'  // 聊天室
} else if (超过10分钟无活动) {
  status = 'idle'  // 休息室
}
```

---

### 子代理

**生命周期：**
1. **出生：** 休息室沙发
2. **工作：** 走到工作室电脑前（最多4个位置）
3. **完成：** 回到休息室沙发消失

**状态：** 始终是 working

**位置管理：**
- 工作室有4台电脑
- 超过4个子代理时，只显示前4个
- 子代理完成后从列表中移除

---

## API修改

### `/api/agent-activity` 返回格式

```json
{
  "agents": [
    {
      "id": "main",
      "name": "酪酪",
      "status": "working",  // working | idle | delegating
      "activity": "思考人生中...",
      "lastUpdate": 1772373673361,
      "emoji": "🤖"
    }
  ],
  "subagents": [
    {
      "id": "subagent:xxx",
      "label": "clawtown-pixel-office",
      "status": "working",
      "activity": "执行任务",
      "lastUpdate": 1772373673361
    }
  ]
}
```

**关键变化：**
- 主agent和子代理分开返回
- 主agent增加 `delegating` 状态
- 子代理始终是 `working` 状态

---

## 状态判断逻辑

### 主Agent状态判断

```typescript
async function parseMainAgentActivity(sessionFile: string): Promise<AgentStatus> {
  // 读取最近的消息
  const recentMessages = readLastNMessages(sessionFile, 20)
  
  // 1. 检查是否是HEARTBEAT_OK
  const lastAssistantMessage = findLastAssistantMessage(recentMessages)
  if (lastAssistantMessage?.content === 'HEARTBEAT_OK') {
    return { status: 'idle', activity: '摸鱼中 🐟' }
  }
  
  // 2. 检查是否正在创建子代理
  const recentSpawn = findRecentToolUse(recentMessages, 'sessions_spawn', 30000) // 30秒内
  if (recentSpawn) {
    return { status: 'delegating', activity: '分派任务中...' }
  }
  
  // 3. 检查是否有最近的活动
  const timeSinceLastActivity = Date.now() - lastMessageTime
  if (timeSinceLastActivity > 10 * 60 * 1000) {
    return { status: 'idle', activity: '下班了？' }
  }
  
  // 4. 默认：工作中
  return { status: 'working', activity: '思考人生中...' }
}
```

### 子代理检测

```typescript
async function findActiveSubagents(): Promise<Subagent[]> {
  // 从 /root/.openclaw/agents/main/sessions/ 读取所有 subagent 会话
  const sessionFiles = listSessionFiles()
  const subagents: Subagent[] = []
  
  for (const file of sessionFiles) {
    if (file.includes('subagent:')) {
      const lastUpdate = getFileModTime(file)
      const timeDiff = Date.now() - lastUpdate
      
      // 如果最近5分钟有更新，认为还在工作
      if (timeDiff < 5 * 60 * 1000) {
        const label = extractSubagentLabel(file)
        subagents.push({
          id: extractSubagentId(file),
          label,
          status: 'working',
          activity: '执行任务',
          lastUpdate
        })
      }
    }
  }
  
  return subagents.slice(0, 4) // 最多4个
}
```

---

## 前端逻辑修改

### agentBridge.ts

```typescript
// 主agent房间映射
function getMainAgentRoom(status: string): 'chat' | 'work' | 'lounge' {
  switch (status) {
    case 'working':
      return 'chat'  // 聊天室
    case 'delegating':
      return 'work'  // 工作室（分派任务）
    case 'idle':
      return 'lounge'  // 休息室
    default:
      return 'chat'
  }
}

// 子代理房间映射
function getSubagentRoom(status: string): 'work' | 'lounge' {
  // 子代理始终在工作室或休息室
  return status === 'working' ? 'work' : 'lounge'
}

// 子代理生命周期管理
function manageSubagents(office: OfficeState, subagents: Subagent[]) {
  const currentSubagentIds = new Set(subagents.map(s => s.id))
  
  // 移除已完成的子代理
  for (const [charId, char] of office.characters) {
    if (char.label?.startsWith('subagent:')) {
      if (!currentSubagentIds.has(char.label)) {
        // 子代理完成，移动到休息室后消失
        office.moveAgentToRoom(charId, 'lounge')
        setTimeout(() => {
          office.removeAgent(charId)
        }, 2000) // 2秒后消失
      }
    }
  }
  
  // 添加新的子代理
  for (const subagent of subagents) {
    if (!office.findCharacterByLabel(subagent.id)) {
      // 新子代理，从休息室出生
      const charId = office.addAgent(undefined, undefined, undefined, undefined, undefined, true)
      const ch = office.characters.get(charId)
      if (ch) {
        ch.label = subagent.label
        // 先在休息室出生
        office.moveAgentToRoom(charId, 'lounge')
        // 1秒后走到工作室
        setTimeout(() => {
          office.moveAgentToRoom(charId, 'work')
        }, 1000)
      }
    }
  }
}
```

---

## 子代理信息卡片

### 点击事件处理

```typescript
// 在 page.tsx 中添加点击处理
function handleCharacterClick(character: Character) {
  if (character.label) {
    // 显示信息卡片
    setSelectedAgent({
      name: character.label,
      status: character.isActive ? 'working' : 'idle',
      activity: character.tool || '执行任务',
      // ... 其他信息
    })
  }
}
```

### 信息卡片UI

```tsx
{selectedAgent && (
  <div className="agent-info-card">
    <h3>{selectedAgent.name}</h3>
    <p>状态: {selectedAgent.status}</p>
    <p>活动: {selectedAgent.activity}</p>
    <button onClick={() => setSelectedAgent(null)}>关闭</button>
  </div>
)}
```

---

## 实现步骤

### Step 1: 修改 API
- 修改 `/api/agent-activity/route.ts`
- 实现新的状态判断逻辑
- 分离主agent和子代理返回

### Step 2: 修改前端逻辑
- 修改 `lib/pixel-office/agentBridge.ts`
- 实现主agent房间映射
- 实现子代理生命周期管理

### Step 3: 添加子代理信息卡片
- 修改 `app/pixel-office/page.tsx`
- 添加点击事件处理
- 实现信息卡片UI

### Step 4: 测试验证
- 测试主agent状态切换
- 测试子代理出生和消失
- 测试信息卡片显示
- 验证build

---

## 验证清单

- [ ] 主agent在聊天室工作
- [ ] 主agent HEARTBEAT_OK时去休息室
- [ ] 主agent创建子代理时去工作室
- [ ] 子代理从休息室出生
- [ ] 子代理在工作室工作
- [ ] 子代理完成后回休息室消失
- [ ] 点击主agent显示信息卡片
- [ ] 点击子代理显示信息卡片
- [ ] build无错误
- [ ] commit并push
