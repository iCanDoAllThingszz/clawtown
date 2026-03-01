import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentId: string; skillName: string }> }
) {
  const { agentId, skillName } = await params;

  try {
    const WORKSPACE = process.env.OPENCLAW_HOME
      ? path.join(process.env.OPENCLAW_HOME, "workspace")
      : path.join(process.env.HOME || "", ".openclaw", "workspace");

    const skillPath = path.join(WORKSPACE, "skills", skillName);

    // 1. 检查技能是否存在
    if (!fs.existsSync(skillPath)) {
      return NextResponse.json({ error: "技能不存在" }, { status: 404 });
    }

    // 2. 删除技能文件夹
    fs.rmSync(skillPath, { recursive: true, force: true });

    // 3. 从核心文件中移除引用
    const filesToCheck = [
      path.join(WORKSPACE, "cognition.md"),
      path.join(WORKSPACE, "TOOLS.md"),
      path.join(WORKSPACE, "AGENTS.md"),
    ];

    for (const file of filesToCheck) {
      if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, "utf-8");

        // 移除包含技能名称的行
        const lines = content.split("\n");
        const filtered = lines.filter((line) => {
          const lower = line.toLowerCase();
          return !lower.includes(skillName.toLowerCase());
        });

        if (filtered.length !== lines.length) {
          fs.writeFileSync(file, filtered.join("\n"), "utf-8");
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
