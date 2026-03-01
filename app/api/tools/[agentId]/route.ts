import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(process.env.HOME || "", ".openclaw");

// 常见工具描述
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

interface Tool {
  name: string;
  description: string;
  callCount: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;

  try {
    // 读取 agent 配置获取名称
    const configPath = path.join(OPENCLAW_HOME, "openclaw.json");
    let agentName = agentId;
    try {
      const configContent = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(configContent);
      const agent = config.agents?.find((a: any) => a.id === agentId);
      if (agent?.name) {
        agentName = agent.name;
      }
    } catch {
      // 配置读取失败，使用 agentId 作为名称
    }

    // 统计工具调用次数
    const toolCounts: Record<string, number> = {};
    const sessionsDir = path.join(OPENCLAW_HOME, `agents/${agentId}/sessions`);

    if (fs.existsSync(sessionsDir)) {
      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith(".jsonl") && !f.includes(".deleted."));
      
      for (const file of files) {
        const filePath = path.join(sessionsDir, file);
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const lines = content.trim().split("\n");
          
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              
              // 从 message.content 中提取 toolCall
              if (entry.type === "message" && entry.message?.content) {
                const content = entry.message.content;
                if (Array.isArray(content)) {
                  for (const item of content) {
                    if (item.type === "toolCall" && item.toolCall?.name) {
                      const toolName = item.toolCall.name;
                      toolCounts[toolName] = (toolCounts[toolName] || 0) + 1;
                    }
                  }
                }
              }
            } catch {
              // 跳过无效的 JSON 行
            }
          }
        } catch {
          // 跳过无法读取的文件
        }
      }
    }

    // 构建工具列表
    const tools: Tool[] = Object.entries(toolCounts).map(([name, count]) => ({
      name,
      description: TOOL_DESCRIPTIONS[name] || "未知工具",
      callCount: count,
    }));

    // 按调用次数排序
    tools.sort((a, b) => b.callCount - a.callCount);

    return NextResponse.json({
      agentId,
      agentName,
      tools,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch tools" },
      { status: 500 }
    );
  }
}
