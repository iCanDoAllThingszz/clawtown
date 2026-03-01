"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { GatewayStatus } from "./gateway-status";

interface Platform {
  name: string;
  accountId?: string;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  model: string;
  activeModel?: string | null;
  platforms: Platform[];
  session?: {
    lastActive: number | null;
    totalTokens: number;
    contextTokens: number;
    sessionCount: number;
    todayAvgResponseMs: number;
    messageCount: number;
    weeklyTokens: number[];
  };
}

interface ConfigData {
  agents: Agent[];
  defaults: { model: string; fallbacks: string[] };
  gateway?: { port: number; token?: string };
  groupChats?: { groupId: string; channel: string; agents: { id: string; emoji: string; name: string }[] }[];
}

type TFunc = (key: string) => string;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

// 迷你曲线图 (sparkline)
function MiniSparkline({ data, width = 120, height = 24 }: { data: number[]; width?: number; height?: number }) {
  const hasData = data.some(v => v > 0);
  if (!hasData) return null;

  const validValues = data.filter(v => v > 0);
  let color = "#f59e0b";
  if (validValues.length >= 2) {
    const last = validValues[validValues.length - 1];
    const prev = validValues[validValues.length - 2];
    color = last > prev ? "#f87171" : last < prev ? "#4ade80" : "#f59e0b";
  }

  const max = Math.max(...data);
  const min = Math.min(...data.filter(v => v > 0), max);
  const range = max - min || 1;
  const pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = v === 0 ? height - pad : (height - pad) - ((v - min) / range) * (height - pad * 2 - 2);
    return { x, y, v };
  });
  const line = pts.map(p => `${p.x},${p.y}`).join(" ");
  const area = `${pts[0].x},${height} ${line} ${pts[pts.length - 1].x},${height}`;
  const id = `spark-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {pts.filter(p => p.v > 0).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2} fill={color} opacity={0.9} />
      ))}
    </svg>
  );
}

// 平台标签
function PlatformBadge({ platform }: { platform: Platform }) {
  const pName = platform.name;
  const badgeStyle = pName === "feishu"
    ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
    : pName === "telegram"
    ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
    : pName === "whatsapp"
    ? "bg-green-500/20 text-green-300 border-green-500/30"
    : "bg-purple-500/20 text-purple-300 border-purple-500/30";

  const icons: Record<string, string> = { feishu: "📱", telegram: "✈️", whatsapp: "💬", discord: "🎮" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${badgeStyle}`}>
      {icons[pName] || "🔌"} {pName}
      {platform.accountId && <span className="opacity-60">({platform.accountId})</span>}
    </span>
  );
}

// 模型标签
function ModelBadge({ model }: { model: string }) {
  const [provider, modelName] = model.includes("/") ? model.split("/", 2) : ["default", model];
  const colors: Record<string, string> = {
    "yunyi-claude": "bg-green-500/20 text-green-300 border-green-500/30",
    minimax: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    volcengine: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    bailian: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[provider] || "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}>
      🧠 {modelName}
    </span>
  );
}

