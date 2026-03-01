import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ agentId: string; sessionId: string }> }
) {
  const { agentId, sessionId } = await params;

  try {
    // Use openclaw agent command to send /compact to the session
    const cmd = `openclaw agent --agent ${agentId} --session-id ${sessionId} --message "/compact" --json 2>&1`;
    const output = execSync(cmd, { timeout: 60000, encoding: "utf-8" });

    return NextResponse.json({
      ok: true,
      message: "Compaction triggered",
      output: output.slice(0, 500),
    });
  } catch (e: unknown) {
    const error = e as { message?: string; stderr?: string };
    return NextResponse.json(
      { ok: false, error: error.message || "Compaction failed", stderr: error.stderr?.slice(0, 300) },
      { status: 500 }
    );
  }
}
