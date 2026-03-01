import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ enabled: false, rules: [], agentId: "" });
}
export async function POST(req: Request) {
  return NextResponse.json({ enabled: false, rules: [], agentId: "" });
}
