# ClawTown 优化任务

## 需求概述
1. 删除工具列表功能
2. 优化技能卡片布局（固定大小、描述折叠）
3. 技能卡片新增删除功能（危险操作，需二次确认）
4. 会话历史消息展示优化（折叠而非截断）

---

## 1. 删除工具列表功能

### 需要删除的文件
- `app/tools/page.tsx`
- `app/api/tools/[agentId]/route.ts`

### 需要修改的文件
- `app/layout.tsx` 或侧边栏组件 — 删除"🛠️ 工具列表"导航项
- `lib/i18n.ts` — 删除工具列表相关的翻译

---

## 2. 技能卡片布局优化

### 当前问题
- 技能描述太长，卡片高度不一致
- 长描述直接显示，影响布局

### 优化方案

**卡片固定高度：**
- 卡片最小高度：`min-h-[180px]`
- 描述区域固定高度：`h-[60px]`（约3行）
- 超出部分用省略号 + "展开"按钮

**折叠/展开逻辑：**
```tsx
const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());

const toggleExpand = (skillName: string) => {
  setExpandedSkills(prev => {
    const next = new Set(prev);
    if (next.has(skillName)) {
      next.delete(skillName);
    } else {
      next.add(skillName);
    }
    return next;
  });
};

const isExpanded = expandedSkills.has(skill.name);
```

**卡片布局：**
```tsx
<div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] min-h-[180px] flex flex-col">
  {/* 顶部：emoji + 名称 */}
  <div className="flex items-center gap-2 mb-2">
    <span className="text-2xl">{skill.emoji || "📦"}</span>
    <h4 className="text-base font-semibold text-[var(--text)]">{skill.name}</h4>
  </div>
  
  {/* 描述区域：固定高度，可折叠 */}
  <div className={`text-sm text-[var(--text-muted)] mb-3 ${isExpanded ? "" : "h-[60px] overflow-hidden"}`}>
    <p className={isExpanded ? "" : "line-clamp-3"}>
      {skill.description}
    </p>
  </div>
  
  {/* 展开/收起按钮（仅当描述超过3行时显示） */}
  {skill.description.length > 100 && (
    <button 
      onClick={() => toggleExpand(skill.name)}
      className="text-xs text-[var(--accent)] hover:underline mb-2"
    >
      {isExpanded ? "收起" : "展开"}
    </button>
  )}
  
  {/* 底部：调用次数 + 删除按钮 */}
  <div className="mt-auto flex items-center justify-between">
    <span className="text-xs text-[var(--text-muted)]">
      调用次数: {skill.callCount || "N/A"}
    </span>
    <button 
      onClick={() => handleDelete(skill.name)}
      className="px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition"
    >
      🗑️ 删除
    </button>
  </div>
</div>
```

**CSS辅助类（如果需要）：**
```css
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

---

## 3. 技能删除功能

### 删除流程
1. 用户点击"删除"按钮
2. 弹出二次确认对话框（危险操作警告）
3. 用户确认后，调用删除API
4. 删除成功后刷新技能列表

### 二次确认对话框
```tsx
const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

const handleDelete = (skillName: string) => {
  setDeleteTarget(skillName);
};

const confirmDelete = async () => {
  if (!deleteTarget) return;
  
  try {
    const res = await fetch(`/api/skills/${agentId}/${deleteTarget}`, {
      method: "DELETE",
    });
    
    if (!res.ok) throw new Error("删除失败");
    
    // 刷新技能列表
    fetchSkills();
    setDeleteTarget(null);
  } catch (e) {
    alert("删除失败：" + e.message);
  }
};

