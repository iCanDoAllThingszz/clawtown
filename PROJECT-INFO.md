# ClawTown 项目信息

## 基本信息
- **定位：** OpenClaw Bot Dashboard - 像素风格的Agent可视化面板
- **GitHub：** https://github.com/iCanDoAllThingszz/clawtown (public, MIT)
- **本地路径：** `/root/.openclaw/workspace/projects/clawtown/`
- **服务地址：** http://localhost:3001 (公网可访问)
- **技术栈：** Next.js 16 + React + TypeScript + Tailwind CSS

## 当前版本：v2.0
**最新commit：** 22d428d (2026-03-01 16:50)

### 核心功能
1. **Agent Overview（首页）**
   - Agent状态卡片（名称、emoji、运行时模型）
   - Gateway健康状态
   - 快速导航

2. **Session History（会话历史）**
   - 会话列表（主会话、子代理、cron任务等）
   - 会话类型筛选
   - 点击卡片展开详情面板
   - 显示最近50条消息
   - 一键压缩上下文（使用率>50%时显示🧹按钮）
   - 真实名称显示（禹哥/酪酪/子代理）
   - 子代理消息智能识别（任务/announce/用户）

3. **Tools List（工具列表）** 🆕
   - 显示所有agent卡片
   - 点击agent展开显示该agent的工具列表
   - 工具卡片显示名称、描述、调用次数
   - 从session jsonl统计工具调用次数

4. **Skills List（技能列表）** 🆕
   - 显示所有agent卡片
   - 点击agent展开显示该agent的技能列表
   - 技能卡片显示名称、描述、emoji、调用次数
   - 从SKILL.md解析技能信息

5. **Pixel Office（像素小镇）**
   - 日式RPG风格可视化
   - Agent活动状态展示
   - 建筑交互（家/工作坊/图书馆/网咖）

### API接口
- `/api/config` - Agent配置（名称、emoji、用户名）
- `/api/sessions/[agentId]` - 会话列表
- `/api/sessions/[agentId]/[sessionId]` - 会话详情
- `/api/sessions/[agentId]/[sessionId]/compact` - 压缩上下文
- `/api/tools/[agentId]` - 工具列表（统计调用次数）🆕
- `/api/skills/[agentId]` - 技能列表（解析SKILL.md）🆕
- `/api/agent-activity` - Agent活动状态
- `/api/gateway-health` - Gateway健康检查
- `/api/pixel-office/layout` - 像素小镇布局

## 部署配置

### Systemd服务（持久化运行）
- **服务名：** clawtown.service
- **配置文件：** `/etc/systemd/system/clawtown.service`
- **启动命令：** `sudo systemctl start clawtown`
- **停止命令：** `sudo systemctl stop clawtown`
- **重启命令：** `sudo systemctl restart clawtown`
- **查看状态：** `sudo systemctl status clawtown`
- **查看日志：** `cat /root/.openclaw/workspace/projects/clawtown/logs/clawtown.log`
- **自动启动：** 已启用（开机自启）

### 服务挂掉问题解决（2026-03-01）
**问题：** 服务隔一段时间就挂掉
**根因：** 没有使用进程管理工具，执行完就退出了
**解决方案：** 配置systemd服务，设置自动重启（Restart=always, RestartSec=10）
**关键配置：** 必须使用Node.js 22（Next.js 16要求>=20.9.0），直接调用next命令而非npm start

## 今日迭代记录（2026-03-01）

### 上午（12:05-12:37）
- v2.0彻底重构：删除1426行无用代码，3核心页面零404
- 会话详情面板：点击展开、显示对话记录
- 会话类型识别修复（subagent显示正确）
- 一键压缩上下文功能
- Gateway按钮改为状态展示
- commits: 207de88, 7b4421f, 3ad9f3b, 7300eb2, bbe6589, f3d6e6b

### 下午（12:40-16:08）
- fetch超时重试机制（10s超时，3次重试）
- 子代理消息智能区分（任务/announce/用户）
- 真实名称显示（禹哥/酪酪）
- cron任务去重
- 子代理卡片消失bug修复
- 用户名/agent名兜底逻辑
- commits: a289a6c, 6f18520, 906c80e, 5ab7949, 00a0c0d, 19620a3

## 开发模式验证
- **酪酪：** 产品经理（PRD + 验收）
- **Claude Code：** 研发工程师（写代码）
- **子代理：** 测试工程师（监督 + 验证build）
- **工具链：** Claude Code + MiniMax M2.5（会员无限用）

## 已知问题
- ✅ 所有已知bug已修复
- ✅ build零错误
- ✅ 服务稳定运行

## 下一步计划
- Pixel Office深度开发（状态机架构 + 建筑泛化）
- 画面质量升级（对标星露谷物语）
- PixiJS渲染层重构

## 关键配置
- **Claude Code环境变量：** 已配置在 `/root/.bashrc`
- **调用方式：** `echo "task" | claude -p --allowedTools "..."`
- **探活方式：** `git status --short` 检查文件变化
- **参考文档：** https://platform.minimaxi.com/docs/coding-plan/claude-code