// Agent 卡片
function AgentCard({ agent, t }: { agent: Agent; t: TFunc }) {
  function formatTimeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("common.justNow");
    if (mins < 60) return `${mins} ${t("common.minutesAgo")}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ${t("common.hoursAgo")}`;
    const days = Math.floor(hours / 24);
    return `${days} ${t("common.daysAgo")}`;
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5 hover:border-[var(--accent)] transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xl">{agent.emoji}</span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--text)]">{agent.name}</h3>
          <span className="text-[10px] text-[var(--text-muted)]">{agent.id}</span>
        </div>
      </div>

      <div className="space-y-1">
        <div>
          <span className="text-xs text-[var(--text-muted)] block">{t("agent.model")}</span>
          <ModelBadge model={agent.activeModel || agent.model} />
        </div>

        <div>
          <span className="text-xs text-[var(--text-muted)] block">{t("agent.platform")}</span>
          <div className="flex flex-wrap gap-1">
            {agent.platforms.map((p, i) => (
              <PlatformBadge key={i} platform={p} />
            ))}
          </div>
        </div>

        {agent.session && (
          <div className="pt-1 mt-1 border-t border-[var(--border)]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">{t("agent.sessionCount")}</span>
              <a href={`/sessions?agent=${agent.id}`} className="text-[var(--accent)] hover:underline cursor-pointer">
                {agent.session.sessionCount} →
              </a>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-[var(--text-muted)]">{t("agent.messageCount")}</span>
              <span className="text-[var(--text)]">{agent.session.messageCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-[var(--text-muted)]">{t("agent.tokenUsage")}</span>
              {agent.session.weeklyTokens && <MiniSparkline data={agent.session.weeklyTokens} />}
              <span className="text-[var(--text)]" title={t("agent.totalTokenTip")}>{formatTokens(agent.session.totalTokens)}</span>
            </div>
            {agent.session.lastActive && (
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-[var(--text-muted)]">{t("agent.lastActive")}</span>
                <span className="text-[var(--text)]">{formatTimeAgo(agent.session.lastActive)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { t } = useI18n();
  const [data, setData] = useState<ConfigData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(0);

  const REFRESH_OPTIONS = [
    { label: t("refresh.manual"), value: 0 },
    { label: t("refresh.30s"), value: 30 },
    { label: t("refresh.1m"), value: 60 },
    { label: t("refresh.5m"), value: 300 },
  ];

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/config")
      .then((r) => r.json())
      .then((configData) => {
        if (configData.error) setError(configData.error);
        else { setData(configData); setError(null); }
        setLastUpdated(new Date().toLocaleTimeString("zh-CN"));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (refreshInterval > 0) {
      timerRef.current = setInterval(fetchData, refreshInterval * 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [refreshInterval, fetchData]);

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-400">{t("common.loadError")}: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">{t("common.loading")}</p>
      </div>
    );
  }

  // Compute totals from config data
  const totalTokens = data.agents.reduce((sum, a) => sum + (a.session?.totalTokens || 0), 0);
  const totalSessions = data.agents.reduce((sum, a) => sum + (a.session?.sessionCount || 0), 0);

  return (
    <div className="p-3 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            🤖 {t("home.pageTitle")}
          </h1>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">
            {data.agents.length} {t("home.agentCount")} · {t("home.defaultModel")}: {data.defaults.model}
          </p>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          <GatewayStatus />
          <span className="text-xs text-[var(--text-muted)]">
            📊 Token: {formatTokens(totalTokens)} · 💬 {totalSessions} sessions
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--text)] cursor-pointer hover:border-[var(--accent)] transition"
          >
            {REFRESH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value === 0 ? `🔄 ${opt.label}` : `⏱️ ${opt.label}`}
              </option>
            ))}
          </select>
          {refreshInterval === 0 && (
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition disabled:opacity-50"
            >
              {loading ? "⏳" : "🔄"}
            </button>
          )}
          {lastUpdated && (
            <span className="text-xs text-[var(--text-muted)]">
              {t("home.updatedAt")} {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} t={t} />
        ))}
      </div>

      {/* Group chats */}
      {data.groupChats && data.groupChats.length > 0 && (
        <div className="mt-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-3">
            {t("home.groupTopology")}
          </h2>
          <div className="space-y-3">
            {data.groupChats.map((group, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                <span className="text-lg">{group.channel === "feishu" ? "📱" : "🎮"}</span>
                <div className="flex-1">
                  <div className="text-xs text-[var(--text-muted)] mb-1">
                    {group.channel} · {group.groupId.split(":")[1]}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.agents.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--card)] border border-[var(--border)]">
                        {a.emoji} {a.name}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{group.agents.length} {t("home.bots")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback models */}
      {data.defaults.fallbacks.length > 0 && (
        <div className="mt-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-2">
            {t("home.fallbackModels")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.defaults.fallbacks.map((f, i) => (
              <ModelBadge key={i} model={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
