# ClawTown 新功能：工具列表 & 技能列表

## 需求概述
在侧边栏新增"工具列表"和"技能列表"两个导航项，点击后显示所有agent卡片，点击agent卡片后展示该agent已集成的工具/技能卡片。

---

## 1. 侧边栏导航新增

### 位置
在"Agent总览"下方新增两个导航项：
- 🛠️ 工具列表 (`/tools`)
- 📦 技能列表 (`/skills`)

### 文件修改
`app/layout.tsx` 或侧边栏组件

---

## 2. 工具列表页 (`/tools`)

### 页面结构
```
┌─────────────────────────────────────┐
│ 🛠️ 工具列表                         │
│ 选择Agent查看已集成的工具            │
├─────────────────────────────────────┤
│ ┌─────┐  ┌─────┐  ┌─────┐          │
│ │ 🤖  │  │ 🤖  │  │ 🤖  │          │
│ │酪酪 │  │子代理│  │...  │          │
│ └─────┘  └─────┘  └─────┘          │
└─────────────────────────────────────┘
```

### Agent卡片点击后
展开显示该agent的工具卡片列表（不可点击，纯展示）：

```
┌─────────────────────────────────────┐
│ 🤖 酪酪 的工具                       │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 📖 read                         │ │
│ │ 读取文件内容                     │ │
│ │ 调用次数: 1,234 次               │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ ✍️ write                        │ │
│ │ 写入文件内容                     │ │
│ │ 调用次数: 567 次                 │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🌐 web_search                   │ │
│ │ 网络搜索                         │ │
│ │ 调用次数: 89 次                  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 工具卡片信息
- **名称**：工具名（如 `read`, `write`, `exec`, `web_search`）
- **描述**：简短描述（可以hardcode常见工具的描述）
- **调用次数**：从session jsonl文件统计（如果能拿到）

---

## 3. 技能列表页 (`/skills`)

### 页面结构
与工具列表页类似，但展示的是技能（从 `~/.openclaw/workspace/skills/` 读取）

### Agent卡片点击后
展开显示该agent的技能卡片列表：

```
┌─────────────────────────────────────┐
│ 🤖 酪酪 的技能                       │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🌤️ weather                      │ │
│ │ 获取天气预报（无需API key）      │ │
│ │ 调用次数: 12 次                  │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🔍 zhipu-search                 │ │
│ │ 智谱AI联网搜索                   │ │
│ │ 调用次数: 45 次                  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 技能卡片信息
- **名称**：技能名（从 `SKILL.md` 的 `name` 字段读取）
- **描述**：技能描述（从 `SKILL.md` 的 `description` 字段读取）
- **Emoji**：技能图标（从 `SKILL.md` 的 `metadata.clawdbot.emoji` 读取，如果有）
- **调用次数**：从session jsonl文件统计（如果能拿到）

---

## 4. API设计

### `/api/tools/[agentId]` - 获取agent的工具列表

**返回格式：**
```json
{
  "agentId": "main",
  "agentName": "酪酪",
  "tools": [
    {
      "name": "read",
      "description": "读取文件内容",
      "callCount": 1234
    },
    {
      "name": "write",
      "description": "写入文件内容",
      "callCount": 567
    },
    {
      "name": "exec",
      "description": "执行shell命令",
      "callCount": 890
    }
  ]
}
```

**实现逻辑：**
1. 读取 `~/.openclaw/agents/{agentId}/sessions/*.jsonl` 文件
2. 解析每个 `message` 中的 `toolCall`，统计 `name` 字段
3. 常见工具的描述可以hardcode（read/write/exec/web_search/web_fetch/browser等）

### `/api/skills/[agentId]` - 获取agent的技能列表

