import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(process.env.HOME || "", ".openclaw");
const CONFIG_PATH = path.join(OPENCLAW_HOME, "openclaw.json");

export async function GET() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw);
    const port = config.gateway?.port || 18789;
    const token = config.gateway?.auth?.token || "";

    const url = `http://localhost:${port}/api/health`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) {
      return NextResponse.json({ ok: false, error: `HTTP ${resp.status}` });
    }

    const data = await resp.json().catch(() => null);
    return NextResponse.json({ ok: true, data, webUrl: `http://localhost:${port}/chat${token ? '?token=' + encodeURIComponent(token) : ''}` });
  } catch (err: any) {
    const msg = err.cause?.code === "ECONNREFUSED"
      ? "Gateway 未运行"
      : err.name === "AbortError"
        ? "请求超时"
        : err.message;
    return NextResponse.json({ ok: false, error: msg });
  }
}
