# ClawTown 像素办公室优化

## 需求概述
优化像素办公室的小人行为逻辑和场景布局，让小人根据agent状态在不同房间移动，并修正场景细节。

---

## 1. 像素小人行为逻辑

### 1.1 主Agent小人
- **存在性：** 一直存在，不会消失
- **名字：** 头上显示主agent的实际名字（从config获取）
- **状态映射：**
  - 休息状态（HEARTBEAT_OK / 无活动）→ 休息室沙发
  - 回复问题（无工具/技能调用）→ 聊天室电脑
  - 执行工具/技能 → 工作室电脑

### 1.2 子代理小人
- **出生：** 子代理创建时，从休息室出生
- **名字：** 头上显示子代理的label（如 "clawtown-cron-jobs"）
- **状态映射：**
  - 执行任务 → 工作室电脑
  - 任务完成 → 回到休息室消失
- **并发限制：** 工作室只有4台电脑，最多4个agent同时工作

### 1.3 小人外观
- **参考项目：** https://github.com/xmanrui/OpenClaw-bot-review
- **要求：** 沿用原作者的小人设计（符合审美）
- **名字显示：** 小人头上显示实际名字（白色文字，黑色描边）

---

## 2. 房间功能定义

### 2.1 休息室（Rest Room）
- **功能：** agent休息、出生点
- **家具：** 沙发
- **小人行为：**
  - 主agent休息时坐在沙发上
  - 子代理出生时从沙发位置出现
  - 子代理完成任务后回到沙发消失

### 2.2 聊天室（Chat Room）
- **功能：** 主agent回复问题（无工具/技能）
- **家具：** 1台电脑
- **小人行为：**
  - 主agent回复问题时坐在电脑前

### 2.3 工作室（Work Room）
- **功能：** agent执行工具/技能
- **家具：** 4台电脑、墙上git提交记录
- **小人行为：**
  - agent执行工具/技能时走到空闲电脑前
  - 最多4个agent同时工作
  - 超过4个时排队等待

---

## 3. 场景修改

### 3.1 删除聊天室数码相机
- **位置：** 聊天室桌子上
- **操作：** 从场景中移除数码相机sprite

### 3.2 修正休息室沙发朝向
- **问题：** 沙发朝向反了
- **操作：** 调整沙发sprite的朝向或位置

---

## 4. Git提交记录

### 4.1 数据来源
- **优先：** 读取真实git提交记录
  - 检查 `/root/.openclaw/workspace/projects/` 下的git仓库
  - 执行 `git log --oneline -n 10` 获取最近10条提交
- **降级：** 无法获取时显示mock数据

### 4.2 显示格式
```
[12:34] feat: add cron jobs page
[11:20] fix: show all cron jobs
[10:15] feat: add delete button
...
```

### 4.3 更新频率
- 每30秒刷新一次
- 或agent有新提交时立即刷新

---

## 5. 状态检测逻辑

### 5.1 Agent状态API
- **接口：** `/api/agent-activity`
- **返回：**
```json
{
  "agents": [
    {
      "id": "main",
      "name": "酪酪",
      "status": "working", // idle | chatting | working
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

### 5.2 状态判断规则
- **idle（休息）：** 最近5分钟无活动
- **chatting（聊天）：** 最近消息无工具/技能调用
- **working（工作）：** 正在执行工具/技能

---

## 6. 实现步骤

### Step 1: 修改场景布局
1. 删除聊天室数码相机
2. 修正休息室沙发朝向
3. 验证场景渲染

### Step 2: 实现Agent状态API
1. 创建 `/api/agent-activity` 接口
2. 读取sessions数据判断状态
3. 返回所有agent的当前状态

### Step 3: 实现小人行为逻辑
1. 主agent小人：根据状态在房间间移动
2. 子代理小人：出生、工作、消失
3. 小人头上显示名字

### Step 4: 实现Git提交记录
1. 读取真实git log
2. 降级到mock数据
3. 显示在工作室墙上

### Step 5: 测试验证
1. 测试主agent状态切换
2. 测试子代理出生和消失
3. 测试并发限制（4台电脑）
4. 测试git提交记录显示

---

## 7. 技术细节

### 7.1 小人移动动画
- 使用原项目的移动逻辑
- 平滑过渡到目标位置
- 到达后播放坐下/工作动画

### 7.2 电脑占用管理
```typescript
interface Computer {
  id: number; // 1-4
  occupied: boolean;
  agentId: string | null;
}

// 分配电脑
function assignComputer(agentId: string): number | null {
  const available = computers.find(c => !c.occupied);
  if (available) {
    available.occupied = true;
    available.agentId = agentId;
    return available.id;
  }
  return null; // 无空闲电脑，排队
}
```

### 7.3 名字显示
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

## 8. 参考资料

- **原项目：** https://github.com/xmanrui/OpenClaw-bot-review
- **小人sprite：** 沿用原项目设计
- **当前代码：** `/root/.openclaw/workspace/projects/clawtown/lib/pixel-office/`

---

## 9. 验证清单

- [ ] 场景修改：删除相机、修正沙发
- [ ] Agent状态API正常工作
- [ ] 主agent小人根据状态移动
- [ ] 子代理小人出生和消失
- [ ] 小人头上显示名字
- [ ] 工作室电脑并发限制（最多4个）
- [ ] Git提交记录显示（真实或mock）
- [ ] build无错误
- [ ] commit并push

---

## 10. 注意事项

1. **性能优化：** 状态检测不要太频繁（30秒一次）
2. **错误处理：** API失败时显示默认状态
3. **动画流畅：** 小人移动要平滑自然
4. **并发安全：** 电脑分配要避免冲突
5. **名字长度：** 过长的名字要截断或缩小字体