// 对话框UI
{deleteTarget && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 max-w-md">
      <h3 className="text-lg font-bold text-red-400 mb-2">⚠️ 危险操作</h3>
      <p className="text-sm text-[var(--text-muted)] mb-4">
        确定要删除技能 <strong className="text-[var(--text)]">{deleteTarget}</strong> 吗？
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
```

### 删除API：`/api/skills/[agentId]/[skillName]/route.ts`

**DELETE方法实现：**
```typescript
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
    
    // 3. 从核心文件中移除引用（cognition.md, TOOLS.md等）
    const filesToCheck = [
      path.join(WORKSPACE, "cognition.md"),
      path.join(WORKSPACE, "TOOLS.md"),
      path.join(WORKSPACE, "AGENTS.md"),
    ];
    
    for (const file of filesToCheck) {
      if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, "utf-8");
        
        // 移除包含技能名称的行（简单实现，可能需要更精确的匹配）
        const lines = content.split("\n");
        const filtered = lines.filter(line => {
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
```

**注意事项：**
- 删除是递归删除整个文件夹（`fs.rmSync(path, { recursive: true })`）
- 需要同步清理核心文件中的引用（cognition.md, TOOLS.md等）
- 删除操作不可撤销，必须二次确认

---

## 4. 会话历史消息展示优化

### 当前问题
- 消息超过300字符直接截断（`msg.text.slice(0, 300) + "..."`）
- 用户无法查看完整消息

### 优化方案

**折叠/展开逻辑：**
```tsx
const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());

const toggleMessageExpand = (index: number) => {
  setExpandedMessages(prev => {
    const next = new Set(prev);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    return next;
  });
};

const isMessageExpanded = (index: number) => expandedMessages.has(index);
```

**消息渲染：**
```tsx
{detail.messages.map((msg, i) => {
  const isExpanded = isMessageExpanded(i);
  const shouldCollapse = msg.text.length > 300;
  const displayText = shouldCollapse && !isExpanded 
    ? msg.text.slice(0, 300) 
    : msg.text;
  
  return (
    <div key={i} className={/* ... */}>
      {/* 消息头部 */}
      <div className="flex items-center justify-between mb-1.5">
        {/* ... */}
      </div>
      
      {/* 消息内容 */}
      <div className="text-[var(--text)] leading-relaxed">
        <p className="whitespace-pre-wrap break-words">
          {displayText}
        </p>
        
        {/* 展开/收起按钮 */}
        {shouldCollapse && (
          <button
            onClick={() => toggleMessageExpand(i)}
            className="text-xs text-[var(--accent)] hover:underline mt-1"
          >
            {isExpanded ? "收起" : "展开完整消息"}
          </button>
        )}
      </div>
      
      {/* Token信息 */}
      {msg.tokens && (
        <div className="mt-1.5 text-[10px] text-[var(--text-muted)]">
          Token: ↑{msg.tokens.input?.toLocaleString()} ↓{msg.tokens.output?.toLocaleString()}
        </div>
      )}
    </div>
  );
})}
```

**布局注意事项：**
- 展开后的消息不要撑破容器，使用 `break-words` 和 `whitespace-pre-wrap`
- 消息面板最大高度保持 `max-h-[400px]`，超出部分滚动
- 展开按钮样式与技能卡片保持一致

---

## 5. 验证清单

- [ ] 侧边栏删除"工具列表"导航项
- [ ] 删除 `/tools` 页面和 `/api/tools/[agentId]` API
- [ ] 技能卡片固定高度，描述区域可折叠
- [ ] 技能卡片新增删除按钮
- [ ] 删除技能时弹出二次确认对话框
- [ ] 删除API正确删除技能文件夹和核心文件引用
- [ ] 会话历史消息超过300字符时折叠显示
- [ ] 用户可以点击"展开"查看完整消息
- [ ] 展开后消息布局正常，不撑破容器
- [ ] build无错误
- [ ] commit并push

---

## 6. 文件清单

**需要修改的文件：**
- `app/layout.tsx` — 删除工具列表导航
- `app/skills/page.tsx` — 技能卡片布局优化 + 删除功能
- `app/sessions/page.tsx` — 消息折叠/展开逻辑
- `lib/i18n.ts` — 删除工具列表翻译

**需要删除的文件：**
- `app/tools/page.tsx`
- `app/api/tools/[agentId]/route.ts`

**需要新增的文件：**
- `app/api/skills/[agentId]/[skillName]/route.ts` — 删除技能API

---

## 7. 注意事项

1. **删除技能是危险操作**：必须二次确认，提示用户操作不可撤销
2. **核心文件清理**：删除技能后需要从 cognition.md、TOOLS.md 等文件中移除引用
3. **消息展开布局**：展开后的长消息不要撑破容器，使用 `break-words` 和滚动
4. **状态管理**：折叠/展开状态用 `Set<string>` 或 `Set<number>` 管理
5. **响应式设计**：卡片在移动端也要正常显示
