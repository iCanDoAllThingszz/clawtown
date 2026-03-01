import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(process.env.HOME || "", ".openclaw");
const SKILLS_DIR = path.join(OPENCLAW_HOME, "workspace/skills");

interface Skill {
  name: string;
  description: string;
  emoji: string;
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

    // 扫描 skills 目录
    const skills: Skill[] = [];
    const skillCounts: Record<string, number> = {};

    if (fs.existsSync(SKILLS_DIR)) {
      const skillDirs = fs.readdirSync(SKILLS_DIR).filter(f => {
        const fullPath = path.join(SKILLS_DIR, f);
        return fs.statSync(fullPath).isDirectory() && !f.startsWith("__");
      });

      for (const skillDir of skillDirs) {
        const skillMdPath = path.join(SKILLS_DIR, skillDir, "SKILL.md");
        if (fs.existsSync(skillMdPath)) {
          try {
            const content = fs.readFileSync(skillMdPath, "utf-8");
            const { data } = matter(content);

            const skillName = data.name || skillDir;
            const description = data.description || "无描述";
            let emoji = "📦";

            // 尝试从 metadata.clawdbot.emoji 读取
            if (data.metadata?.clawdbot?.emoji) {
              emoji = data.metadata.clawdbot.emoji;
            }

            skills.push({
              name: skillName,
              description,
              emoji,
              callCount: 0, // 先设为0，后面统计
            });

            // 记录技能名称用于统计
            skillCounts[skillName] = 0;
          } catch {
            // 跳过无法解析的 SKILL.md
          }
        }
      }
    }

    // 统计技能调用次数（从 session jsonl 文件中匹配技能名称）
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
              
              // 从 message.content 中提取 toolCall，匹配技能名称
              if (entry.type === "message" && entry.message?.content) {
                const content = entry.message.content;
                if (Array.isArray(content)) {
                  for (const item of content) {
                    if (item.type === "toolCall" && item.toolCall?.name) {
                      const toolName = item.toolCall.name;
                      // 检查是否匹配任何技能名称
                      for (const skillName of Object.keys(skillCounts)) {
                        if (toolName.includes(skillName) || skillName.includes(toolName)) {
                          skillCounts[skillName]++;
                        }
                      }
                    }
                  }
                }
              }

              // 也检查 message.text 中是否提到技能名称（作为补充）
              if (entry.type === "message" && entry.message?.text) {
                const text = entry.message.text;
                for (const skillName of Object.keys(skillCounts)) {
                  if (text.includes(skillName)) {
                    // 不增加计数，避免误判
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

    // 更新技能的调用次数
    for (const skill of skills) {
      skill.callCount = skillCounts[skill.name] || 0;
    }

    // 按调用次数排序
    skills.sort((a, b) => b.callCount - a.callCount);

    return NextResponse.json({
      agentId,
      agentName,
      skills,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch skills" },
      { status: 500 }
    );
  }
}
