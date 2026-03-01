"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

/* ── fetch with retry and timeout ── */
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = 3,
  timeout = 10000
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1))); // 指数退避
    }
  }
  throw new Error("Unexpected error in fetchWithRetry");
}

interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
  model: string;
  session?: {
    lastActive: number | null;
    totalTokens: number;
    contextTokens: number;
    sessionCount: number;
  };
}

interface ConfigData {
  agents: AgentInfo[];
  userName: string | null;
  error?: string;
}

interface Session {
  key: string;
  type: string;
  target: string;
  sessionId: string | null;
  updatedAt: number;
  totalTokens: number;
  contextTokens: number;
  systemSent: boolean;
}

interface SessionMessage {
  role: string;
  text: string;
  timestamp: string;
  type: string;
  model?: string;
  tokens?: { input?: number; output?: number };
}

interface SessionDetail {
  meta: {
    id?: string;
    createdAt?: string;
    currentModel?: string;
    provider?: string;
  };
  messageCount: number;
  messages: SessionMessage[];
}

const TYPE_EMOJI_COLOR: Record<string, { emoji: string; color: string }> = {
  main: { emoji: "🏠", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  "feishu-dm": { emoji: "📱", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  "feishu-group": { emoji: "👥", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  "discord-dm": { emoji: "🎮", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  "discord-channel": { emoji: "📢", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  "telegram-dm": { emoji: "✈️", color: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  "telegram-group": { emoji: "👥", color: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  "whatsapp-dm": { emoji: "💬", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  "whatsapp-group": { emoji: "👥", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  cron: { emoji: "⏰", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  subagent: { emoji: "🤖", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
  unknown: { emoji: "❓", color: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
};

function formatTime(ts: number | string): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("zh-CN");
}

function useTimeAgo() {
  const { t } = useI18n();
  return (ts: number) => {
    if (!ts) return "-";
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("common.justNow");
    if (mins < 60) return `${mins} ${t("common.minutesAgo")}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ${t("common.hoursAgo")}`;
    const days = Math.floor(hours / 24);
    return `${days} ${t("common.daysAgo")}`;
  };
}

/* ── Agent picker ── */
function AgentPicker() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();
  const formatTimeAgo = useTimeAgo();

  const fetchAgents = useCallback(() => {
    setLoading(true);
    fetchWithRetry("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setAgents(data.agents || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-[var(--text-muted)]">{t("common.loading")}</p></div>;
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-red-400">{t("common.loadError")}: {error}</p>
      <button onClick={fetchAgents} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm hover:opacity-90 transition">
        {t("common.retry") || "重试"}
      </button>
    </div>
  );

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">💬 {t("nav.sessions")}</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">{t("sessions.selectAgent")}</p>
        </div>
        <Link href="/" className="px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition">
          {t("common.backHome")}
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <Link key={agent.id} href={`/sessions?agent=${agent.id}`} className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] transition cursor-pointer block">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{agent.emoji}</span>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">{agent.name}</h3>
                {agent.name !== agent.id && <span className="text-xs text-[var(--text-muted)]">{agent.id}</span>}
              </div>
            </div>
            {agent.session && (
              <div className="space-y-1 text-xs text-[var(--text-muted)]">
                <div className="flex justify-between"><span>{t("agent.sessionCount")}</span><span className="text-[var(--text)]">{agent.session.sessionCount}</span></div>
                <div className="flex justify-between"><span>{t("agent.tokenUsage")}</span><span className="text-[var(--text)]">{(agent.session.totalTokens / 1000).toFixed(1)}k</span></div>
                {agent.session.lastActive && <div className="flex justify-between"><span>{t("agent.lastActive")}</span><span className="text-[var(--text)]">{formatTimeAgo(agent.session.lastActive)}</span></div>}
              </div>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}

/* ── Session Detail Panel ── */
function SessionDetailPanel({ agentId, sessionId, sessionType, userName, agentName, onClose }: { agentId: string; sessionId: string; sessionType?: string; userName: string; agentName: string; onClose: () => void }) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(() => {
    setLoading(true);
    fetchWithRetry(`/api/sessions/${agentId}/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setDetail(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [agentId, sessionId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (loading) return <div className="p-6 text-center text-[var(--text-muted)]">加载会话详情...</div>;
  if (error) return (
    <div className="p-6 text-center">
      <p className="text-red-400 mb-3">加载失败: {error}</p>
      <button onClick={fetchDetail} className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs hover:opacity-90 transition">
        重试
      </button>
    </div>
  );
  if (!detail) return null;

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg)]/50">
      {/* Meta info */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--text)]">会话详情</h3>
          <button onClick={onClose} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] px-2 py-1 rounded hover:bg-[var(--card)]">
            收起 ▲
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-[var(--card)] rounded-lg p-2.5 border border-[var(--border)]">
            <div className="text-[var(--text-muted)] mb-1">Session ID</div>
            <div className="text-[var(--text)] font-mono text-[10px] break-all">{detail.meta.id || sessionId}</div>
          </div>
          <div className="bg-[var(--card)] rounded-lg p-2.5 border border-[var(--border)]">
            <div className="text-[var(--text-muted)] mb-1">创建时间</div>
            <div className="text-[var(--text)]">{detail.meta.createdAt ? formatTime(detail.meta.createdAt) : "-"}</div>
          </div>
          <div className="bg-[var(--card)] rounded-lg p-2.5 border border-[var(--border)]">
            <div className="text-[var(--text-muted)] mb-1">模型</div>
            <div className="text-[var(--text)]">{detail.meta.currentModel || "-"}</div>
          </div>
          <div className="bg-[var(--card)] rounded-lg p-2.5 border border-[var(--border)]">
            <div className="text-[var(--text-muted)] mb-1">消息总数</div>
            <div className="text-[var(--text)]">{detail.messageCount}</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        <h4 className="text-xs font-semibold text-[var(--text-muted)] mb-3">
          最近对话 (显示最后 {detail.messages.length} 条)
        </h4>
        {detail.messages.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center py-4">暂无对话记录</p>
        ) : (
          <div className="space-y-2">
            {(() => {
              // Find the first user message index for subagent sessions
              const firstUserMsgIndex = detail.messages.findIndex(m => m.role === "user");
              return detail.messages.map((msg, i) => {
                const isFirstUserMsg = sessionType === "subagent" && i === firstUserMsgIndex;
                // Check if this is an announce message (subagent task announcement)
                const isAnnounceMsg = (msgText: string) => {
                  // Match patterns like "[Sun 2026-03-01 05:33 UTC]" or "## 任务："
                  return (msgText.startsWith("[") && msgText.includes("UTC]")) || msgText.includes("## 任务：");
                };
                const getSubagentUserLabel = (msgText: string) => {
                  if (isAnnounceMsg(msgText)) return "⚙️ 系统";
                  if (isFirstUserMsg) return "📋 任务";
                  if (msgText.includes("Stats: runtime") || msgText.includes("Findings:")) return "🤖 子代理";
                  return `👤 ${userName}`;
                };
                const label = msg.role === "user"
                  ? (sessionType === "subagent" ? getSubagentUserLabel(msg.text) : `👤 ${userName}`)
                  : msg.role === "assistant"
                    ? (sessionType === "subagent" ? "🤖 子代理" : `🤖 ${agentName}`)
                    : "⚙️ 系统";
                return (
              <div key={i} className={`rounded-lg p-3 text-xs ${
                msg.role === "user"
                  ? "bg-[var(--accent)]/10 border border-[var(--accent)]/20 ml-8"
                  : msg.role === "assistant"
                    ? "bg-[var(--card)] border border-[var(--border)] mr-8"
                    : "bg-yellow-500/10 border border-yellow-500/20 mx-4"
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`font-medium ${
                    msg.role === "user" ? "text-[var(--accent)]" : msg.role === "assistant" ? "text-[var(--text)]" : "text-yellow-400"
                  }`}>
                    {label}
                    {msg.model && <span className="ml-2 text-[var(--text-muted)] font-normal">({msg.model})</span>}
                  </span>
                  <span className="text-[var(--text-muted)] text-[10px]">{formatTime(msg.timestamp)}</span>
                </div>
                <p className="text-[var(--text)] whitespace-pre-wrap break-words leading-relaxed">
                  {msg.text.length > 300 ? msg.text.slice(0, 300) + "..." : msg.text}
                </p>
                {msg.tokens && (
                  <div className="mt-1.5 text-[10px] text-[var(--text-muted)]">
                    Token: ↑{msg.tokens.input?.toLocaleString()} ↓{msg.tokens.output?.toLocaleString()}
                  </div>
                )}
              </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Session list ── */
function SessionList({ agentId }: { agentId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [compacting, setCompacting] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("用户");
  const [agentName, setAgentName] = useState<string>("助手");
  const { t } = useI18n();
  const formatTimeAgo = useTimeAgo();

  function getTypeLabel(type: string): { label: string; emoji: string; color: string } {
    const info = TYPE_EMOJI_COLOR[type] || TYPE_EMOJI_COLOR.unknown;
    const labelKey = `sessions.type.${type}` as const;
    const label = t(TYPE_EMOJI_COLOR[type] ? labelKey : "sessions.type.unknown");
    return { ...info, label };
  }

  // Fetch config for userName and agentName
  const fetchConfig = useCallback(() => {
    fetchWithRetry("/api/config")
      .then((r) => r.json())
      .then((data: ConfigData) => {
        if (!data.error) {
          if (data.userName) setUserName(data.userName);
          const agent = data.agents?.find((a) => a.id === agentId);
          if (agent) setAgentName(agent.name);
        }
      })
      .catch(() => {});
  }, [agentId]);

  const fetchSessions = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchWithRetry(`/api/sessions/${agentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          // Only filter cron :run: sessions to avoid duplicate cards, not subagent sessions
          const filtered = (data.sessions || []).filter((s: Session) =>
            !(s.type === "cron" && s.key.includes(":run:"))
          );
          setSessions(filtered);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [agentId]);

  useEffect(() => { fetchSessions(); fetchConfig(); }, [fetchSessions, fetchConfig]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-[var(--text-muted)]">{t("common.loading")}</p></div>;
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-red-400">{t("common.loadError")}: {error}</p>
      <button onClick={fetchSessions} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm hover:opacity-90 transition">
        {t("common.retry") || "重试"}
      </button>
    </div>
  );

  // Get unique types for filter
  const types = Array.from(new Set(sessions.map((s) => s.type)));
  const filtered = filter === "all" ? sessions : sessions.filter((s) => s.type === filter);
  const totalTokens = filtered.reduce((sum, s) => sum + s.totalTokens, 0);

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">📋 {agentId} {t("sessions.title")}</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {filtered.length} {t("sessions.sessionCount")} · {t("sessions.totalToken")}: {(totalTokens / 1000).toFixed(1)}k
          </p>
        </div>
        <Link href="/sessions" className="px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition">
          {t("sessions.backToAgents")}
        </Link>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
            filter === "all" ? "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30" : "bg-[var(--card)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]/50"
          }`}
        >
          全部 ({sessions.length})
        </button>
        {types.map((type) => {
          const info = TYPE_EMOJI_COLOR[type] || TYPE_EMOJI_COLOR.unknown;
          const count = sessions.filter((s) => s.type === type).length;
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                filter === type ? `${info.color}` : "bg-[var(--card)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]/50"
              }`}
            >
              {info.emoji} {type} ({count})
            </button>
          );
        })}
      </div>

      {/* Session cards */}
      <div className="space-y-3">
        {filtered.map((s) => {
          const typeInfo = getTypeLabel(s.type);
          const isExpanded = expandedSession === s.sessionId;
          return (
            <div key={s.key} className={`rounded-xl border bg-[var(--card)] transition overflow-hidden ${isExpanded ? "border-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--accent)]/50"}`}>
              <div
                onClick={() => setExpandedSession(isExpanded ? null : s.sessionId)}
                className="p-4 cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${typeInfo.color}`}>
                      {typeInfo.emoji} {typeInfo.label}
                    </span>
                    {s.target && (
                      <code className="text-xs text-[var(--text-muted)] bg-[var(--bg)] px-2 py-0.5 rounded">{s.target}</code>
                    )}
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {isExpanded ? "▲ 收起" : "▼ 展开详情"}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">{formatTimeAgo(s.updatedAt)}</span>
                </div>
                {/* Context bar */}
                {s.contextTokens > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                      <span>{t("sessions.context")}</span>
                      <div className="flex items-center gap-2">
                        <span>
                          {(s.totalTokens / 1000).toFixed(1)}k / {(s.contextTokens / 1000).toFixed(0)}k
                          {" "}({(s.totalTokens / s.contextTokens * 100).toFixed(1)}%)
                        </span>
                        {s.totalTokens / s.contextTokens > 0.5 && s.sessionId && (
                          (s.type === "subagent" || s.type === "cron") && s.totalTokens / s.contextTokens > 0.95 ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-gray-500/20 text-gray-400 border-gray-500/30">
                              📦 已归档
                            </span>
                          ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (compacting) return;
                              setCompacting(s.sessionId);
                              fetchWithRetry(`/api/sessions/${agentId}/${s.sessionId}/compact`, { method: "POST" })
                                .then((r) => r.json())
                                .then((d) => {
                                  if (d.ok) {
                                    // Async compaction — refresh after delay
                                    setTimeout(fetchSessions, 15000);
                                    setTimeout(() => setCompacting(null), 3000);
                                  } else {
                                    alert("压缩失败: " + (d.error || "未知错误"));
                                    setCompacting(null);
                                  }
                                })
                                .catch(() => { alert("请求失败"); setCompacting(null); });
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition ${
                              compacting === s.sessionId
                                ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30 cursor-wait"
                                : "bg-orange-500/15 text-orange-300 border-orange-500/30 hover:bg-orange-500/25 cursor-pointer"
                            }`}
                            title="压缩上下文，释放Token空间"
                          >
                            {compacting === s.sessionId ? "⏳ 已触发" : "🧹 压缩"}
                          </button>
                          )
                        )}
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[var(--bg)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          s.totalTokens / s.contextTokens > 0.9 ? "bg-red-500"
                            : s.totalTokens / s.contextTokens > 0.7 ? "bg-yellow-500" : "bg-green-500"
                        }`}
                        style={{ width: `${Math.min(100, s.totalTokens / s.contextTokens * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span className="font-mono text-[10px] opacity-60">{s.key}</span>
                  <span>{formatTime(s.updatedAt)}</span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && s.sessionId && (
                <SessionDetailPanel
                  agentId={agentId}
                  sessionId={s.sessionId}
                  sessionType={s.type}
                  userName={userName}
                  agentName={agentName}
                  onClose={() => setExpandedSession(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

/* ── Page entry ── */
function SessionsPageInner() {
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agent") || "";
  if (!agentId) return <AgentPicker />;
  return <SessionList agentId={agentId} />;
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-[var(--text-muted)]">Loading...</p></div>}>
      <SessionsPageInner />
    </Suspense>
  );
}