**返回格式：**
```json
{
  "agentId": "main",
  "agentName": "酪酪",
  "skills": [
    {
      "name": "weather",
      "description": "获取天气预报（无需API key）",
      "emoji": "🌤️",
      "callCount": 12
    },
    {
      "name": "zhipu-search",
      "description": "智谱AI联网搜索",
      "emoji": "🔍",
      "callCount": 45
    }
  ]
}
```

**实现逻辑：**
1. 扫描 `~/.openclaw/workspace/skills/` 目录
2. 读取每个技能的 `SKILL.md` 文件，解析 frontmatter（YAML格式）
3. 提取 `name`, `description`, `metadata.clawdbot.emoji`
4. 从session jsonl文件统计调用次数（匹配技能名称）

---

## 5. 前端页面实现

### 文件结构
```
app/
  tools/
    page.tsx          # 工具列表页
  skills/
    page.tsx          # 技能列表页
  api/
    tools/
      [agentId]/
        route.ts      # 工具列表API
    skills/
      [agentId]/
        route.ts      # 技能列表API
```

### 页面交互
1. 初始状态：显示所有agent卡片（复用 `/api/config` 获取agent列表）
2. 点击agent卡片：展开显示该agent的工具/技能卡片
3. 工具/技能卡片：不可点击，纯展示

### 样式要求
- 复用现有的卡片样式（参考 `/sessions` 页面）
- 工具/技能卡片使用不同的颜色区分
- 调用次数用小字体显示在右下角

---

## 6. 调用次数统计（可选）

### 如果能拿到
从 `~/.openclaw/agents/{agentId}/sessions/*.jsonl` 文件统计：
- 解析每个 `message.content[].toolCall.name`
- 统计每个工具/技能的调用次数

### 如果拿不到
- 显示 "调用次数: N/A"
- 或者不显示调用次数字段

---

## 7. 常见工具描述（hardcode）

```typescript
const TOOL_DESCRIPTIONS: Record<string, string> = {
  read: "读取文件内容",
  write: "写入文件内容",
  edit: "编辑文件",
  exec: "执行shell命令",
  process: "管理后台进程",
  web_search: "网络搜索",
  web_fetch: "获取网页内容",
  browser: "浏览器控制",
  canvas: "Canvas控制",
  nodes: "节点管理",
  cron: "定时任务管理",
  message: "消息发送",
  gateway: "Gateway管理",
  sessions_list: "会话列表",
  sessions_history: "会话历史",
  sessions_send: "发送消息到会话",
  sessions_spawn: "创建子代理",
  session_status: "会话状态",
  memory_search: "记忆搜索",
  memory_get: "读取记忆",
  tts: "文字转语音",
};
```

---

## 8. 验证清单

- [ ] 侧边栏新增"工具列表"和"技能列表"导航项
- [ ] `/tools` 页面显示所有agent卡片
- [ ] 点击agent卡片展开显示工具列表
- [ ] 工具卡片显示名称、描述、调用次数（如果有）
- [ ] `/skills` 页面显示所有agent卡片
- [ ] 点击agent卡片展开显示技能列表
- [ ] 技能卡片显示名称、描述、emoji、调用次数（如果有）
- [ ] API `/api/tools/[agentId]` 返回正确数据
- [ ] API `/api/skills/[agentId]` 返回正确数据
- [ ] build无错误
- [ ] commit并push

---

## 9. 注意事项

1. **SKILL.md解析**：frontmatter是YAML格式，用 `gray-matter` 库解析
2. **调用次数统计**：如果性能有问题，可以先不实现，显示"N/A"
3. **错误处理**：如果读取文件失败，显示友好的错误提示
4. **响应式设计**：卡片在移动端也要正常显示

---

## 10. 参考文件

- 侧边栏：`app/layout.tsx`
- Agent卡片样式：`app/sessions/page.tsx`（AgentPicker组件）
- API实现：`app/api/config/route.ts`（读取配置文件的逻辑）
- Session解析：`app/api/sessions/[agentId]/route.ts`（读取jsonl文件的逻辑）
