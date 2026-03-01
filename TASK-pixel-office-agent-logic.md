# ClawTown 像素小人行为逻辑实现

## 任务目标
实现像素小人根据agent状态在三个房间移动，显示名字，以及git提交记录。

---

## Claude Code 使用说明（重要！）

### 环境变量（已配置在 /root/.bashrc）
```bash
export ANTHROPIC_AUTH_TOKEN="<minimax-api-key>"
export ANTHROPIC_BASE_URL="https://api.minimaxi.com/anthropic"
export ANTHROPIC_MODEL="MiniMax-M2.5"
export API_TIMEOUT_MS="3000000"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"
```

### 正确调用方式
```bash
source /root/.bashrc
cd /root/.openclaw/workspace/projects/clawtown
cat TASK-pixel-office-agent-logic.md | claude -p --model MiniMax-M2.5 --allowedTools "Bash(npm:*) Bash(git:*) Bash(find:*) Bash(grep:*) Bash(cat:*) Bash(ls:*) Bash(mkdir:*) Bash(rm:*) Bash(mv:*) Bash(cp:*) Bash(sed:*) Bash(head:*) Bash(tail:*) Bash(wc:*) Read Write Edit"
```

### 重要提示
1. **Claude Code运行期间不会有输出** — 这是正常的！不要因为没有输出就认为卡住了
2. **探活方式：** 定期检查 `git status --short` 看文件是否有变化
3. **耐心等待：** 复杂任务可能需要5-10分钟
4. **验证方式：** 最后检查 `npm run build` 是否成功

---

## 功能需求

### 1. Agent状态API (`/api/agent-activity`)

**返回格式：**
```json
{
  "agents": [
    {
      "id": "main",
      "name": "酪酪",
      "status": "working",  // idle | chatting | working
      "activity": "执行工具: exec",
      "lastUpdate": 1772362800000
    },
    {
      "id": "subagent:xxx",
      "label": "clawtown-cron-jobs",
      "status": "working",
      "activity": "执行任务",
      "lastUpdate": 1772362800000
    }
  ]
}
```

**状态判断规则：**
- **idle（休息）：** 最近5分钟无活动
- **chatting（聊天）：** 最近消息无工具/技能调用
- **working（工作）：** 正在执行工具/技能

**实现方式：**
- 读取 `/root/.openclaw/agents/main/sessions/*.jsonl` 文件
- 解析最近的消息，判断agent状态
- 返回所有active的agent（主agent + 子代理）

---

### 2. 小人行为逻辑

**主agent小人：**
- 一直存在，不会消失
- 根据状态在房间移动：
  - idle → 休息室沙发
  - chatting → 聊天室电脑
  - working → 工作室电脑

**子代理小人：**
- 创建时从休息室出生
- 执行任务时走到工作室电脑
- 完成后回到休息室消失

**电脑占用管理：**
- 工作室有4台电脑
- 最多4个agent同时工作
- 超过4个时排队等待

---

### 3. 小人名字显示

**实现方式：**
```typescript
// 在小人头上绘制名字
function drawName(ctx: CanvasRenderingContext2D, name: string, x: number, y: number) {
  ctx.font = '12px Arial';
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 3;
  ctx.strokeText(name, x, y - 20);
  ctx.fillText(name, x, y - 20);
}
```

---

### 4. Git提交记录

**数据来源：**
```bash
cd /root/.openclaw/workspace/projects/clawtown
git log --oneline -n 10
```

**显示格式：**
```
[12:34] feat: add cron jobs page
[11:20] fix: show all cron jobs
[10:15] feat: add delete button
```

**更新频率：** 每30秒刷新一次

---

## 实现步骤

### Step 1: 创建Agent状态API
- 文件：`app/api/agent-activity/route.ts`
- 读取sessions数据
- 判断agent状态
- 返回JSON

### Step 2: 修改小人渲染逻辑
- 文件：`lib/pixel-office/engine/officeState.ts` 或相关文件
- 添加小人名字显示
- 实现状态-房间映射

### Step 3: 实现房间移动逻辑
- 小人根据状态移动到对应房间
- 平滑过渡动画
- 电脑占用管理

### Step 4: 实现Git提交记录
- 创建API获取git log
- 在工作室墙上显示
- 定期刷新

### Step 5: 测试验证
- 测试主agent状态切换
- 测试子代理出生和消失
- 测试并发限制
- 验证build

---

## 参考文件

- 原项目：https://github.com/xmanrui/OpenClaw-bot-review
- 当前代码：`/root/.openclaw/workspace/projects/clawtown/lib/pixel-office/`
- 场景布局：`lib/pixel-office/layout/layoutSerializer.ts`

---

## 验证清单

- [ ] Agent状态API正常工作
- [ ] 主agent小人根据状态移动
- [ ] 子代理小人出生和消失
- [ ] 小人头上显示名字
- [ ] 工作室电脑并发限制
- [ ] Git提交记录显示
- [ ] build无错误
- [ ] commit并push
