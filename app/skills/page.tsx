"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
}

interface Skill {
  name: string;
  description: string;
  emoji: string;
  callCount: number;
}

interface AgentSkills {
  agentId: string;
  agentName: string;
  skills: Skill[];
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

export default function SkillsPage() {
  const { t } = useI18n();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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
      setSkills([]);
      return;
    }

    setSelectedAgent(agentId);
    setLoadingSkills(true);
    try {
      const res = await fetchWithRetry(`/api/skills/${agentId}`);
      const data: AgentSkills = await res.json();
      setSkills(data.skills || []);
    } catch (err: any) {
      setSkills([]);
    } finally {
      setLoadingSkills(false);
    }
  };

  const toggleExpand = (skillName: string) => {
    setExpandedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skillName)) {
        next.delete(skillName);
      } else {
        next.add(skillName);
      }
      return next;
    });
  };

  const handleDelete = (skillName: string) => {
    setDeleteTarget(skillName);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !selectedAgent) return;

    try {
      const res = await fetch(`/api/skills/${selectedAgent}/${deleteTarget}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("删除失败");

      // 刷新技能列表
      const refreshRes = await fetchWithRetry(`/api/skills/${selectedAgent}`);
      const data: AgentSkills = await refreshRes.json();
      setSkills(data.skills || []);
      setDeleteTarget(null);
    } catch (e: any) {
      alert("删除失败：" + e.message);
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
          📦 {t("nav.skills")}
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          选择 Agent 查看已集成的技能
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

      {/* 技能列表 */}
      {selectedAgent && (
        <div className="mt-6">
          <h2 className="text-xl font-bold text-[var(--text)] mb-4">
            🤖 {agents.find((a) => a.id === selectedAgent)?.name} 的技能
          </h2>
          {loadingSkills ? (
            <div className="text-[var(--text-muted)]">{t("common.loading")}</div>
          ) : skills.length === 0 ? (
            <div className="text-[var(--text-muted)]">{t("common.noData")}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {skills.map((skill) => {
                const isExpanded = expandedSkills.has(skill.name);
                const shouldCollapse = skill.description.length > 100;

                return (
                  <div
                    key={skill.name}
                    className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] min-h-[180px] flex flex-col"
                  >
                    {/* 顶部：emoji + 名称 */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{skill.emoji || "📦"}</span>
                      <h4 className="text-base font-semibold text-[var(--text)]">
                        {skill.name}
                      </h4>
                    </div>

                    {/* 描述区域：固定高度，可折叠 */}
                    <div
                      className={`text-sm text-[var(--text-muted)] mb-3 ${
                        isExpanded ? "" : "h-[60px] overflow-hidden"
                      }`}
                    >
                      <p className={isExpanded ? "" : "line-clamp-3"}>
                        {skill.description}
                      </p>
                    </div>

                    {/* 展开/收起按钮 */}
                    {shouldCollapse && (
                      <button
                        onClick={() => toggleExpand(skill.name)}
                        className="text-xs text-[var(--accent)] hover:underline mb-2 text-left"
                      >
                        {isExpanded ? "收起" : "展开"}
                      </button>
                    )}

                    {/* 底部：调用次数 + 删除按钮 */}
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)]">
                        调用次数: {skill.callCount > 0 ? skill.callCount : "N/A"}
                      </span>
                      <button
                        onClick={() => handleDelete(skill.name)}
                        className="px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition"
                      >
                        🗑️ 删除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 删除确认对话框 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 max-w-md">
            <h3 className="text-lg font-bold text-red-400 mb-2">⚠️ 危险操作</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              确定要删除技能{" "}
              <strong className="text-[var(--text)]">{deleteTarget}</strong> 吗？
              此操作将：
            </p>
            <ul className="text-xs text-[var(--text-muted)] mb-4 space-y-1">
              <li>• 删除技能文件夹（skills/{deleteTarget}/）</li>
              <li>• 从核心文件中移除相关引用</li>
              <li>• 此操作不可撤销</li>
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600 transition"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
