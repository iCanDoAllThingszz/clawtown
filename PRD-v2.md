# ClawTown v2.0 PRD — OpenClaw Dashboard + 像素办公室

## 产品名称
**ClawTown** — Your OpenClaw Agent Dashboard

## 产品定位
轻量级OpenClaw运维仪表盘，3个核心功能页面，像素办公室为特色亮点。

## 技术栈
- Next.js 16 + TypeScript + Tailwind CSS v4
- PixiJS 8（像素办公室渲染）
- 无数据库，直接读取本地 ~/.openclaw/ 文件
- 30秒内存缓存

## 参考项目
`/root/.openclaw/workspace/projects/OpenClaw-bot-review/` — 重点参考其API实现

---

## 页面结构（3个功能页）

### 侧边栏导航
- 🤖 Agent总览（首页）
- 💬 会话历史
- 🎮 像素办公室

底部：主题切换（深色/浅色）+ 语言切换（中/英）

---

### 页面1：Agent总览 `/`（首页）

**功能：** 展示所有Agent基础信息 + Token用量统计

**卡片墙：** 每个Agent一张卡片，包含：
- Agent名称 + emoji
- 当前使用模型
- 绑定平台图标（Telegram/Discord/飞书等）
- 会话总数
- 最近活跃时间（相对时间，如"3分钟前"）
- 今日Token用量（输入+输出）
- 过去7天Token趋势迷你图（sparkline）

**顶部状态栏：**
- Gateway健康状态（绿灯/红灯，10秒轮询）
- 全局今日Token总消耗
- 全局活跃会话数

**数据源：** `/api/config`（参考 bot-review/app/api/config/route.ts）

---

### 页面2：会话历史 `/sessions`

**功能：** 按Agent查看所有会话，支持类型筛选

**布局：**
- 左侧：Agent选择器（下拉或tab）
- 右侧：该Agent的会话列表

**会话列表每行显示：**
- Session Key（截断显示）
- 类型标签：主会话 / DM / 群聊 / Cron / 子代理
- 最近活跃时间
- Token用量
- 状态指示（活跃/空闲）

**类型识别规则：**（参考 bot-review/app/api/sessions/[agentId]/route.ts）
- `:main` → 主会话
- `:telegram:direct:` → Telegram DM
- `:telegram:group:` → Telegram群聊
- `:cron:` → 定时任务
- `:subagent:` → 子代理

**筛选器：** 全部 / 主会话 / DM / 群聊 / Cron / 子代理

**数据源：** `/api/sessions/[agentId]`

---

### 页面3：像素办公室 `/pixel-office`

**功能：** 实时可视化Agent活动状态，单一室内场景

**室内布局：**
```
+--------------------------------------------------+
|          📚 阅览室          |    💻 工作区         |
|   ┌─────┐  ┌─────┐        |  ┌──────┐ ┌──────┐  |
|   │书 架│  │书 架│        |  │电脑桌│ │电脑桌│  |
|   └─────┘  └─────┘        |  └──────┘ └──────┘  |
|      ┌────────┐            |     ┌────────┐      |
|      │阅读桌  │            |     │工具架  │      |
|      └────────┘            |     └────────┘      |
|                            |                      |
|----------------------------+----------------------|
|                    🚪 门                           |
|                                                    |
|               🏠 休息区                             |
|     ┌────┐          ┌──┐        ┌────┐            |
|     │沙发│          │灯│        │饮水机│           |
|     └────┘          └──┘        └────┘            |
|                                                    |
+--------------------------------------------------+
```

**三个功能区域：**

| 区域 | 家具 | 对应Agent状态 |
|------|------|--------------|
| 🏠 休息区 | 沙发、落地灯、饮水机 | idle、sleeping、waking |
| 💻 工作区 | 电脑桌x2、工具架 | working(exec/read/write/edit/browser)、talking(message) |
| 📚 阅览室 | 书架x2、阅读桌 | working(web_search/memory_search/tts/cron) |

**Agent角色行为：**
- 像素小人，4方向行走动画
- 根据状态在区域间移动（A*寻路）
- 到达目标区域后：坐下/站立/打字
- 头顶状态气泡：⚡工作中 / 💭思考 / 💬对话 / 💤睡觉 / ❌报错
- 头顶显示Agent名称
- 子代理作为小号角色出现，跟随父Agent

**渲染技术：**
- PixiJS 8 Application
- 16x16像素瓦片，3x缩放
- 分层：地板 → 墙壁 → 家具 → 角色 → UI气泡
- 像素风格，imageRendering: pixelated

**数据源：** `/api/agent-activity`（轮询间隔3秒）

---

## API Routes

| 路由 | 功能 | 参考 |
|------|------|------|
| `GET /api/config` | Agent列表+模型+平台+Token统计+Gateway状态 | bot-review config/route.ts |
| `GET /api/sessions/[agentId]` | 指定Agent的会话列表 | bot-review sessions/route.ts |
| `GET /api/gateway-health` | Gateway健康检查 | bot-review gateway-health/route.ts |
| `GET /api/agent-activity` | Agent实时活动状态（像素办公室用） | bot-review agent-activity/route.ts |

---

## 数据读取方式

```
~/.openclaw/
├── openclaw.json          → Agent配置、模型、平台绑定
├── agents/
│   └── {agentId}/
│       └── sessions/
│           ├── sessions.json   → 会话列表
│           └── *.jsonl         → 会话详情（Token用量）
└── workspace/
    └── skills/             → 技能目录（未来扩展）
```

- 配置：`fs.readFileSync(~/.openclaw/openclaw.json)`
- 会话：`fs.readFileSync(~/.openclaw/agents/{id}/sessions/sessions.json)`
- Token统计：解析 `*.jsonl` 中 assistant 消息的 `usage` 字段
- 30秒内存缓存

---

## 项目结构

```
clawtown/
├── app/
│   ├── globals.css
│   ├── layout.tsx              # 根布局：侧边栏 + 主内容区
│   ├── page.tsx                # Agent总览（首页）
│   ├── sessions/page.tsx       # 会话历史
│   ├── pixel-office/page.tsx   # 像素办公室
│   └── api/
│       ├── config/route.ts
│       ├── sessions/[agentId]/route.ts
│       ├── gateway-health/route.ts
│       └── agent-activity/route.ts
├── components/
│   ├── Sidebar.tsx
│   ├── AgentCard.tsx
│   ├── SessionList.tsx
│   ├── GatewayStatus.tsx
│   └── ThemeToggle.tsx
├── lib/
│   ├── i18n.tsx
│   ├── theme.tsx
│   └── pixel-office/
│       ├── types.ts
│       ├── PixelOffice.tsx     # React组件，包装PixiJS
│       ├── officeEngine.ts     # 办公室状态管理
│       ├── officeRenderer.ts   # PixiJS渲染
│       ├── characters.ts       # 角色精灵+动画
│       ├── furniture.ts        # 家具定义+精灵
│       └── agentBridge.ts      # Agent状态→办公室角色同步
├── package.json
├── tsconfig.json
├── next.config.mjs
├── postcss.config.js
└── tailwind.config.ts
```

---

## 设计风格
- 深色主题为默认（暗色背景 + 亮色卡片）
- 参考 bot-review 的 CSS 变量方案
- 像素办公室：星露谷物语风格暖色调
- 卡片圆角 + 微妙边框 + hover效果

## 验收标准
1. `npm run build` 零错误
2. 3个页面均可正常访问和渲染
3. API能正确读取本地OpenClaw配置并返回JSON
4. 像素办公室能渲染室内场景 + Agent角色移动
5. 深色/浅色主题切换正常
6. 中英文切换正常
