import { NextResponse } from "next/server";
import { spawn } from "child_process";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ agentId: string; sessionId: string }> }
) {
  const { agentId, sessionId } = await params;

  try {
    // Fire and forget — spawn openclaw agent in background
    const child = spawn("openclaw", [
      "agent",
      "--agent", agentId,
      "--session-id", sessionId,
      "--message", "/compact",
    ], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return NextResponse.json({
      ok: true,
      message: "Compaction triggered (async). Context will shrink in ~10-30 seconds.",
    });
  } catch (e: unknown) {
    const error = e as { message?: string };
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to trigger compaction" },
      { status: 500 }
    );
  }
}
