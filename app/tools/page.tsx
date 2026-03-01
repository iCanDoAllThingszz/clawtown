"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
}

interface Tool {
  name: string;
  description: string;
  callCount: number;
}

interface AgentTools {
  agentId: string;
  agentName: string;
  tools: Tool[];
}

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
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("Unexpected error in fetchWithRetry");
}

export default function ToolsPage() {
  const { t } = useI18n();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTools, setLoadingTools] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWithRetry("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setAgents(data.agents || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleAgentClick = async (agentId: string) => {
    if (selectedAgent === agentId) {
      setSelectedAgent(null);
      setTools([]);
      return;
    }

    setSelectedAgent(agentId);
    setLoadingTools(true);
    try {
      const res = await fetchWithRetry(`/api/tools/${agentId}`);
      const data: AgentTools = await res.json();
      setTools(data.tools || []);
    } catch (err: any) {
      setTools([]);
    } finally {
      setLoadingTools(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-[var(--text-muted)]">{t("common.loading")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-400">{t("common.loadError")}: {error}</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)] mb-2">
          🛠️ {t("nav.tools")}
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          选择 Agent 查看已集成的工具
        </p>
      </div>

      {/* Agent 卡片列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => handleAgentClick(agent.id)}
            className={`p-4 rounded-lg border transition-all text-left ${
              selectedAgent === agent.id
                ? "bg-[var(--accent)]/15 border-[var(--accent)] shadow-lg"
                : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)]/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{agent.emoji}</span>
              <div>
                <div className="font-medium text-[var(--text)]">{agent.name}</div>
                <div className="text-xs text-[var(--text-muted)]">{agent.id}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* 工具列表 */}
      {selectedAgent && (
        <div className="mt-6">
          <h2 className="text-xl font-bold text-[var(--text)] mb-4">
            🤖 {agents.find((a) => a.id === selectedAgent)?.name} 的工具
          </h2>
          {loadingTools ? (
            <div className="text-[var(--text-muted)]">{t("common.loading")}</div>
          ) : tools.length === 0 ? (
            <div className="text-[var(--text-muted)]">{t("common.noData")}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]"
                >
                  <div className="font-medium text-[var(--text)] mb-1">
                    {tool.name}
                  </div>
                  <div className="text-sm text-[var(--text-muted)] mb-2">
                    {tool.description}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    调用次数: {tool.callCount > 0 ? tool.callCount : "N/A"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
