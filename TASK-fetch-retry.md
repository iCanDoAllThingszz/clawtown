# TASK: 修复会话历史页面偶发加载失败

## 问题描述
用户反馈：切换到会话历史页面时偶发 "加载失败: Failed to fetch"

## 排查方向
1. 检查 `app/sessions/page.tsx` 中的 fetch 调用是否有超时设置
2. 检查是否有错误处理和重试机制
3. API `/api/sessions/[agentId]` 返回数据量较大（152个会话），可能导致超时

## 修复方案
在 `app/sessions/page.tsx` 中：

1. 给 fetch 调用加上超时和重试机制：
```typescript
const fetchWithRetry = async (url: string, retries = 3, timeout = 10000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // 指数退避
    }
  }
};
```

2. 在 `SessionList` 组件的 `fetchSessions` 函数中使用 `fetchWithRetry` 替代原有的 `fetch`

3. 改进错误提示，显示具体错误信息和重试按钮

## 验收标准
1. `npm run build` 零错误
2. 代码中所有 fetch 调用都有超时和重试机制
3. 错误提示更友好，包含重试按钮
4. commit 并 push
