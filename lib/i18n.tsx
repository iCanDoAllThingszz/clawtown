"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

export type Locale = "zh" | "en";

const translations: Record<Locale, Record<string, string>> = {
  zh: {
    // layout
    "site.title": "ClawTown — OpenClaw Dashboard",
    "site.desc": "OpenClaw Agent Dashboard + 像素办公室",

    // nav sidebar
    "nav.overview": "总览",
    "nav.agents": "Agent 总览",
    "nav.sessions": "会话历史",
    "nav.tools": "工具列表",
    "nav.skills": "技能列表",
    "nav.pixelOffice": "像素办公室",

    // common
    "common.loading": "加载中...",
    "common.loadError": "加载失败",
    "common.backHome": "← 返回首页",
    "common.noData": "暂无数据",
    "common.justNow": "刚刚",
    "common.minutesAgo": "分钟前",
    "common.hoursAgo": "小时前",
    "common.daysAgo": "天前",

    // home page
    "home.agentCount": "个 Agent",
    "home.pageTitle": "Agent 总览",
    "home.defaultModel": "默认模型",
    "home.updatedAt": "更新于",
    "home.groupTopology": "💬 群聊拓扑",
    "home.fallbackModels": "🔄 Fallback 模型",
    "home.bots": "个机器人",

    // agent card
    "agent.model": "模型",
    "agent.platform": "平台",
    "agent.sessionCount": "会话数",
    "agent.messageCount": "消息数",
    "agent.tokenUsage": "Token 用量",
    "agent.totalTokenTip": "总 Token 使用量",
    "agent.lastActive": "最近活跃",
    "agent.openChat": "点击打开聊天页面",

    // agent status
    "agent.status.working": "工作中",
    "agent.status.online": "在线",
    "agent.status.idle": "空闲",
    "agent.status.offline": "离线",

    // platform
    "platform.feishu": "📱 飞书",
    "platform.discord": "🎮 Discord",
    "platform.telegram": "✈️ Telegram",
    "platform.whatsapp": "💬 WhatsApp",

    // refresh options
    "refresh.manual": "手动刷新",
    "refresh.30s": "30 秒",
    "refresh.1m": "1 分钟",
    "refresh.5m": "5 分钟",

    // sessions page
    "sessions.title": "的会话列表",
    "sessions.sessionCount": "个会话",
    "sessions.totalToken": "总 Token",
    "sessions.type.main": "主会话",
    "sessions.type.feishu-dm": "飞书私聊",
    "sessions.type.feishu-group": "飞书群聊",
    "sessions.type.discord-dm": "Discord 私聊",
    "sessions.type.discord-channel": "Discord 频道",
    "sessions.type.telegram-dm": "Telegram 私聊",
    "sessions.type.telegram-group": "Telegram 群聊",
    "sessions.type.whatsapp-dm": "WhatsApp 私聊",
    "sessions.type.whatsapp-group": "WhatsApp 群聊",
    "sessions.type.cron": "定时任务",
    "sessions.type.subagent": "子代理",
    "sessions.type.unknown": "未知",
    "sessions.context": "上下文",
    "sessions.selectAgent": "选择一个 Agent 查看其会话列表",
    "sessions.backToAgents": "← 返回 Agent 列表",

    // gateway status
    "gateway.healthy": "Gateway 运行正常",
    "gateway.unhealthy": "Gateway 异常",
    "gateway.fetchError": "无法检查 Gateway 状态",

    // pixel office
    "pixelOffice.title": "OpenClaw Agents办公室",
    "pixelOffice.editMode": "编辑布局",
    "pixelOffice.exitEdit": "退出编辑",
    "pixelOffice.save": "保存",
    "pixelOffice.reset": "重置",
    "pixelOffice.undo": "撤销",
    "pixelOffice.redo": "重做",
    "pixelOffice.sound": "音效",
    "pixelOffice.resetView": "重置视图",
    "pixelOffice.state.working": "工作中",
    "pixelOffice.state.idle": "摸鱼中",
    "pixelOffice.state.offline": "下班了",
    "pixelOffice.state.waiting": "等待中",
    "pixelOffice.broadcast.online": "上班了",
    "pixelOffice.broadcast.offline": "下班了",
    "pixelOffice.heatmap.title": "Agent 工作时间热力图",
    "pixelOffice.heatmap.messages": "条消息",
    "pixelOffice.idleRank.title": "摸鱼排行榜",
    "pixelOffice.idleRank.online": "在线",
    "pixelOffice.idleRank.active": "活跃",
    "pixelOffice.idleRank.idle": "摸鱼",
  },
  en: {
    // layout
    "site.title": "ClawTown — OpenClaw Dashboard",
    "site.desc": "OpenClaw Agent Dashboard + Pixel Office",

    // nav sidebar
    "nav.overview": "Overview",
    "nav.agents": "Agent Overview",
    "nav.sessions": "Sessions",
    "nav.tools": "Tools",
    "nav.skills": "Skills",
    "nav.pixelOffice": "Pixel Office",

    // common
    "common.loading": "Loading...",
    "common.loadError": "Failed to load",
    "common.backHome": "← Back to Home",
    "common.noData": "No data",
    "common.justNow": "just now",
    "common.minutesAgo": "min ago",
    "common.hoursAgo": "hours ago",
    "common.daysAgo": "days ago",

    // home page
    "home.agentCount": "agents",
    "home.pageTitle": "Agent Overview",
    "home.defaultModel": "Default model",
    "home.updatedAt": "Updated at",
    "home.groupTopology": "💬 Group Chat Topology",
    "home.fallbackModels": "🔄 Fallback Models",
    "home.bots": "bots",

    // agent card
    "agent.model": "Model",
    "agent.platform": "Platform",
    "agent.sessionCount": "Sessions",
    "agent.messageCount": "Messages",
    "agent.tokenUsage": "Token Usage",
    "agent.totalTokenTip": "Total token usage",
    "agent.lastActive": "Last Active",
    "agent.openChat": "Click to open chat",

    // agent status
    "agent.status.working": "Working",
    "agent.status.online": "Online",
    "agent.status.idle": "Idle",
    "agent.status.offline": "Offline",

    // platform
    "platform.feishu": "📱 Feishu",
    "platform.discord": "🎮 Discord",
    "platform.telegram": "✈️ Telegram",
    "platform.whatsapp": "💬 WhatsApp",

    // refresh options
    "refresh.manual": "Manual Refresh",
    "refresh.30s": "30s",
    "refresh.1m": "1 min",
    "refresh.5m": "5 min",

    // sessions page
    "sessions.title": "Sessions",
    "sessions.sessionCount": "sessions",
    "sessions.totalToken": "Total Token",
    "sessions.type.main": "Main",
    "sessions.type.feishu-dm": "Feishu DM",
    "sessions.type.feishu-group": "Feishu Group",
    "sessions.type.discord-dm": "Discord DM",
    "sessions.type.discord-channel": "Discord Channel",
    "sessions.type.telegram-dm": "Telegram DM",
    "sessions.type.telegram-group": "Telegram Group",
    "sessions.type.whatsapp-dm": "WhatsApp DM",
    "sessions.type.whatsapp-group": "WhatsApp Group",
    "sessions.type.cron": "Cron Job",
    "sessions.type.subagent": "Sub-agent",
    "sessions.type.unknown": "Unknown",
    "sessions.context": "Context",
    "sessions.selectAgent": "Select an agent to view its sessions",
    "sessions.backToAgents": "← Back to agents",

    // gateway status
    "gateway.healthy": "Gateway is running",
    "gateway.unhealthy": "Gateway is down",
    "gateway.fetchError": "Cannot check Gateway status",

    // pixel office
    "pixelOffice.title": "OpenClaw Agents Office",
    "pixelOffice.editMode": "Edit Layout",
    "pixelOffice.exitEdit": "Exit Edit",
    "pixelOffice.save": "Save",
    "pixelOffice.reset": "Reset",
    "pixelOffice.undo": "Undo",
    "pixelOffice.redo": "Redo",
    "pixelOffice.sound": "Sound",
    "pixelOffice.resetView": "Reset View",
    "pixelOffice.state.working": "Working",
    "pixelOffice.state.idle": "Idle",
    "pixelOffice.state.offline": "Offline",
    "pixelOffice.state.waiting": "Waiting",
    "pixelOffice.broadcast.online": "is online",
    "pixelOffice.broadcast.offline": "is offline",
    "pixelOffice.heatmap.title": "Agent Activity Heatmap",
    "pixelOffice.heatmap.messages": "messages",
    "pixelOffice.idleRank.title": "Slacking Leaderboard",
    "pixelOffice.idleRank.online": "Online",
    "pixelOffice.idleRank.active": "Active",
    "pixelOffice.idleRank.idle": "Slacking",
  },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "zh",
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale;
    if (saved && saved !== "zh") {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem("locale", l);
    }
  }, []);

  const t = useCallback(
    (key: string) => translations[locale]?.[key] ?? translations.zh[key] ?? key,
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-medium hover:border-[var(--accent)] transition cursor-pointer text-[var(--text)]"
    >
      <option value="zh">中文</option>
      <option value="en">English</option>
    </select>
  );
}
