var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/hooks/messageShape.ts
function chatMessageToUIMessage(m) {
  return {
    id: m.id,
    role: m.role,
    metadata: {
      feedback: m.feedback,
      attachedUrl: m.attachedUrl,
      turnId: m.turnId,
      compareModel: m.compareModel
    },
    parts: [{ type: "text", text: m.content }]
  };
}
function chatMessagesToUIMessages(messages) {
  return messages.map(chatMessageToUIMessage);
}
function extractText(message) {
  return message.parts.filter((p) => p.type === "text").map((p) => p.text).join("");
}
var init_messageShape = __esm({
  "src/hooks/messageShape.ts"() {
    "use strict";
  }
});

// src/hooks/threadPersistence.ts
function migrateThreadMessages(messages) {
  if (!Array.isArray(messages)) return [];
  if (messages.length === 0) return [];
  const first = messages[0];
  const alreadyMigrated = typeof first === "object" && first !== null && Array.isArray(first.parts);
  if (alreadyMigrated) return messages;
  return chatMessagesToUIMessages(messages);
}
function toSaveThreadBody(thread) {
  const { keyToken: _keyToken, keyAlias: _keyAlias, ...data } = thread;
  return { title: thread.title, pinned: !!thread.pinned, data };
}
function fromPersisted(persisted) {
  const raw = persisted.data && typeof persisted.data === "object" && !Array.isArray(persisted.data) ? persisted.data : {};
  return {
    ...raw,
    keyToken: "",
    keyAlias: "",
    id: typeof raw.id === "string" ? raw.id : persisted.id,
    title: typeof raw.title === "string" && raw.title ? raw.title : persisted.title,
    pinned: typeof raw.pinned === "boolean" ? raw.pinned : persisted.pinned,
    messages: migrateThreadMessages(raw.messages),
    model: typeof raw.model === "string" ? raw.model : "",
    vectorStoreIds: Array.isArray(raw.vectorStoreIds) ? raw.vectorStoreIds : [],
    customSystemPrompt: typeof raw.customSystemPrompt === "string" ? raw.customSystemPrompt : "",
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    totalTokens: typeof raw.totalTokens === "number" ? raw.totalTokens : 0,
    lastTurnUsage: raw.lastTurnUsage ?? null
  };
}
var init_threadPersistence = __esm({
  "src/hooks/threadPersistence.ts"() {
    "use strict";
    init_messageShape();
  }
});

// src/api.ts
import { createApiRef } from "@backstage/core-plugin-api";
var aiConversationApiRef, BASE_PATH, AiConversationApi;
var init_api = __esm({
  "src/api.ts"() {
    "use strict";
    init_threadPersistence();
    aiConversationApiRef = createApiRef({
      id: "plugin.ai-conversation.api"
    });
    BASE_PATH = "/api/ai-conversation";
    AiConversationApi = class {
      constructor(fetchApi) {
        this.fetchApi = fetchApi;
      }
      async listVectorStores() {
        const res = await this.fetchApi.fetch(`${BASE_PATH}/vector_stores`);
        if (!res.ok) throw new Error(`vector_stores ${res.status}`);
        return res.json();
      }
      async listSkills() {
        const res = await this.fetchApi.fetch(`${BASE_PATH}/skills`);
        if (!res.ok) throw new Error(`skills ${res.status}`);
        return res.json();
      }
      async getChatConfig() {
        const res = await this.fetchApi.fetch(`${BASE_PATH}/config`);
        if (!res.ok) {
          return {
            defaultModel: null,
            defaultVectorStoreIds: null,
            maxRequestBudget: null,
            persistence: { enabled: false, ttlDays: 30 }
          };
        }
        const data = await res.json();
        return {
          defaultModel: data.defaultModel ?? null,
          defaultVectorStoreIds: data.defaultVectorStoreIds ?? null,
          maxRequestBudget: data.maxRequestBudget ?? null,
          // The two plugins version independently — an older backend's /config
          // may predate the persistence flag. Fall back to off-by-default (the
          // backend's own default, see readChatConfig in router.ts) so ChatPage
          // never reads `config.persistence.enabled` off undefined.
          persistence: data.persistence ?? { enabled: false, ttlDays: 30 }
        };
      }
      async getChatTraits() {
        const res = await this.fetchApi.fetch(`${BASE_PATH}/chat/traits`);
        if (!res.ok) throw new Error(`chat/traits ${res.status}`);
        return res.json();
      }
      async fetchUrlContext(url) {
        const res = await this.fetchApi.fetch(`${BASE_PATH}/fetch-context`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `fetch-context ${res.status}`);
        }
        return res.json();
      }
      async getFeedbackSummary(filters) {
        const params = new URLSearchParams();
        if (filters?.skillId) params.set("skillId", filters.skillId);
        if (filters?.model) params.set("model", filters.model);
        const qs = params.toString();
        const res = await this.fetchApi.fetch(`${BASE_PATH}/feedback/summary${qs ? `?${qs}` : ""}`);
        if (!res.ok) throw new Error(`feedback/summary ${res.status}`);
        return res.json();
      }
      async getUsageSummary(groupBy, range = "30d") {
        const params = new URLSearchParams({ groupBy, range });
        const res = await this.fetchApi.fetch(`${BASE_PATH}/usage/summary?${params.toString()}`);
        if (!res.ok) throw new Error(`usage/summary ${res.status}`);
        return res.json();
      }
      async mintChatKey(opts) {
        const res = await this.fetchApi.fetch(`${BASE_PATH}/chat/key`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts ?? {})
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`mint key ${res.status}: ${text}`);
        }
        return res.json();
      }
      async deleteChatKey(key) {
        const res = await this.fetchApi.fetch(`${BASE_PATH}/chat/key`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key })
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`delete key ${res.status}: ${text}`);
        }
        return res.json();
      }
      async getKeySpend(alias) {
        const res = await this.fetchApi.fetch(
          `${BASE_PATH}/chat/key/${encodeURIComponent(alias)}/spend`
        );
        if (!res.ok) return null;
        return res.json();
      }
      async sendFeedback(req) {
        const res = await this.fetchApi.fetch(`${BASE_PATH}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req)
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`feedback ${res.status}: ${text}`);
        }
        return res.json();
      }
      async listThreads() {
        const res = await this.fetchApi.fetch(`${BASE_PATH}/threads`);
        if (!res.ok) throw new Error(`threads ${res.status}`);
        return res.json();
      }
      async saveThread(thread) {
        const res = await this.fetchApi.fetch(`${BASE_PATH}/threads/${encodeURIComponent(thread.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toSaveThreadBody(thread))
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`save thread ${res.status}: ${text}`);
        }
      }
      async deleteThread(id) {
        const res = await this.fetchApi.fetch(`${BASE_PATH}/threads/${encodeURIComponent(id)}`, {
          method: "DELETE"
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`delete thread ${res.status}: ${text}`);
        }
      }
    };
  }
});

// src/hooks/chatTruncation.ts
function computeRegenerateTarget(messages, messageId) {
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx === -1) return null;
  const target = messages[idx];
  if (target.role === "user") {
    return {
      baseMessages: messages.slice(0, idx),
      text: extractText(target),
      isCompareEligible: true
    };
  }
  const turnId = target.metadata?.turnId;
  let userIdx = idx - 1;
  while (userIdx >= 0 && !(messages[userIdx].role === "user" && (!turnId || messages[userIdx].metadata?.turnId === turnId))) {
    userIdx -= 1;
  }
  if (userIdx < 0) return null;
  return {
    baseMessages: messages.slice(0, userIdx),
    text: extractText(messages[userIdx]),
    isCompareEligible: !!target.metadata?.compareModel
  };
}
function computeEditTarget(messages, messageId) {
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx === -1 || messages[idx].role !== "user") return null;
  return { baseMessages: messages.slice(0, idx) };
}
var init_chatTruncation = __esm({
  "src/hooks/chatTruncation.ts"() {
    "use strict";
    init_messageShape();
  }
});

// src/hooks/aiSdkTransport.ts
import { DefaultChatTransport } from "ai";
function createAiConversationTransport(fetchApi, getSettings) {
  return new DefaultChatTransport({
    api: `${BASE_PATH2}/chat/stream/v2`,
    fetch: fetchApi.fetch.bind(fetchApi),
    prepareSendMessagesRequest: ({ messages, body }) => {
      const s = getSettings();
      const contextUrl = body?.context_url;
      return {
        body: {
          model: s.model,
          messages,
          thread_id: s.threadId,
          skill_id: s.skillId || void 0,
          vector_store_ids: s.vectorStoreIds.length ? s.vectorStoreIds : void 0,
          custom_system_prompt: s.customSystemPrompt || void 0,
          tone_id: s.toneId || void 0,
          focus_id: s.focusId || void 0,
          verbosity_id: s.verbosityId || void 0,
          reasoning_effort: s.reasoningEffort || void 0,
          context_url: contextUrl,
          web_search: s.webSearch || void 0,
          top_k: s.topK,
          user_key: s.userKey
        }
      };
    }
  });
}
var BASE_PATH2;
var init_aiSdkTransport = __esm({
  "src/hooks/aiSdkTransport.ts"() {
    "use strict";
    BASE_PATH2 = "/api/ai-conversation";
  }
});

// src/hooks/useCompareChat.ts
import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { Chat } from "@ai-sdk/react";
function useCompareChat(options) {
  const { createTransport, onFinishColumn } = options;
  const columnsRef = useRef(/* @__PURE__ */ new Map());
  const versionRef = useRef(0);
  const listenersRef = useRef(/* @__PURE__ */ new Set());
  const notify = useCallback(() => {
    versionRef.current += 1;
    listenersRef.current.forEach((l) => l());
  }, []);
  const subscribe = useCallback((onStoreChange) => {
    listenersRef.current.add(onStoreChange);
    return () => {
      listenersRef.current.delete(onStoreChange);
    };
  }, []);
  const getSnapshot = useCallback(() => versionRef.current, []);
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const teardownColumn = useCallback((entry) => {
    entry.unsubscribe();
  }, []);
  const reset = useCallback(() => {
    columnsRef.current.forEach((entry) => {
      entry.chat.stop().catch(() => {
      });
      teardownColumn(entry);
    });
    columnsRef.current.clear();
    notify();
  }, [notify, teardownColumn]);
  const sendToAll = useCallback(
    (models, baseMessages) => {
      columnsRef.current.forEach((entry) => {
        entry.chat.stop().catch(() => {
        });
        teardownColumn(entry);
      });
      columnsRef.current.clear();
      for (const model of models) {
        const transport = createTransport(model);
        const chat = new Chat({
          id: `compare:${model}:${Date.now()}`,
          transport,
          messages: baseMessages
        });
        const unsubMessages = chat["~registerMessagesCallback"](notify);
        const unsubStatus = chat["~registerStatusCallback"](notify);
        const unsubError = chat["~registerErrorCallback"](notify);
        const entry = {
          model,
          chat,
          unsubscribe: () => {
            unsubMessages();
            unsubStatus();
            unsubError();
          }
        };
        columnsRef.current.set(model, entry);
        chat.sendMessage().then(() => onFinishColumn?.(model)).catch(() => {
        });
      }
      notify();
    },
    [createTransport, notify, onFinishColumn, teardownColumn]
  );
  const stopAll = useCallback(() => {
    columnsRef.current.forEach((entry) => {
      entry.chat.stop().catch(() => {
      });
    });
  }, []);
  const columns = useMemo(
    () => Array.from(columnsRef.current.values()).map((entry) => ({
      model: entry.model,
      messages: entry.chat.messages,
      status: entry.chat.status,
      error: entry.chat.error
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versionRef.current]
  );
  const isStreaming = columns.some((c) => c.status === "submitted" || c.status === "streaming");
  return { columns, isStreaming, sendToAll, stopAll, reset };
}
var init_useCompareChat = __esm({
  "src/hooks/useCompareChat.ts"() {
    "use strict";
  }
});

// src/hooks/useThreads.ts
import { useState, useCallback as useCallback2, useRef as useRef2, useEffect, useMemo as useMemo2 } from "react";
import { useApi } from "@backstage/core-plugin-api";
import { fetchApiRef } from "@backstage/core-plugin-api";
import { useChat as useAiSdkChat } from "@ai-sdk/react";
function loadThreads(userId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((t) => ({ ...t, messages: migrateThreadMessages(t.messages) }));
  } catch {
    return [];
  }
}
function saveThreads(userId, threads) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}:${userId}`, JSON.stringify(threads));
  } catch {
  }
}
function genId() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function newThreadsOnly(prev, incoming) {
  const existingIds = new Set(prev.map((t) => t.id));
  return incoming.filter((t) => !existingIds.has(t.id));
}
function findQuestionFor(messages, messageId) {
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx <= 0) return void 0;
  return messages[idx - 1];
}
function isChatKeyAuthError(message) {
  if (!message) return false;
  return /upstream 401\b/i.test(message) || /token_not_found_in_db/i.test(message) || /invalid proxy server token/i.test(message) || /expiredtoken|expired token/i.test(message);
}
function useThreads(opts) {
  const {
    userId,
    model,
    vectorStoreIds,
    customSystemPrompt,
    toneId,
    focusId,
    verbosityId,
    reasoningEffort,
    keyAlias,
    keyToken,
    keyExpiresAt,
    skillId,
    topK,
    webSearch,
    persistenceEnabled,
    onKeyChange
  } = opts;
  const api = useApi(aiConversationApiRef);
  const fetchApi = useApi(fetchApiRef);
  const authRetryRef = useRef2(false);
  const lastSendRef = useRef2(null);
  const pendingRetryRef = useRef2(null);
  const [threads, setThreads] = useState(() => loadThreads(userId));
  const [activeId, setActiveId] = useState(() => threads[0]?.id ?? null);
  const [error, setError] = useState(null);
  const [citations, setCitations] = useState([]);
  const [keySpend, setKeySpend] = useState(null);
  const loadedUserIdRef = useRef2(userId);
  useEffect(() => {
    if (userId === loadedUserIdRef.current) return;
    loadedUserIdRef.current = userId;
    const stored = loadThreads(userId);
    if (stored.length === 0) return;
    setThreads((prev) => {
      const fresh = newThreadsOnly(prev, stored);
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    setActiveId((prev) => prev ?? stored[0]?.id ?? null);
  }, [userId]);
  const activeThread = threads.find((t) => t.id === activeId) ?? null;
  const isCompareThread = activeThread?.mode === "compare";
  const settingsRef = useRef2({
    model,
    vectorStoreIds,
    customSystemPrompt,
    toneId,
    focusId,
    verbosityId,
    reasoningEffort,
    webSearch,
    topK,
    userKey: keyToken,
    threadId: activeThread?.id ?? "",
    skillId
  });
  settingsRef.current = {
    model,
    vectorStoreIds,
    customSystemPrompt,
    toneId,
    focusId,
    verbosityId,
    reasoningEffort,
    webSearch,
    topK,
    userKey: keyToken,
    threadId: activeThread?.id ?? "",
    skillId
  };
  const transport = useMemo2(
    () => createAiConversationTransport(fetchApi, () => settingsRef.current),
    [fetchApi]
  );
  const chat = useAiSdkChat({
    id: activeThread?.id ?? "no-active-thread",
    messages: activeThread?.messages ?? [],
    transport,
    onData: (dataPart) => {
      if (!activeThread) return;
      if (dataPart.type === "data-citations") {
        const results = dataPart.data;
        setCitations(
          Array.isArray(results) ? results.map((r) => ({
            filename: r.filename,
            score: r.score,
            snippet: r.text ?? r.snippet,
            source: r.source,
            url: r.url
          })) : []
        );
      }
      if (dataPart.type === "data-usage") {
        const usage = dataPart.data;
        const threadId = activeThread.id;
        setThreads(
          (prev) => prev.map(
            (t) => t.id === threadId ? { ...t, lastTurnUsage: usage, totalTokens: t.totalTokens + usage.total_tokens } : t
          )
        );
      }
    },
    onError: (err) => {
      if (!authRetryRef.current && isChatKeyAuthError(err.message) && lastSendRef.current) {
        authRetryRef.current = true;
        const replay = lastSendRef.current;
        api.mintChatKey().then((info) => {
          const next = {
            alias: info.key_alias,
            token: info.key,
            expiresAt: info.expires_at ? Date.parse(info.expires_at) : void 0
          };
          setThreads(
            (prev) => prev.map(
              (t) => t.id === replay.threadId ? {
                ...t,
                keyAlias: next.alias,
                keyToken: next.token,
                keyExpiresAt: next.expiresAt
              } : t
            )
          );
          onKeyChange?.(next);
          pendingRetryRef.current = replay;
        }).catch(() => setError(err.message));
        return;
      }
      setError(err.message);
    },
    onFinish: () => {
      authRetryRef.current = false;
      if (keyAlias) api.getKeySpend(keyAlias).then(setKeySpend).catch(() => {
      });
    }
  });
  const compareChat = useCompareChat({
    createTransport: (forModel) => createAiConversationTransport(fetchApi, () => ({
      ...settingsRef.current,
      model: forModel
    })),
    onFinishColumn: () => {
      if (keyAlias) api.getKeySpend(keyAlias).then(setKeySpend).catch(() => {
      });
    }
  });
  useEffect(() => {
    if (!activeThread || isCompareThread) return;
    const threadId = activeThread.id;
    setThreads(
      (prev) => prev.map((t) => t.id === threadId ? { ...t, messages: chat.messages, updatedAt: Date.now() } : t)
    );
  }, [chat.messages, isCompareThread]);
  const compareTurnRef = useRef2(null);
  useEffect(() => {
    if (!activeThread || !isCompareThread) return;
    const turn = compareTurnRef.current;
    if (!turn || turn.threadId !== activeThread.id || compareChat.columns.length === 0) return;
    const assistantMsgs = compareChat.columns.map((col) => {
      const last = col.messages[col.messages.length - 1];
      const base = last ?? {
        id: genId(),
        role: "assistant",
        parts: []
      };
      return {
        ...base,
        metadata: { ...base.metadata, turnId: turn.turnId, compareModel: col.model }
      };
    });
    const threadId = activeThread.id;
    setThreads(
      (prev) => prev.map(
        (t) => t.id === threadId ? { ...t, messages: [...turn.prefix, ...assistantMsgs], updatedAt: Date.now() } : t
      )
    );
  }, [compareChat.columns, isCompareThread]);
  const isStreaming = isCompareThread ? compareChat.isStreaming : chat.status === "submitted" || chat.status === "streaming";
  const streamingMessageIds = useMemo2(() => {
    if (isCompareThread) {
      return new Set(
        compareChat.columns.filter((c) => c.status === "submitted" || c.status === "streaming").map((c) => c.messages[c.messages.length - 1]?.id).filter((id) => !!id)
      );
    }
    const last = chat.messages[chat.messages.length - 1];
    return isStreaming && last ? /* @__PURE__ */ new Set([last.id]) : /* @__PURE__ */ new Set();
  }, [isCompareThread, compareChat.columns, chat.messages, isStreaming]);
  const threadsRef = useRef2(threads);
  threadsRef.current = threads;
  const activeIdRef = useRef2(activeId);
  activeIdRef.current = activeId;
  const saveTimeoutRef = useRef2(null);
  const syncActiveThreadToBackend = useCallback2(() => {
    if (!persistenceEnabled) return;
    const active = threadsRef.current.find((t) => t.id === activeIdRef.current);
    if (active) api.saveThread(active).catch(() => {
    });
  }, [persistenceEnabled, api]);
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveThreads(userId, threadsRef.current);
      syncActiveThreadToBackend();
    }, SAVE_DEBOUNCE_MS);
  }, [userId, threads, syncActiveThreadToBackend]);
  useEffect(() => {
    const flush = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      saveThreads(userId, threadsRef.current);
      syncActiveThreadToBackend();
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [userId, syncActiveThreadToBackend]);
  useEffect(() => {
    let cancelled = false;
    if (persistenceEnabled) {
      api.listThreads().then((persisted) => {
        if (cancelled) return;
        setThreads((prev) => {
          const fresh = newThreadsOnly(prev, persisted.map(fromPersisted));
          return fresh.length ? [...fresh, ...prev] : prev;
        });
      }).catch((err) => {
        if (!cancelled) setError(err.message);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [persistenceEnabled]);
  useEffect(() => {
    if (!keyToken || activeId) return;
    const thread = {
      id: genId(),
      title: "New chat",
      messages: [],
      model,
      vectorStoreIds,
      customSystemPrompt,
      keyAlias,
      keyToken,
      keyExpiresAt,
      skillId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalTokens: 0,
      lastTurnUsage: null
    };
    setThreads((prev) => [thread, ...prev]);
    setActiveId(thread.id);
  }, [keyToken, activeId, persistenceEnabled, api]);
  const newThread = useCallback2(
    // `overrideKey` lets a caller that just minted a key hand it in directly,
    // instead of relying on this callback's own `keyAlias`/`keyToken`
    // closure — which is stale immediately after an async mint (the caller
    // awaited chatApi.mintChatKey() and called setKeyVal(), but this
    // useCallback instance was still built from the pre-mint render). Baking
    // in a stale empty key here meant the "restore thread settings" effect
    // read it straight back onto keyVal on the next render, wiping out the
    // just-minted key before the second message could use it.
    (overrideKey) => {
      const thread = {
        id: genId(),
        title: "New chat",
        messages: [],
        model,
        vectorStoreIds,
        customSystemPrompt,
        keyAlias: overrideKey?.alias ?? keyAlias,
        keyToken: overrideKey?.token ?? keyToken,
        keyExpiresAt: overrideKey ? overrideKey.expiresAt : keyExpiresAt,
        skillId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalTokens: 0,
        lastTurnUsage: null
      };
      setThreads((prev) => [thread, ...prev]);
      setActiveId(thread.id);
      setError(null);
      setCitations([]);
      setKeySpend(null);
      authRetryRef.current = false;
      compareChat.reset();
    },
    [model, vectorStoreIds, customSystemPrompt, keyAlias, keyToken, keyExpiresAt, skillId, compareChat]
  );
  const selectThread = useCallback2(
    (id) => {
      setActiveId(id);
      setError(null);
      setCitations([]);
      setKeySpend(null);
      compareChat.reset();
    },
    [compareChat]
  );
  const deleteThread = useCallback2(
    (id) => {
      const thread = threads.find((t) => t.id === id);
      const remaining = threads.filter((t) => t.id !== id);
      setThreads(remaining);
      if (activeId === id) {
        setActiveId(remaining[0]?.id ?? null);
        compareChat.reset();
      }
      if (thread?.keyToken) {
        api.deleteChatKey(thread.keyToken).catch(() => {
        });
      }
      if (persistenceEnabled) api.deleteThread(id).catch(() => {
      });
    },
    [activeId, threads, api, persistenceEnabled, compareChat]
  );
  const stopGeneration = useCallback2(() => {
    chat.stop().catch(() => {
    });
    compareChat.stopAll();
  }, [chat, compareChat]);
  const runSend = useCallback2(
    (text, baseMessages, attachedUrl, files) => {
      if (!text.trim() || !activeThread || !keyToken) return;
      lastSendRef.current = { threadId: activeThread.id, text, baseMessages, attachedUrl, files };
      setError(null);
      setCitations([]);
      const threadId = activeThread.id;
      setThreads(
        (prev) => prev.map(
          (t) => t.id === threadId ? {
            ...t,
            title: t.messages.length === 0 ? text.slice(0, 40) : t.title,
            model,
            vectorStoreIds,
            customSystemPrompt,
            toneId,
            focusId,
            verbosityId,
            reasoningEffort: reasoningEffort || void 0,
            keyAlias,
            keyToken,
            keyExpiresAt,
            skillId,
            webSearch,
            mode: "single",
            updatedAt: Date.now()
          } : t
        )
      );
      chat.setMessages(baseMessages);
      chat.sendMessage(
        { text, files, metadata: { attachedUrl } },
        { body: attachedUrl ? { context_url: attachedUrl.url } : void 0 }
      ).catch(() => {
      });
    },
    [
      activeThread,
      keyToken,
      model,
      vectorStoreIds,
      customSystemPrompt,
      toneId,
      focusId,
      verbosityId,
      reasoningEffort,
      keyAlias,
      keyExpiresAt,
      skillId,
      webSearch,
      chat
    ]
  );
  useEffect(() => {
    const replay = pendingRetryRef.current;
    if (!replay || !keyToken) return;
    pendingRetryRef.current = null;
    if (activeThread?.id !== replay.threadId) return;
    runSend(replay.text, replay.baseMessages, replay.attachedUrl, replay.files);
  }, [keyToken]);
  const runCompareSend = useCallback2(
    (text, baseMessages, models, attachedUrl, files) => {
      if (!text.trim() || !activeThread || !keyToken || models.length === 0) return;
      setError(null);
      setCitations([]);
      const turnId = genId();
      const userMsg = {
        id: genId(),
        role: "user",
        metadata: { attachedUrl, turnId },
        parts: [{ type: "text", text }, ...files ?? []]
      };
      const threadId = activeThread.id;
      compareTurnRef.current = { threadId, turnId, prefix: [...baseMessages, userMsg] };
      setThreads(
        (prev) => prev.map(
          (t) => t.id === threadId ? {
            ...t,
            messages: [...baseMessages, userMsg],
            title: t.messages.length === 0 ? text.slice(0, 40) : t.title,
            vectorStoreIds,
            customSystemPrompt,
            toneId,
            focusId,
            verbosityId,
            reasoningEffort: reasoningEffort || void 0,
            keyAlias,
            keyToken,
            webSearch,
            mode: "compare",
            compareModels: models,
            updatedAt: Date.now()
          } : t
        )
      );
      compareChat.sendToAll(models, [...baseMessages, userMsg]);
    },
    [
      activeThread,
      keyToken,
      vectorStoreIds,
      customSystemPrompt,
      toneId,
      focusId,
      verbosityId,
      reasoningEffort,
      keyAlias,
      webSearch,
      compareChat
    ]
  );
  const sendMessage = useCallback2(
    (text, attachedUrl, compareModelsOverride, files) => {
      if (!activeThread) return;
      authRetryRef.current = false;
      const models = compareModelsOverride ?? (activeThread.mode === "compare" ? activeThread.compareModels : void 0);
      if (models?.length) {
        runCompareSend(text, activeThread.messages, models, attachedUrl, files);
      } else {
        runSend(text, activeThread.messages, attachedUrl, files);
      }
    },
    [activeThread, runSend, runCompareSend]
  );
  const regenerateFrom = useCallback2(
    (messageId) => {
      if (!activeThread) return;
      authRetryRef.current = false;
      const target = computeRegenerateTarget(activeThread.messages, messageId);
      if (!target) return;
      const compareModels = activeThread.compareModels;
      const isCompare = activeThread.mode === "compare" && !!compareModels?.length && target.isCompareEligible;
      if (isCompare) {
        runCompareSend(target.text, target.baseMessages, compareModels);
      } else {
        runSend(target.text, target.baseMessages);
      }
    },
    [activeThread, runSend, runCompareSend]
  );
  const editAndResend = useCallback2(
    (messageId, newContent) => {
      if (!activeThread) return;
      authRetryRef.current = false;
      const target = computeEditTarget(activeThread.messages, messageId);
      if (!target) return;
      if (activeThread.mode === "compare" && activeThread.compareModels?.length) {
        runCompareSend(newContent, target.baseMessages, activeThread.compareModels);
      } else {
        runSend(newContent, target.baseMessages);
      }
    },
    [activeThread, runSend, runCompareSend]
  );
  const setCompareMode = useCallback2(
    (enabled, models) => {
      if (!activeThread) return;
      const threadId = activeThread.id;
      setThreads(
        (prev) => prev.map(
          (t) => t.id === threadId ? {
            ...t,
            mode: enabled ? "compare" : "single",
            compareModels: enabled ? models ?? t.compareModels ?? [] : t.compareModels
          } : t
        )
      );
    },
    [activeThread]
  );
  const togglePin = useCallback2(
    (id) => {
      setThreads((prev) => prev.map((t) => t.id === id ? { ...t, pinned: !t.pinned } : t));
      if (!persistenceEnabled) return;
      const current = threadsRef.current.find((t) => t.id === id);
      if (!current) return;
      if (current.id === activeIdRef.current) return;
      api.saveThread({ ...current, pinned: !current.pinned }).catch(() => {
      });
    },
    [persistenceEnabled, api]
  );
  const exportThread = useCallback2(
    (id) => {
      const thread = threads.find((t) => t.id === id);
      if (!thread) return;
      const { keyToken: _keyToken, keyAlias: _keyAlias, ...portable } = thread;
      const payload = { version: THREAD_EXPORT_VERSION, thread: portable };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${thread.title.replace(/[^\w-]+/g, "_").slice(0, 60) || "thread"}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    [threads]
  );
  const importThread = useCallback2(async (file) => {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Not valid JSON");
    }
    const payload = parsed;
    if (payload?.version !== 1 && payload?.version !== THREAD_EXPORT_VERSION || !payload.thread || typeof payload.thread.id !== "string" || !Array.isArray(payload.thread.messages)) {
      throw new Error("Unrecognized thread export format");
    }
    const src = payload.thread;
    const imported = {
      id: genId(),
      title: typeof src.title === "string" ? src.title : "Imported chat",
      messages: migrateThreadMessages(src.messages),
      model: typeof src.model === "string" ? src.model : "",
      vectorStoreIds: Array.isArray(src.vectorStoreIds) ? src.vectorStoreIds : [],
      customSystemPrompt: typeof src.customSystemPrompt === "string" ? src.customSystemPrompt : "",
      keyAlias: "",
      keyToken: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalTokens: typeof src.totalTokens === "number" ? src.totalTokens : 0,
      lastTurnUsage: null,
      pinned: false
    };
    setThreads((prev) => [imported, ...prev]);
    setActiveId(imported.id);
  }, []);
  const submitFeedback = useCallback2(
    (messageId, vote) => {
      if (!activeThread) return;
      const message = activeThread.messages.find((m) => m.id === messageId);
      if (!message) return;
      const question = findQuestionFor(activeThread.messages, messageId);
      const threadId = activeThread.id;
      setThreads(
        (prev) => prev.map(
          (t) => t.id !== threadId ? t : {
            ...t,
            messages: t.messages.map(
              (m) => m.id === messageId ? { ...m, metadata: { ...m.metadata, feedback: vote } } : m
            )
          }
        )
      );
      api.sendFeedback({
        threadId,
        messageId,
        vote,
        question: question ? extractText(question) : "",
        answer: extractText(message),
        model: activeThread.model,
        vectorStoreIds: activeThread.vectorStoreIds,
        toneId: activeThread.toneId || void 0,
        focusId: activeThread.focusId || void 0,
        verbosityId: activeThread.verbosityId || void 0
      }).catch((err) => setError(err.message));
    },
    [activeThread, api]
  );
  return {
    threads,
    activeThread,
    newThread,
    selectThread,
    deleteThread,
    sendMessage,
    regenerateFrom,
    editAndResend,
    stopGeneration,
    submitFeedback,
    togglePin,
    exportThread,
    importThread,
    setCompareMode,
    isStreaming,
    streamingMessageIds,
    error,
    citations,
    keySpend
  };
}
var THREAD_EXPORT_VERSION, STORAGE_PREFIX, SAVE_DEBOUNCE_MS;
var init_useThreads = __esm({
  "src/hooks/useThreads.ts"() {
    "use strict";
    init_api();
    init_chatTruncation();
    init_threadPersistence();
    init_aiSdkTransport();
    init_messageShape();
    init_useCompareChat();
    THREAD_EXPORT_VERSION = 2;
    STORAGE_PREFIX = "ai-conversation:threads";
    SAVE_DEBOUNCE_MS = 400;
  }
});

// src/theme.ts
function injectStylesheetOnce(id, href) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}
function injectDesignSystemAssets() {
  injectStylesheetOnce("ai-conversation-jetbrains-mono", JETBRAINS_MONO_URL);
  injectStylesheetOnce("ai-conversation-katex-css", KATEX_CSS_URL);
}
var ACCENT_START, ACCENT_END, ACCENT_GRADIENT, ACCENT_CONIC_GRADIENT, MONO_FONT_STACK, JETBRAINS_MONO_URL, KATEX_CSS_URL;
var init_theme = __esm({
  "src/theme.ts"() {
    "use strict";
    ACCENT_START = "#7C5CFC";
    ACCENT_END = "#22D3EE";
    ACCENT_GRADIENT = `linear-gradient(135deg, ${ACCENT_START}, ${ACCENT_END})`;
    ACCENT_CONIC_GRADIENT = `conic-gradient(from 0deg, ${ACCENT_START}, ${ACCENT_END}, ${ACCENT_START})`;
    MONO_FONT_STACK = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    JETBRAINS_MONO_URL = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap";
    KATEX_CSS_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
  }
});

// src/components/ModelPicker.tsx
import React, { useEffect as useEffect2, useState as useState2 } from "react";
import { Autocomplete, TextField, Typography, Box } from "@mui/material";
import { useApi as useApi2 } from "@backstage/core-plugin-api";
import { liteLlmApiRef } from "@acarmisc/backstage-plugin-litellm";
var ModelPicker;
var init_ModelPicker = __esm({
  "src/components/ModelPicker.tsx"() {
    "use strict";
    ModelPicker = ({
      value,
      onChange,
      defaultModel
    }) => {
      const liteLlmApi = useApi2(liteLlmApiRef);
      const [models, setModels] = useState2([]);
      const [loading, setLoading] = useState2(true);
      const [error, setError] = useState2(null);
      useEffect2(() => {
        let alive = true;
        liteLlmApi.listModels().then((all) => {
          if (!alive) return;
          const m = all.filter((x) => !x.model_name.startsWith("claude"));
          setModels(m);
        }).catch((err) => {
          if (alive) setError(err.message ?? "Failed to load models");
        }).finally(() => alive && setLoading(false));
        return () => {
          alive = false;
        };
      }, [liteLlmApi]);
      useEffect2(() => {
        if (value || models.length === 0) return;
        const def = defaultModel && models.find((x) => x.model_name === defaultModel)?.model_name || models[0].model_name;
        onChange(def);
      }, [value, models, defaultModel, onChange]);
      return /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(
        Autocomplete,
        {
          freeSolo: true,
          size: "small",
          options: models,
          getOptionLabel: (option) => {
            if (typeof option === "string") return option;
            return option.model_name;
          },
          value,
          inputValue: value,
          loading,
          onChange: (_e, model) => {
            if (typeof model === "string") {
              onChange(model);
            } else if (model && "model_name" in model) {
              onChange(model.model_name);
            }
          },
          onInputChange: (_e, inputValue) => {
            onChange(inputValue);
          },
          renderInput: (params) => /* @__PURE__ */ React.createElement(
            TextField,
            {
              ...params,
              label: "Model",
              error: !!error,
              fullWidth: true
            }
          )
        }
      ), error && /* @__PURE__ */ React.createElement(Typography, { variant: "caption", color: "error", sx: { display: "block", mt: 0.5 } }, error));
    };
  }
});

// src/components/VectorStorePicker.tsx
import React2, { useEffect as useEffect3, useState as useState3 } from "react";
import { Autocomplete as Autocomplete2, Box as Box2, Checkbox, Chip, TextField as TextField2, Typography as Typography2 } from "@mui/material";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import { useApi as useApi3 } from "@backstage/core-plugin-api";
var VectorStorePicker;
var init_VectorStorePicker = __esm({
  "src/components/VectorStorePicker.tsx"() {
    "use strict";
    init_api();
    VectorStorePicker = ({
      value,
      onChange,
      defaultVectorStoreIds
    }) => {
      const chatApi = useApi3(aiConversationApiRef);
      const [stores, setStores] = useState3([]);
      const [loading, setLoading] = useState3(true);
      const [error, setError] = useState3(null);
      useEffect3(() => {
        let alive = true;
        chatApi.listVectorStores().then((s) => {
          if (!alive) return;
          setStores(s);
          if (value.length === 0 && s.length && defaultVectorStoreIds?.length) {
            const defaults = defaultVectorStoreIds.filter(
              (id) => s.some((x) => x.id === id)
            );
            if (defaults.length) onChange(defaults);
          }
        }).catch((err) => {
          if (alive) setError(err.message ?? "Failed to load knowledge bases");
        }).finally(() => alive && setLoading(false));
        return () => {
          alive = false;
        };
      }, []);
      const selected = stores.filter((s) => value.includes(s.id));
      return /* @__PURE__ */ React2.createElement(Box2, null, /* @__PURE__ */ React2.createElement(
        Autocomplete2,
        {
          multiple: true,
          size: "small",
          options: stores,
          value: selected,
          loading,
          disableCloseOnSelect: true,
          getOptionLabel: (s) => s.name,
          isOptionEqualToValue: (a, b) => a.id === b.id,
          onChange: (_e, newValue) => onChange(newValue.map((s) => s.id)),
          renderOption: (props, option, { selected: isSelected }) => /* @__PURE__ */ React2.createElement("li", { ...props, key: option.id }, /* @__PURE__ */ React2.createElement(
            Checkbox,
            {
              icon: /* @__PURE__ */ React2.createElement(CheckBoxOutlineBlankIcon, { fontSize: "small" }),
              checkedIcon: /* @__PURE__ */ React2.createElement(CheckBoxIcon, { fontSize: "small" }),
              checked: isSelected,
              size: "small",
              sx: { mr: 1, p: 0 }
            }
          ), option.name, " ", option.file_count != null ? `(${option.file_count})` : ""),
          renderTags: (tagValue, getTagProps) => tagValue.map((option, index) => /* @__PURE__ */ React2.createElement(
            Chip,
            {
              ...getTagProps({ index }),
              key: option.id,
              size: "small",
              label: option.name
            }
          )),
          renderInput: (params) => /* @__PURE__ */ React2.createElement(
            TextField2,
            {
              ...params,
              label: "Knowledge bases",
              placeholder: value.length ? void 0 : "None (no grounding)",
              error: !!error
            }
          ),
          sx: { minWidth: 200 }
        }
      ), error && /* @__PURE__ */ React2.createElement(Typography2, { variant: "caption", color: "error", sx: { display: "block", mt: 0.5 } }, error));
    };
  }
});

// src/components/OptionPicker.tsx
import React3 from "react";
import { Select, MenuItem, FormControl, InputLabel } from "@mui/material";
var OptionPicker;
var init_OptionPicker = __esm({
  "src/components/OptionPicker.tsx"() {
    "use strict";
    OptionPicker = ({
      label,
      value,
      options,
      onChange,
      loading,
      noneLabel = "Default"
    }) => {
      return /* @__PURE__ */ React3.createElement(FormControl, { size: "small", sx: { minWidth: 160 } }, /* @__PURE__ */ React3.createElement(InputLabel, { shrink: true }, label), /* @__PURE__ */ React3.createElement(
        Select,
        {
          value,
          label,
          displayEmpty: true,
          onChange: (e) => onChange(e.target.value),
          disabled: loading
        },
        /* @__PURE__ */ React3.createElement(MenuItem, { value: "" }, /* @__PURE__ */ React3.createElement("em", null, noneLabel)),
        options.map((o) => /* @__PURE__ */ React3.createElement(MenuItem, { key: o.id, value: o.id }, o.label))
      ));
    };
  }
});

// src/components/SkillPicker.tsx
import React4 from "react";
import {
  Select as Select2,
  MenuItem as MenuItem2,
  FormControl as FormControl2,
  InputLabel as InputLabel2,
  Typography as Typography3,
  Box as Box3,
  Chip as Chip2
} from "@mui/material";
var SkillPicker;
var init_SkillPicker = __esm({
  "src/components/SkillPicker.tsx"() {
    "use strict";
    SkillPicker = ({ value, skills, onChange }) => {
      const selected = skills.find((s) => s.id === value);
      return /* @__PURE__ */ React4.createElement(FormControl2, { size: "small", fullWidth: true, disabled: skills.length === 0 }, /* @__PURE__ */ React4.createElement(InputLabel2, { shrink: true }, "Skill"), /* @__PURE__ */ React4.createElement(
        Select2,
        {
          value: skills.some((s) => s.id === value) ? value : "",
          label: "Skill",
          displayEmpty: true,
          onChange: (e) => onChange(e.target.value),
          renderValue: () => selected ? selected.title : /* @__PURE__ */ React4.createElement(Typography3, { component: "span", variant: "body2", color: "text.secondary" }, skills.length === 0 ? "No skills configured" : "None")
        },
        /* @__PURE__ */ React4.createElement(MenuItem2, { value: "" }, /* @__PURE__ */ React4.createElement("em", null, "None")),
        skills.map((s) => /* @__PURE__ */ React4.createElement(MenuItem2, { key: s.id, value: s.id, sx: { display: "block", py: 1 } }, /* @__PURE__ */ React4.createElement(Box3, { sx: { display: "flex", alignItems: "center", gap: 1 } }, /* @__PURE__ */ React4.createElement(Typography3, { variant: "body2", sx: { fontWeight: 500 } }, s.title), s.tags?.slice(0, 3).map((t) => /* @__PURE__ */ React4.createElement(Chip2, { key: t, label: t, size: "small", variant: "outlined", sx: { height: 18 } }))), s.description && /* @__PURE__ */ React4.createElement(
          Typography3,
          {
            variant: "caption",
            color: "text.secondary",
            sx: { display: "block", whiteSpace: "normal" }
          },
          s.description
        )))
      ));
    };
  }
});

// src/components/ChatSettingsPanel.tsx
import React5 from "react";
import {
  Box as Box4,
  Typography as Typography4,
  Collapse,
  TextField as TextField3,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
var REASONING_EFFORT_OPTIONS, ChatSettingsPanel;
var init_ChatSettingsPanel = __esm({
  "src/components/ChatSettingsPanel.tsx"() {
    "use strict";
    init_ModelPicker();
    init_VectorStorePicker();
    init_OptionPicker();
    init_SkillPicker();
    REASONING_EFFORT_OPTIONS = [
      { id: "low", label: "Low" },
      { id: "medium", label: "Medium" },
      { id: "high", label: "High" }
    ];
    ChatSettingsPanel = ({
      showSettings,
      onToggleShowSettings,
      configError,
      config,
      traits,
      traitsLoading,
      skills,
      skillId,
      onSkillChange,
      toneId,
      onToneChange,
      focusId,
      onFocusChange,
      customSystemPrompt,
      onCustomSystemPromptChange,
      model,
      onModelChange,
      vectorStoreIds,
      onVectorStoreIdsChange,
      webSearch,
      onWebSearchChange,
      verbosityId,
      onVerbosityChange,
      reasoningEffort,
      onReasoningEffortChange
    }) => /* @__PURE__ */ React5.createElement(Box4, { sx: { flexShrink: 0 } }, /* @__PURE__ */ React5.createElement(
      Box4,
      {
        sx: {
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          px: 1.5,
          py: 1,
          bgcolor: "action.hover"
        },
        onClick: onToggleShowSettings
      },
      /* @__PURE__ */ React5.createElement(SettingsIcon, { fontSize: "small", sx: { mr: 1 } }),
      /* @__PURE__ */ React5.createElement(Typography4, { variant: "overline", sx: { flex: 1 } }, "Settings"),
      /* @__PURE__ */ React5.createElement(
        ExpandMoreIcon,
        {
          fontSize: "small",
          sx: {
            transform: showSettings ? "rotate(180deg)" : "none",
            transition: "transform 0.2s"
          }
        }
      )
    ), /* @__PURE__ */ React5.createElement(Collapse, { in: showSettings }, /* @__PURE__ */ React5.createElement(Box4, { sx: { display: "flex", flexDirection: "column" } }, configError && /* @__PURE__ */ React5.createElement(Typography4, { variant: "caption", color: "error", sx: { px: 1.5, pt: 1 } }, "Couldn't load chat defaults: ", configError), /* @__PURE__ */ React5.createElement(Box4, { sx: { px: 1.5, py: 1.5, display: "flex", flexDirection: "column", gap: 1.5 } }, /* @__PURE__ */ React5.createElement(SkillPicker, { value: skillId, skills, onChange: onSkillChange }), /* @__PURE__ */ React5.createElement(ModelPicker, { value: model, onChange: onModelChange, defaultModel: config.defaultModel }), /* @__PURE__ */ React5.createElement(
      VectorStorePicker,
      {
        value: vectorStoreIds,
        onChange: onVectorStoreIdsChange,
        defaultVectorStoreIds: config.defaultVectorStoreIds
      }
    ), /* @__PURE__ */ React5.createElement(
      TextField3,
      {
        label: "Extra prompt",
        placeholder: "Additional instructions or context\u2026",
        value: customSystemPrompt,
        onChange: (e) => onCustomSystemPromptChange(e.target.value),
        multiline: true,
        minRows: 2,
        maxRows: 6,
        size: "small",
        fullWidth: true
      }
    )), /* @__PURE__ */ React5.createElement(Accordion, { disableGutters: true, variant: "outlined", sx: { "&:before": { display: "none" }, mx: 1.5, mb: 1.5 } }, /* @__PURE__ */ React5.createElement(AccordionSummary, { expandIcon: /* @__PURE__ */ React5.createElement(ExpandMoreIcon, { fontSize: "small" }) }, /* @__PURE__ */ React5.createElement(Typography4, { variant: "body2", sx: { fontWeight: 500 } }, "Advanced")), /* @__PURE__ */ React5.createElement(AccordionDetails, { sx: { display: "flex", flexDirection: "column", gap: 1.5, pt: 1 } }, /* @__PURE__ */ React5.createElement(
      OptionPicker,
      {
        label: "Tone",
        value: toneId,
        options: traits.tones,
        onChange: onToneChange,
        loading: traitsLoading
      }
    ), /* @__PURE__ */ React5.createElement(
      OptionPicker,
      {
        label: "Focus",
        value: focusId,
        options: traits.focuses,
        onChange: onFocusChange,
        loading: traitsLoading
      }
    ), /* @__PURE__ */ React5.createElement(
      OptionPicker,
      {
        label: "Verbosity",
        value: verbosityId,
        options: traits.verbosities,
        onChange: onVerbosityChange,
        loading: traitsLoading
      }
    ), /* @__PURE__ */ React5.createElement(
      OptionPicker,
      {
        label: "Reasoning effort",
        value: reasoningEffort,
        options: REASONING_EFFORT_OPTIONS,
        onChange: (id) => onReasoningEffortChange(id),
        noneLabel: "Model default"
      }
    ), /* @__PURE__ */ React5.createElement(
      FormControlLabel,
      {
        control: /* @__PURE__ */ React5.createElement(
          Switch,
          {
            size: "small",
            checked: webSearch,
            onChange: (e) => onWebSearchChange(e.target.checked)
          }
        ),
        label: /* @__PURE__ */ React5.createElement(Typography4, { variant: "body2" }, "Include web search")
      }
    ))))));
  }
});

// src/components/PersonaAvatar.tsx
import React6 from "react";
import { Avatar, Box as Box5 } from "@mui/material";
var PersonaAvatar;
var init_PersonaAvatar = __esm({
  "src/components/PersonaAvatar.tsx"() {
    "use strict";
    init_theme();
    PersonaAvatar = ({
      label,
      isStreaming = false,
      size = 32
    }) => {
      const ringSize = size + 4;
      return /* @__PURE__ */ React6.createElement(Box5, { sx: { position: "relative", width: ringSize, height: ringSize, flexShrink: 0 } }, /* @__PURE__ */ React6.createElement(
        Box5,
        {
          sx: {
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: (theme) => isStreaming ? ACCENT_CONIC_GRADIENT : theme.palette.divider,
            animation: isStreaming ? "litellm-ring-spin 3s linear infinite" : "none",
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none"
            },
            "@keyframes litellm-ring-spin": {
              from: { transform: "rotate(0deg)" },
              to: { transform: "rotate(360deg)" }
            }
          }
        }
      ), /* @__PURE__ */ React6.createElement(
        Avatar,
        {
          sx: {
            position: "absolute",
            top: 2,
            left: 2,
            width: size,
            height: size,
            fontSize: size * 0.42,
            bgcolor: "background.paper",
            color: "text.primary"
          }
        },
        label
      ));
    };
  }
});

// src/components/CodeBlock.tsx
import React7, { useState as useState4 } from "react";
import { Box as Box6, IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
function extractText2(node) {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText2).join("");
  if (React7.isValidElement(node)) {
    return extractText2(node.props.children);
  }
  return "";
}
var CodeBlock;
var init_CodeBlock = __esm({
  "src/components/CodeBlock.tsx"() {
    "use strict";
    init_theme();
    CodeBlock = ({
      className,
      children,
      ...props
    }) => {
      const [copied, setCopied] = useState4(false);
      const isBlock = /language-/.test(className ?? "");
      if (!isBlock) {
        return /* @__PURE__ */ React7.createElement("code", { className, style: { fontFamily: MONO_FONT_STACK }, ...props }, children);
      }
      const handleCopy = () => {
        const text = extractText2(children).replace(/\n$/, "");
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      };
      return /* @__PURE__ */ React7.createElement(Box6, { sx: { position: "relative", "&:hover .litellm-copy-btn": { opacity: 1 } } }, /* @__PURE__ */ React7.createElement(Tooltip, { title: copied ? "Copied" : "Copy code" }, /* @__PURE__ */ React7.createElement(
        IconButton,
        {
          size: "small",
          className: "litellm-copy-btn",
          onClick: handleCopy,
          sx: {
            position: "absolute",
            top: 4,
            right: 4,
            opacity: 0,
            transition: "opacity 0.15s",
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider"
          }
        },
        copied ? /* @__PURE__ */ React7.createElement(CheckIcon, { fontSize: "inherit" }) : /* @__PURE__ */ React7.createElement(ContentCopyIcon, { fontSize: "inherit" })
      )), /* @__PURE__ */ React7.createElement("code", { className, style: { fontFamily: MONO_FONT_STACK }, ...props }, children));
    };
  }
});

// src/components/AssistantMessage.tsx
import React8, { useState as useState5 } from "react";
import { Box as Box7, Chip as Chip3, IconButton as IconButton2, Tooltip as Tooltip2 } from "@mui/material";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import ThumbDownOutlinedIcon from "@mui/icons-material/ThumbDownOutlined";
import ContentCopyIcon2 from "@mui/icons-material/ContentCopy";
import CheckIcon2 from "@mui/icons-material/Check";
import ReplayIcon from "@mui/icons-material/Replay";
import BuildIcon from "@mui/icons-material/Build";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
var blink, ToolCallPart, FilePart, AssistantMessage;
var init_AssistantMessage = __esm({
  "src/components/AssistantMessage.tsx"() {
    "use strict";
    init_PersonaAvatar();
    init_CodeBlock();
    init_messageShape();
    blink = {
      "@keyframes blink": {
        "0%, 50%": { opacity: 1 },
        "51%, 100%": { opacity: 0 }
      }
    };
    ToolCallPart = ({ part }) => {
      const toolName = part.type?.startsWith("tool-") ? part.type.slice("tool-".length) : "tool";
      const state = part.state ?? "input-available";
      if (state === "output-error" || part.errorText) {
        return /* @__PURE__ */ React8.createElement(
          Chip3,
          {
            size: "small",
            icon: /* @__PURE__ */ React8.createElement(ErrorOutlineIcon, { fontSize: "small" }),
            label: `${toolName} failed`,
            color: "error",
            variant: "outlined",
            sx: { mb: 0.5 }
          }
        );
      }
      if (state === "output-available") {
        return /* @__PURE__ */ React8.createElement(
          Chip3,
          {
            size: "small",
            icon: /* @__PURE__ */ React8.createElement(BuildIcon, { fontSize: "small" }),
            label: `${toolName} done`,
            variant: "outlined",
            sx: { mb: 0.5 }
          }
        );
      }
      return /* @__PURE__ */ React8.createElement(
        Chip3,
        {
          size: "small",
          icon: /* @__PURE__ */ React8.createElement(BuildIcon, { fontSize: "small" }),
          label: `${toolName}\u2026`,
          variant: "outlined",
          sx: { mb: 0.5 }
        }
      );
    };
    FilePart = ({
      url,
      mediaType,
      filename
    }) => {
      if (mediaType.startsWith("image/")) {
        return /* @__PURE__ */ React8.createElement(
          Box7,
          {
            component: "img",
            src: url,
            alt: filename ?? "attachment",
            sx: { maxWidth: 240, maxHeight: 240, borderRadius: 1, display: "block", mb: 0.5 }
          }
        );
      }
      return /* @__PURE__ */ React8.createElement(Chip3, { size: "small", label: filename ?? mediaType, variant: "outlined", sx: { mb: 0.5 } });
    };
    AssistantMessage = ({
      message,
      isStreaming,
      avatarLabel = "AI",
      onFeedback,
      onRegenerate
    }) => {
      const [copied, setCopied] = useState5(false);
      const text = extractText(message);
      const showActions = !!text && !isStreaming;
      const handleCopy = () => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      };
      const cursor = /* @__PURE__ */ React8.createElement(
        Box7,
        {
          component: "span",
          sx: {
            display: "inline-block",
            width: 8,
            height: 16,
            bgcolor: "text.primary",
            animation: "blink 1s step-end infinite",
            verticalAlign: "text-bottom",
            ...blink
          }
        }
      );
      let body;
      if (message.parts.length > 0) {
        body = message.parts.map((part, i) => {
          if (part.type === "text") {
            if (!part.text) return null;
            return /* @__PURE__ */ React8.createElement(
              ReactMarkdown,
              {
                key: i,
                remarkPlugins: [remarkGfm, remarkMath],
                rehypePlugins: [rehypeKatex],
                components: { code: CodeBlock }
              },
              part.text
            );
          }
          if (part.type === "file") {
            const p = part;
            return /* @__PURE__ */ React8.createElement(FilePart, { key: i, url: p.url, mediaType: p.mediaType, filename: p.filename });
          }
          if (typeof part.type === "string" && part.type.startsWith("tool-")) {
            return /* @__PURE__ */ React8.createElement(ToolCallPart, { key: i, part });
          }
          return null;
        });
      } else if (isStreaming) {
        body = cursor;
      } else {
        body = null;
      }
      return /* @__PURE__ */ React8.createElement(
        Box7,
        {
          sx: {
            display: "flex",
            gap: 1,
            alignSelf: "flex-start",
            maxWidth: "85%"
          }
        },
        /* @__PURE__ */ React8.createElement(PersonaAvatar, { label: avatarLabel.slice(0, 2).toUpperCase(), isStreaming, size: 28 }),
        /* @__PURE__ */ React8.createElement(Box7, { sx: { minWidth: 0, flex: 1 } }, /* @__PURE__ */ React8.createElement(
          Box7,
          {
            sx: {
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
              borderRadius: "12px",
              px: 1.5,
              py: 1,
              wordBreak: "break-word",
              "& p": { m: 0, mb: "0.5em" },
              "& p:last-child": { mb: 0 },
              "& pre": { overflowX: "auto", maxWidth: "100%" },
              "& code": { fontSize: "0.85em" },
              "& pre code": { bgcolor: "transparent", px: 0 }
            }
          },
          body
        ), showActions && /* @__PURE__ */ React8.createElement(
          Box7,
          {
            className: "litellm-actions",
            sx: { display: "flex", gap: 0.25, mt: 0.25 }
          },
          onFeedback && /* @__PURE__ */ React8.createElement(React8.Fragment, null, /* @__PURE__ */ React8.createElement(
            IconButton2,
            {
              size: "small",
              "aria-label": "Good response",
              color: message.metadata?.feedback === "up" ? "primary" : "default",
              onClick: () => onFeedback(message.id, "up")
            },
            message.metadata?.feedback === "up" ? /* @__PURE__ */ React8.createElement(ThumbUpIcon, { fontSize: "small" }) : /* @__PURE__ */ React8.createElement(ThumbUpOutlinedIcon, { fontSize: "small" })
          ), /* @__PURE__ */ React8.createElement(
            IconButton2,
            {
              size: "small",
              "aria-label": "Bad response",
              color: message.metadata?.feedback === "down" ? "primary" : "default",
              onClick: () => onFeedback(message.id, "down")
            },
            message.metadata?.feedback === "down" ? /* @__PURE__ */ React8.createElement(ThumbDownIcon, { fontSize: "small" }) : /* @__PURE__ */ React8.createElement(ThumbDownOutlinedIcon, { fontSize: "small" })
          )),
          onRegenerate && /* @__PURE__ */ React8.createElement(Tooltip2, { title: "Regenerate" }, /* @__PURE__ */ React8.createElement(IconButton2, { size: "small", "aria-label": "Regenerate", onClick: () => onRegenerate(message.id) }, /* @__PURE__ */ React8.createElement(ReplayIcon, { fontSize: "small" }))),
          /* @__PURE__ */ React8.createElement(Tooltip2, { title: copied ? "Copied" : "Copy" }, /* @__PURE__ */ React8.createElement(IconButton2, { size: "small", "aria-label": "Copy", onClick: handleCopy }, copied ? /* @__PURE__ */ React8.createElement(CheckIcon2, { fontSize: "small" }) : /* @__PURE__ */ React8.createElement(ContentCopyIcon2, { fontSize: "small" })))
        ))
      );
    };
  }
});

// src/safeUrl.ts
function safeHref(url) {
  if (!url) return void 0;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : void 0;
  } catch {
    return void 0;
  }
}
var init_safeUrl = __esm({
  "src/safeUrl.ts"() {
    "use strict";
  }
});

// src/components/UserMessage.tsx
import React9, { useState as useState6 } from "react";
import { Box as Box8, Button, Chip as Chip4, IconButton as IconButton3, TextField as TextField4, Tooltip as Tooltip3 } from "@mui/material";
import ContentCopyIcon3 from "@mui/icons-material/ContentCopy";
import CheckIcon3 from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
var UserMessage;
var init_UserMessage = __esm({
  "src/components/UserMessage.tsx"() {
    "use strict";
    init_safeUrl();
    init_messageShape();
    UserMessage = ({ message, onEditAndResend }) => {
      const text = extractText(message);
      const fileParts = message.parts.filter(
        (p) => p.type === "file"
      );
      const [editing, setEditing] = useState6(false);
      const [draft, setDraft] = useState6(text);
      const [copied, setCopied] = useState6(false);
      const handleCopy = () => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      };
      const startEdit = () => {
        setDraft(text);
        setEditing(true);
      };
      const saveEdit = () => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== text) {
          onEditAndResend?.(message.id, trimmed);
        }
        setEditing(false);
      };
      if (editing) {
        return /* @__PURE__ */ React9.createElement(Box8, { sx: { alignSelf: "flex-end", maxWidth: "80%", width: "100%", display: "flex", flexDirection: "column", gap: 0.5 } }, /* @__PURE__ */ React9.createElement(
          TextField4,
          {
            value: draft,
            onChange: (e) => setDraft(e.target.value),
            multiline: true,
            minRows: 1,
            maxRows: 8,
            size: "small",
            fullWidth: true
          }
        ), /* @__PURE__ */ React9.createElement(Box8, { sx: { display: "flex", gap: 1, justifyContent: "flex-end" } }, /* @__PURE__ */ React9.createElement(Button, { size: "small", onClick: () => setEditing(false) }, "Cancel"), /* @__PURE__ */ React9.createElement(Button, { size: "small", variant: "contained", onClick: saveEdit, disabled: !draft.trim() }, "Save & resend")));
      }
      return /* @__PURE__ */ React9.createElement(
        Box8,
        {
          sx: {
            alignSelf: "flex-end",
            maxWidth: "80%",
            "&:hover .litellm-actions": { opacity: 1 }
          }
        },
        message.metadata?.attachedUrl && /* @__PURE__ */ React9.createElement(Box8, { sx: { display: "flex", justifyContent: "flex-end", mb: 0.5 } }, /* @__PURE__ */ React9.createElement(Tooltip3, { title: message.metadata.attachedUrl.url }, /* @__PURE__ */ React9.createElement(
          Chip4,
          {
            size: "small",
            icon: /* @__PURE__ */ React9.createElement(LinkIcon, { fontSize: "small" }),
            label: message.metadata.attachedUrl.title,
            variant: "outlined",
            ...safeHref(message.metadata.attachedUrl.url) ? {
              component: "a",
              href: safeHref(message.metadata.attachedUrl.url),
              target: "_blank",
              rel: "noopener noreferrer",
              clickable: true
            } : {}
          }
        ))),
        fileParts.length > 0 && /* @__PURE__ */ React9.createElement(Box8, { sx: { display: "flex", flexWrap: "wrap", gap: 0.5, justifyContent: "flex-end", mb: 0.5 } }, fileParts.map(
          (p, i) => p.mediaType.startsWith("image/") ? /* @__PURE__ */ React9.createElement(
            Box8,
            {
              key: i,
              component: "img",
              src: p.url,
              alt: p.filename ?? "attachment",
              sx: { maxWidth: 160, maxHeight: 160, borderRadius: 1 }
            }
          ) : /* @__PURE__ */ React9.createElement(Chip4, { key: i, size: "small", label: p.filename ?? p.mediaType, variant: "outlined" })
        )),
        text && /* @__PURE__ */ React9.createElement(
          Box8,
          {
            sx: {
              bgcolor: "action.hover",
              borderRadius: "12px",
              px: 1.5,
              py: 1,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              textAlign: "right"
            }
          },
          text
        ),
        /* @__PURE__ */ React9.createElement(
          Box8,
          {
            className: "litellm-actions",
            sx: { display: "flex", gap: 0.25, mt: 0.25, justifyContent: "flex-end", opacity: 0, transition: "opacity 0.15s" }
          },
          onEditAndResend && /* @__PURE__ */ React9.createElement(Tooltip3, { title: "Edit & resend" }, /* @__PURE__ */ React9.createElement(IconButton3, { size: "small", "aria-label": "Edit and resend", onClick: startEdit }, /* @__PURE__ */ React9.createElement(EditIcon, { fontSize: "small" }))),
          /* @__PURE__ */ React9.createElement(Tooltip3, { title: copied ? "Copied" : "Copy" }, /* @__PURE__ */ React9.createElement(IconButton3, { size: "small", "aria-label": "Copy", onClick: handleCopy }, copied ? /* @__PURE__ */ React9.createElement(CheckIcon3, { fontSize: "small" }) : /* @__PURE__ */ React9.createElement(ContentCopyIcon3, { fontSize: "small" })))
        )
      );
    };
  }
});

// src/components/MessageList.tsx
import React10 from "react";
import { Box as Box9, Typography as Typography5 } from "@mui/material";
function groupMessages(messages) {
  const groups = [];
  let current = null;
  for (const m of messages) {
    if (m.role === "user") {
      current = { user: m, assistants: [] };
      groups.push(current);
    } else {
      if (!current) {
        current = { assistants: [] };
        groups.push(current);
      }
      current.assistants.push(m);
    }
  }
  return groups;
}
var MessageList;
var init_MessageList = __esm({
  "src/components/MessageList.tsx"() {
    "use strict";
    init_AssistantMessage();
    init_UserMessage();
    MessageList = ({
      messages,
      streamingMessageIds,
      avatarLabel,
      onFeedback,
      onRegenerate,
      onEditAndResend
    }) => {
      const groups = groupMessages(messages);
      return /* @__PURE__ */ React10.createElement(
        Box9,
        {
          sx: {
            flex: 1,
            overflowY: "auto",
            px: 2,
            py: 1,
            display: "flex",
            flexDirection: "column",
            gap: 1.5
          }
        },
        groups.map((group, gi) => /* @__PURE__ */ React10.createElement(React10.Fragment, { key: group.user?.id ?? `g${gi}` }, group.user && /* @__PURE__ */ React10.createElement(UserMessage, { message: group.user, onEditAndResend }), group.assistants.length > 1 ? /* @__PURE__ */ React10.createElement(Box9, { sx: { display: "flex", gap: 1.5, overflowX: "auto", width: "100%" } }, group.assistants.map((msg) => /* @__PURE__ */ React10.createElement(Box9, { key: msg.id, sx: { flex: "1 1 320px", minWidth: 280, maxWidth: "none" } }, msg.metadata?.compareModel && /* @__PURE__ */ React10.createElement(Typography5, { variant: "caption", color: "text.secondary", sx: { display: "block", mb: 0.25 } }, msg.metadata.compareModel), /* @__PURE__ */ React10.createElement(
          AssistantMessage,
          {
            message: msg,
            isStreaming: streamingMessageIds.has(msg.id),
            avatarLabel: msg.metadata?.compareModel ?? avatarLabel,
            onFeedback,
            onRegenerate
          }
        )))) : group.assistants.map((msg) => /* @__PURE__ */ React10.createElement(
          AssistantMessage,
          {
            key: msg.id,
            message: msg,
            isStreaming: streamingMessageIds.has(msg.id),
            avatarLabel,
            onFeedback,
            onRegenerate
          }
        ))))
      );
    };
  }
});

// src/components/ErrorBanner.tsx
import React11 from "react";
import { Alert, AlertTitle } from "@mui/material";
var ErrorBanner;
var init_ErrorBanner = __esm({
  "src/components/ErrorBanner.tsx"() {
    "use strict";
    ErrorBanner = ({ error, onDismiss }) => {
      if (!error) return null;
      return /* @__PURE__ */ React11.createElement(Alert, { severity: "error", onClose: onDismiss, sx: { mb: 1 } }, /* @__PURE__ */ React11.createElement(AlertTitle, null, "Chat error"), error);
    };
  }
});

// src/components/SourcesPanel.tsx
import React12 from "react";
import {
  Accordion as Accordion2,
  AccordionDetails as AccordionDetails2,
  AccordionSummary as AccordionSummary2,
  Box as Box10,
  Chip as Chip5,
  Divider,
  Tooltip as Tooltip4,
  Typography as Typography6
} from "@mui/material";
import ExpandMoreIcon2 from "@mui/icons-material/ExpandMore";
function relevanceLabel(score) {
  if (score >= 0.7) return "High";
  if (score >= 0.4) return "Medium";
  return "Low";
}
function dedupe(citations) {
  const byKey = /* @__PURE__ */ new Map();
  for (const c of citations) {
    const key = (c.url || c.filename || "").toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.bestScore = Math.max(existing.bestScore, c.score);
      if (c.snippet && !existing.snippets.includes(c.snippet)) {
        existing.snippets.push(c.snippet);
      }
    } else {
      byKey.set(key, {
        filename: c.filename,
        url: c.url,
        source: c.source,
        bestScore: c.score,
        snippets: c.snippet ? [c.snippet] : []
      });
    }
  }
  return [...byKey.values()].sort((a, b) => b.bestScore - a.bestScore);
}
function groupSources(citations) {
  const deduped = dedupe(citations);
  const groups = [
    { key: "kb", label: "Knowledge base", items: [] },
    { key: "web", label: "Web", items: [] },
    { key: "other", label: "Other", items: [] }
  ];
  for (const s of deduped) {
    if (s.source === "kb") groups[0].items.push(s);
    else if (s.source === "web") groups[1].items.push(s);
    else groups[2].items.push(s);
  }
  return groups.filter((g) => g.items.length > 0);
}
var SourceRow, SourcesPanel;
var init_SourcesPanel = __esm({
  "src/components/SourcesPanel.tsx"() {
    "use strict";
    init_safeUrl();
    SourceRow = ({ source }) => {
      const href = safeHref(source.url);
      const rel = relevanceLabel(source.bestScore);
      const passages = source.snippets.length;
      return /* @__PURE__ */ React12.createElement(
        Accordion2,
        {
          disableGutters: true,
          variant: "outlined",
          sx: { "&:before": { display: "none" }, mb: 0.5 }
        },
        /* @__PURE__ */ React12.createElement(
          AccordionSummary2,
          {
            expandIcon: /* @__PURE__ */ React12.createElement(ExpandMoreIcon2, { fontSize: "small" }),
            sx: { minHeight: 0, "& .MuiAccordionSummary-content": { my: 0.75, mr: 1 } }
          },
          /* @__PURE__ */ React12.createElement(Box10, { sx: { display: "flex", flexDirection: "column", gap: 0.25, minWidth: 0 } }, /* @__PURE__ */ React12.createElement(
            Typography6,
            {
              variant: "body2",
              fontWeight: 500,
              sx: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
            },
            source.filename
          ), /* @__PURE__ */ React12.createElement(Typography6, { variant: "caption", color: "text.secondary" }, /* @__PURE__ */ React12.createElement(Tooltip4, { title: `Score ${source.bestScore.toFixed(3)}` }, /* @__PURE__ */ React12.createElement("span", null, rel, " relevance")), passages > 1 ? ` \xB7 ${passages} passages` : ""))
        ),
        /* @__PURE__ */ React12.createElement(AccordionDetails2, { sx: { pt: 0 } }, href && /* @__PURE__ */ React12.createElement(Typography6, { variant: "caption", sx: { display: "block", mb: 1 } }, /* @__PURE__ */ React12.createElement("a", { href, target: "_blank", rel: "noopener noreferrer" }, "Open source")), source.snippets.map((snippet, i) => /* @__PURE__ */ React12.createElement(Box10, { key: i }, i > 0 && /* @__PURE__ */ React12.createElement(Divider, { sx: { my: 1 } }), /* @__PURE__ */ React12.createElement(
          Typography6,
          {
            variant: "body2",
            color: "text.secondary",
            sx: { whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto" }
          },
          snippet
        ))), source.snippets.length === 0 && /* @__PURE__ */ React12.createElement(Typography6, { variant: "body2", color: "text.secondary" }, "No excerpt available."))
      );
    };
    SourcesPanel = ({ citations }) => {
      const groups = groupSources(citations);
      const total = groups.reduce((n, g) => n + g.items.length, 0);
      return /* @__PURE__ */ React12.createElement(Box10, { sx: { p: 1.5 } }, /* @__PURE__ */ React12.createElement(Box10, { sx: { display: "flex", alignItems: "center", gap: 1 } }, /* @__PURE__ */ React12.createElement(Typography6, { variant: "overline", color: "text.secondary" }, "Sources"), total > 0 && /* @__PURE__ */ React12.createElement(Chip5, { size: "small", label: total, variant: "outlined" })), total === 0 ? /* @__PURE__ */ React12.createElement(Typography6, { variant: "body2", color: "text.secondary", sx: { mt: 0.5 } }, "No sources for the latest reply yet.") : groups.map((group) => /* @__PURE__ */ React12.createElement(Box10, { key: group.key, sx: { mt: 1 } }, /* @__PURE__ */ React12.createElement(
        Typography6,
        {
          variant: "caption",
          color: "text.secondary",
          sx: { display: "block", mb: 0.5, fontWeight: 600 }
        },
        group.label,
        " (",
        group.items.length,
        ")"
      ), group.items.map((s, i) => /* @__PURE__ */ React12.createElement(SourceRow, { key: `${group.key}-${i}`, source: s })))));
    };
  }
});

// src/components/UsagePanel.tsx
import React13 from "react";
import { Box as Box11, Divider as Divider2, LinearProgress, Typography as Typography7 } from "@mui/material";
function formatUsd(n) {
  return `$${n.toFixed(4)}`;
}
var Stat, UsagePanel;
var init_UsagePanel = __esm({
  "src/components/UsagePanel.tsx"() {
    "use strict";
    Stat = ({ label, value }) => /* @__PURE__ */ React13.createElement(Box11, { sx: { display: "flex", justifyContent: "space-between", py: 0.25 } }, /* @__PURE__ */ React13.createElement(Typography7, { variant: "body2", color: "text.secondary" }, label), /* @__PURE__ */ React13.createElement(Typography7, { variant: "body2", fontWeight: 500 }, value));
    UsagePanel = ({
      lastTurnUsage,
      totalTokens,
      keySpend
    }) => {
      const budgetPct = keySpend?.max_budget && keySpend.max_budget > 0 ? Math.min(100, keySpend.spend / keySpend.max_budget * 100) : null;
      return /* @__PURE__ */ React13.createElement(Box11, { sx: { p: 1.5 } }, /* @__PURE__ */ React13.createElement(Typography7, { variant: "overline", color: "text.secondary" }, "Usage"), !lastTurnUsage && !keySpend ? /* @__PURE__ */ React13.createElement(Typography7, { variant: "body2", color: "text.secondary", sx: { mt: 0.5 } }, "Send a message to see token and budget usage.") : /* @__PURE__ */ React13.createElement(Box11, { sx: { mt: 0.5 } }, lastTurnUsage && /* @__PURE__ */ React13.createElement(React13.Fragment, null, /* @__PURE__ */ React13.createElement(Stat, { label: "This turn", value: `${lastTurnUsage.total_tokens.toLocaleString()} tokens` }), /* @__PURE__ */ React13.createElement(Stat, { label: "Prompt / completion", value: `${lastTurnUsage.prompt_tokens.toLocaleString()} / ${lastTurnUsage.completion_tokens.toLocaleString()}` }), /* @__PURE__ */ React13.createElement(Stat, { label: "Session total", value: `${totalTokens.toLocaleString()} tokens` })), keySpend && /* @__PURE__ */ React13.createElement(React13.Fragment, null, /* @__PURE__ */ React13.createElement(Divider2, { sx: { my: 1 } }), /* @__PURE__ */ React13.createElement(Stat, { label: "Spent", value: formatUsd(keySpend.spend) }), keySpend.max_budget != null && /* @__PURE__ */ React13.createElement(React13.Fragment, null, /* @__PURE__ */ React13.createElement(Stat, { label: "Budget", value: `${formatUsd(keySpend.spend)} / ${formatUsd(keySpend.max_budget)}` }), /* @__PURE__ */ React13.createElement(
        LinearProgress,
        {
          variant: "determinate",
          value: budgetPct ?? 0,
          sx: { mt: 0.5, borderRadius: 1, height: 6 },
          color: budgetPct != null && budgetPct > 90 ? "error" : "primary"
        }
      )))));
    };
  }
});

// src/components/ChatPage.tsx
var ChatPage_exports = {};
__export(ChatPage_exports, {
  ChatPage: () => ChatPage
});
import React14, { useEffect as useEffect4, useMemo as useMemo3, useRef as useRef3, useState as useState7 } from "react";
import {
  Box as Box12,
  Button as Button2,
  Collapse as Collapse2,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton as IconButton4,
  Divider as Divider3,
  Typography as Typography8,
  Tooltip as Tooltip5,
  InputBase,
  Menu,
  MenuItem as MenuItem3,
  ListItemIcon,
  Chip as Chip6
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SettingsIcon2 from "@mui/icons-material/Settings";
import ChatIcon from "@mui/icons-material/Chat";
import SendIcon from "@mui/icons-material/Send";
import StopIcon from "@mui/icons-material/Stop";
import SearchIcon from "@mui/icons-material/Search";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LinkIcon2 from "@mui/icons-material/Link";
import CloseIcon from "@mui/icons-material/Close";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import ExpandMoreIcon3 from "@mui/icons-material/ExpandMore";
import HistoryIcon from "@mui/icons-material/History";
import { convertFileListToFileUIParts } from "ai";
import { useApi as useApi4, identityApiRef } from "@backstage/core-plugin-api";
function threadMatchesQuery(thread, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (thread.title.toLowerCase().includes(q)) return true;
  return thread.messages.some((m) => extractText(m).toLowerCase().includes(q));
}
function sortThreads(threads) {
  return [...threads].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}
var SIDEBAR_WIDTH, SIDEBAR_RAIL_WIDTH, RIGHT_RAIL_WIDTH, CHAT_MAX_WIDTH, URL_TOKEN_RE, URL_PREVIEW_DEBOUNCE_MS, KEY_REMINT_SKEW_MS, MAX_ATTACHMENTS_PER_MESSAGE, ALLOWED_ATTACHMENT_MEDIA_TYPES, ChatPage;
var init_ChatPage = __esm({
  "src/components/ChatPage.tsx"() {
    "use strict";
    init_api();
    init_useThreads();
    init_messageShape();
    init_theme();
    init_ChatSettingsPanel();
    init_MessageList();
    init_ErrorBanner();
    init_SourcesPanel();
    init_UsagePanel();
    SIDEBAR_WIDTH = 280;
    SIDEBAR_RAIL_WIDTH = 48;
    RIGHT_RAIL_WIDTH = 300;
    CHAT_MAX_WIDTH = 900;
    URL_TOKEN_RE = /#(https:\/\/\S+)/;
    URL_PREVIEW_DEBOUNCE_MS = 500;
    KEY_REMINT_SKEW_MS = 6e4;
    MAX_ATTACHMENTS_PER_MESSAGE = 4;
    ALLOWED_ATTACHMENT_MEDIA_TYPES = "image/png,image/jpeg,image/webp,image/gif";
    ChatPage = () => {
      const chatApi = useApi4(aiConversationApiRef);
      const identityApi = useApi4(identityApiRef);
      const [userId, setUserId] = useState7("default");
      const [config, setConfig] = useState7({
        defaultModel: null,
        defaultVectorStoreIds: null,
        maxRequestBudget: null,
        persistence: { enabled: false, ttlDays: 30 }
      });
      const [model, setModel] = useState7("");
      const [vectorStoreIds, setVectorStoreIds] = useState7([]);
      const [webSearch, setWebSearch] = useState7(false);
      const [customSystemPrompt, setCustomSystemPrompt] = useState7("");
      const [toneId, setToneId] = useState7("");
      const [focusId, setFocusId] = useState7("");
      const [verbosityId, setVerbosityId] = useState7("");
      const [reasoningEffort, setReasoningEffort] = useState7("");
      const [keyVal, setKeyVal] = useState7({
        alias: "",
        token: ""
      });
      const [skillId, setSkillId] = useState7("");
      const [skills, setSkills] = useState7([]);
      const [showSettings, setShowSettings] = useState7(true);
      const [input, setInput] = useState7("");
      const [configError, setConfigError] = useState7(null);
      const [searchQuery, setSearchQuery] = useState7("");
      const [historyOpen, setHistoryOpen] = useState7(false);
      const [sidebarCollapsed, setSidebarCollapsed] = useState7(false);
      const [rightPanelCollapsed, setRightPanelCollapsed] = useState7(false);
      const [threadMenuAnchor, setThreadMenuAnchor] = useState7(null);
      const [threadMenuTarget, setThreadMenuTarget] = useState7(null);
      const [importError, setImportError] = useState7(null);
      const [urlPreview, setUrlPreview] = useState7(null);
      const [urlPreviewLoading, setUrlPreviewLoading] = useState7(false);
      const [urlPreviewError, setUrlPreviewError] = useState7(null);
      const [dismissedUrl, setDismissedUrl] = useState7(null);
      const [traits, setTraits] = useState7({ tones: [], focuses: [], verbosities: [] });
      const [traitsLoading, setTraitsLoading] = useState7(true);
      const [stagedFiles, setStagedFiles] = useState7([]);
      const [attachError, setAttachError] = useState7(null);
      const messagesEndRef = useRef3(null);
      const messagesContainerRef = useRef3(null);
      const importInputRef = useRef3(null);
      const attachInputRef = useRef3(null);
      const pendingSendRef = useRef3(null);
      useEffect4(() => {
        injectDesignSystemAssets();
        chatApi.getChatConfig().then(setConfig).catch((err) => setConfigError(err.message ?? "Failed to reach the chat backend"));
        chatApi.getChatTraits().then((t) => {
          setTraits(t);
          setToneId((prev) => prev || t.tones[0]?.id || "");
          setFocusId((prev) => prev || t.focuses[0]?.id || "");
          setVerbosityId((prev) => prev || t.verbosities[0]?.id || "");
        }).catch(() => {
        }).finally(() => setTraitsLoading(false));
        chatApi.listSkills().then(setSkills).catch(() => {
        });
        identityApi.getCredentials().then((c) => setUserId(c.token ? "oidc" : "default")).catch(() => {
        });
      }, [chatApi, identityApi]);
      const chat = useThreads({
        userId,
        model,
        vectorStoreIds,
        customSystemPrompt,
        toneId,
        focusId,
        verbosityId,
        reasoningEffort,
        keyAlias: keyVal.alias,
        keyToken: keyVal.token,
        keyExpiresAt: keyVal.expiresAt,
        skillId,
        topK: 5,
        webSearch,
        persistenceEnabled: config.persistence.enabled,
        onKeyChange: setKeyVal
      });
      const activeThreadId = chat.activeThread?.id ?? null;
      useEffect4(() => {
        if (!chat.activeThread) return;
        setModel(chat.activeThread.model);
        setVectorStoreIds(chat.activeThread.vectorStoreIds);
        setCustomSystemPrompt(chat.activeThread.customSystemPrompt ?? "");
        setToneId(chat.activeThread.toneId ?? "");
        setFocusId(chat.activeThread.focusId ?? "");
        setVerbosityId(chat.activeThread.verbosityId ?? "");
        setReasoningEffort(chat.activeThread.reasoningEffort ?? "");
        setKeyVal({
          alias: chat.activeThread.keyAlias,
          token: chat.activeThread.keyToken,
          expiresAt: chat.activeThread.keyExpiresAt
        });
        setSkillId(chat.activeThread.skillId ?? "");
        setWebSearch(!!chat.activeThread.webSearch);
      }, [activeThreadId]);
      useEffect4(() => {
        if (!pendingSendRef.current || !activeThreadId) return;
        const pending = pendingSendRef.current;
        pendingSendRef.current = null;
        chat.sendMessage(pending.text, pending.attachedUrl, void 0, pending.files);
      }, [activeThreadId]);
      const messages = useMemo3(() => chat.activeThread?.messages ?? [], [
        chat.activeThread
      ]);
      const isStreaming = chat.isStreaming;
      useEffect4(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [messages, isStreaming]);
      useEffect4(() => {
        const match = input.match(URL_TOKEN_RE);
        const url = match?.[1];
        if (!url) {
          setUrlPreview(null);
          setUrlPreviewError(null);
          setUrlPreviewLoading(false);
          return void 0;
        }
        if (url === dismissedUrl || url === urlPreview?.url) return void 0;
        setUrlPreviewLoading(true);
        setUrlPreviewError(null);
        const timer = setTimeout(() => {
          chatApi.fetchUrlContext(url).then((result) => {
            setUrlPreview(result);
            setUrlPreviewLoading(false);
          }).catch((err) => {
            setUrlPreviewError(err.message ?? "Failed to fetch that page");
            setUrlPreviewLoading(false);
          });
        }, URL_PREVIEW_DEBOUNCE_MS);
        return () => clearTimeout(timer);
      }, [input, dismissedUrl]);
      const visibleThreads = useMemo3(
        () => sortThreads(chat.threads.filter((t) => threadMatchesQuery(t, searchQuery))),
        [chat.threads, searchQuery]
      );
      const handleSkillChange = (id) => {
        setSkillId(id);
        const skill = skills.find((s) => s.id === id);
        if (!skill) return;
        if (skill.defaultModel) setModel(skill.defaultModel);
        if (skill.defaultVectorStoreIds?.length) setVectorStoreIds(skill.defaultVectorStoreIds);
      };
      const handleSend = async () => {
        if (!input.trim() || isStreaming) return;
        let currentKey = keyVal;
        const expired = !!currentKey.expiresAt && currentKey.expiresAt - Date.now() < KEY_REMINT_SKEW_MS;
        if (!currentKey.token || expired && !chat.activeThread) {
          try {
            const keyInfo = await chatApi.mintChatKey();
            currentKey = {
              alias: keyInfo.key_alias,
              token: keyInfo.key,
              expiresAt: keyInfo.expires_at ? Date.parse(keyInfo.expires_at) : void 0
            };
            setKeyVal(currentKey);
          } catch {
            return;
          }
        }
        const text = input.trim();
        const activeUrlMatch = text.match(URL_TOKEN_RE)?.[1];
        const attachedUrl = activeUrlMatch && urlPreview?.url === activeUrlMatch && activeUrlMatch !== dismissedUrl ? { url: urlPreview.url, title: urlPreview.title } : void 0;
        const files = stagedFiles.length > 0 ? stagedFiles : void 0;
        if (!chat.activeThread) {
          pendingSendRef.current = { text, attachedUrl, files };
          chat.newThread(currentKey);
        } else {
          chat.sendMessage(text, attachedUrl, void 0, files);
        }
        setInput("");
        setUrlPreview(null);
        setUrlPreviewError(null);
        setDismissedUrl(null);
        setStagedFiles([]);
      };
      const dismissUrlPreview = () => {
        if (urlPreview) setDismissedUrl(urlPreview.url);
        else {
          const match = input.match(URL_TOKEN_RE)?.[1];
          if (match) setDismissedUrl(match);
        }
        setUrlPreview(null);
        setUrlPreviewError(null);
      };
      const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      };
      const openThreadMenu = (e, threadId) => {
        e.stopPropagation();
        setThreadMenuAnchor(e.currentTarget);
        setThreadMenuTarget(threadId);
      };
      const closeThreadMenu = () => {
        setThreadMenuAnchor(null);
        setThreadMenuTarget(null);
      };
      const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        try {
          await chat.importThread(file);
          setImportError(null);
        } catch (err) {
          setImportError(err.message ?? "Failed to import thread");
        }
      };
      const handleAttachFiles = async (e) => {
        const fileList = e.target.files ?? void 0;
        e.target.value = "";
        if (!fileList?.length) return;
        if (stagedFiles.length + fileList.length > MAX_ATTACHMENTS_PER_MESSAGE) {
          setAttachError(`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} images per message`);
          return;
        }
        try {
          const parts = await convertFileListToFileUIParts(fileList);
          setStagedFiles((prev) => [...prev, ...parts]);
          setAttachError(null);
        } catch {
          setAttachError("Failed to read attached file");
        }
      };
      const removeStagedFile = (index) => {
        setStagedFiles((prev) => prev.filter((_, i) => i !== index));
      };
      const menuTargetThread = chat.threads.find((t) => t.id === threadMenuTarget) ?? null;
      const lastTurnUsage = chat.activeThread?.lastTurnUsage ?? null;
      const totalTokens = chat.activeThread?.totalTokens ?? 0;
      const statusParts = [];
      if (lastTurnUsage) {
        statusParts.push(`${lastTurnUsage.total_tokens.toLocaleString()} tokens this turn`);
      }
      if (chat.keySpend) {
        statusParts.push(`$${chat.keySpend.spend.toFixed(4)} spent`);
        if (chat.keySpend.max_budget != null) {
          statusParts.push(`$${chat.keySpend.spend.toFixed(2)} / $${chat.keySpend.max_budget.toFixed(2)} budget`);
        }
      }
      let persistenceTooltip;
      if (config.persistence.enabled) {
        persistenceTooltip = config.persistence.ttlDays > 0 ? `Threads are saved to your account and auto-deleted after ${config.persistence.ttlDays} days of inactivity.` : "Threads are saved to your account and kept indefinitely.";
      } else {
        persistenceTooltip = "Threads are stored only in this browser (localStorage) and are lost if browser data is cleared.";
      }
      let urlPreviewChip = null;
      if (urlPreviewLoading) {
        urlPreviewChip = /* @__PURE__ */ React14.createElement(Chip6, { size: "small", icon: /* @__PURE__ */ React14.createElement(LinkIcon2, { fontSize: "small" }), label: "Fetching page\u2026", variant: "outlined" });
      } else if (urlPreviewError) {
        urlPreviewChip = /* @__PURE__ */ React14.createElement(
          Chip6,
          {
            size: "small",
            color: "error",
            icon: /* @__PURE__ */ React14.createElement(LinkIcon2, { fontSize: "small" }),
            label: urlPreviewError,
            variant: "outlined",
            onDelete: dismissUrlPreview,
            deleteIcon: /* @__PURE__ */ React14.createElement(CloseIcon, { fontSize: "small" })
          }
        );
      } else if (urlPreview) {
        urlPreviewChip = /* @__PURE__ */ React14.createElement(Tooltip5, { title: urlPreview.url }, /* @__PURE__ */ React14.createElement(
          Chip6,
          {
            size: "small",
            icon: /* @__PURE__ */ React14.createElement(LinkIcon2, { fontSize: "small" }),
            label: `Page attached: ${urlPreview.title}`,
            variant: "outlined",
            onDelete: dismissUrlPreview,
            deleteIcon: /* @__PURE__ */ React14.createElement(CloseIcon, { fontSize: "small" })
          }
        ));
      }
      return /* @__PURE__ */ React14.createElement(Box12, { sx: { display: "flex", height: "100dvh", overflow: "hidden" } }, /* @__PURE__ */ React14.createElement(
        Box12,
        {
          sx: {
            width: sidebarCollapsed ? SIDEBAR_RAIL_WIDTH : SIDEBAR_WIDTH,
            flexShrink: 0,
            borderRight: 1,
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transition: "width 0.15s"
          }
        },
        /* @__PURE__ */ React14.createElement(Box12, { sx: { display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "flex-end", px: 0.5, py: 0.5 } }, /* @__PURE__ */ React14.createElement(Tooltip5, { title: sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar" }, /* @__PURE__ */ React14.createElement(IconButton4, { size: "small", onClick: () => setSidebarCollapsed((v) => !v) }, sidebarCollapsed ? /* @__PURE__ */ React14.createElement(ChevronRightIcon, { fontSize: "small" }) : /* @__PURE__ */ React14.createElement(ChevronLeftIcon, { fontSize: "small" })))),
        sidebarCollapsed ? /* @__PURE__ */ React14.createElement(Box12, { sx: { display: "flex", flexDirection: "column", alignItems: "center", gap: 1, pt: 1 } }, /* @__PURE__ */ React14.createElement(Tooltip5, { title: "New chat", placement: "right" }, /* @__PURE__ */ React14.createElement(IconButton4, { onClick: () => chat.newThread() }, /* @__PURE__ */ React14.createElement(AddIcon, null))), /* @__PURE__ */ React14.createElement(Tooltip5, { title: "Settings", placement: "right" }, /* @__PURE__ */ React14.createElement(IconButton4, { onClick: () => setSidebarCollapsed(false) }, /* @__PURE__ */ React14.createElement(SettingsIcon2, null)))) : /* @__PURE__ */ React14.createElement(React14.Fragment, null, /* @__PURE__ */ React14.createElement(
          ChatSettingsPanel,
          {
            showSettings,
            onToggleShowSettings: () => setShowSettings((v) => !v),
            configError,
            config,
            traits,
            traitsLoading,
            skills,
            skillId,
            onSkillChange: handleSkillChange,
            toneId,
            onToneChange: setToneId,
            focusId,
            onFocusChange: setFocusId,
            customSystemPrompt,
            onCustomSystemPromptChange: setCustomSystemPrompt,
            model,
            onModelChange: setModel,
            vectorStoreIds,
            onVectorStoreIdsChange: setVectorStoreIds,
            webSearch,
            onWebSearchChange: setWebSearch,
            verbosityId,
            onVerbosityChange: setVerbosityId,
            reasoningEffort,
            onReasoningEffortChange: setReasoningEffort
          }
        ), /* @__PURE__ */ React14.createElement(Divider3, null), /* @__PURE__ */ React14.createElement(Box12, { sx: { p: 1.5, display: "flex", gap: 1 } }, /* @__PURE__ */ React14.createElement(
          Button2,
          {
            fullWidth: true,
            variant: "outlined",
            startIcon: /* @__PURE__ */ React14.createElement(AddIcon, null),
            onClick: () => chat.newThread(),
            size: "small"
          },
          "New chat"
        ), /* @__PURE__ */ React14.createElement(Tooltip5, { title: "Import thread" }, /* @__PURE__ */ React14.createElement(IconButton4, { size: "small", onClick: () => importInputRef.current?.click() }, /* @__PURE__ */ React14.createElement(FileUploadIcon, { fontSize: "small" }))), /* @__PURE__ */ React14.createElement(
          "input",
          {
            ref: importInputRef,
            type: "file",
            accept: "application/json",
            hidden: true,
            onChange: handleImportFile
          }
        )), importError && /* @__PURE__ */ React14.createElement(Box12, { sx: { px: 1.5, pb: 1 } }, /* @__PURE__ */ React14.createElement(Typography8, { variant: "caption", color: "error" }, importError)), /* @__PURE__ */ React14.createElement(
          Box12,
          {
            sx: {
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              px: 1.5,
              py: 1,
              bgcolor: "action.hover"
            },
            onClick: () => setHistoryOpen((v) => !v)
          },
          /* @__PURE__ */ React14.createElement(HistoryIcon, { fontSize: "small", sx: { mr: 1 } }),
          /* @__PURE__ */ React14.createElement(Typography8, { variant: "overline", sx: { flex: 1 } }, "History"),
          config.persistence.enabled && /* @__PURE__ */ React14.createElement(Tooltip5, { title: persistenceTooltip }, /* @__PURE__ */ React14.createElement(Typography8, { variant: "caption", color: "text.secondary", sx: { mr: 0.5 } }, config.persistence.ttlDays > 0 ? `${config.persistence.ttlDays}d` : "saved")),
          /* @__PURE__ */ React14.createElement(
            ExpandMoreIcon3,
            {
              fontSize: "small",
              sx: {
                transform: historyOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.2s"
              }
            }
          )
        ), /* @__PURE__ */ React14.createElement(Collapse2, { in: historyOpen }, /* @__PURE__ */ React14.createElement(Box12, { sx: { display: "flex", flexDirection: "column", minHeight: 0 } }, /* @__PURE__ */ React14.createElement(Box12, { sx: { px: 1.5, pb: 1 } }, /* @__PURE__ */ React14.createElement(
          InputBase,
          {
            fullWidth: true,
            placeholder: "Search threads\u2026",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            startAdornment: /* @__PURE__ */ React14.createElement(SearchIcon, { fontSize: "small", sx: { mr: 0.75, color: "text.secondary" } }),
            sx: {
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              px: 1,
              py: 0.5,
              fontSize: "0.85rem"
            }
          }
        )), /* @__PURE__ */ React14.createElement(Box12, { sx: { flex: 1, overflowY: "auto", minHeight: 0 } }, /* @__PURE__ */ React14.createElement(List, { dense: true }, visibleThreads.map((t) => /* @__PURE__ */ React14.createElement(
          ListItem,
          {
            key: t.id,
            disablePadding: true,
            secondaryAction: /* @__PURE__ */ React14.createElement(IconButton4, { edge: "end", size: "small", onClick: (e) => openThreadMenu(e, t.id) }, /* @__PURE__ */ React14.createElement(MoreVertIcon, { fontSize: "small" }))
          },
          /* @__PURE__ */ React14.createElement(
            ListItemButton,
            {
              selected: chat.activeThread?.id === t.id,
              onClick: () => chat.selectThread(t.id),
              sx: { pr: 6 }
            },
            t.pinned && /* @__PURE__ */ React14.createElement(PushPinIcon, { fontSize: "small", sx: { mr: 0.75, color: "text.secondary" } }),
            /* @__PURE__ */ React14.createElement(
              ListItemText,
              {
                primary: t.title,
                primaryTypographyProps: { noWrap: true, variant: "body2" },
                secondaryTypographyProps: { noWrap: true, variant: "caption" }
              }
            )
          )
        )), visibleThreads.length === 0 && /* @__PURE__ */ React14.createElement(Typography8, { variant: "caption", color: "text.secondary", sx: { px: 2, py: 1, display: "block" } }, searchQuery ? "No threads match your search." : "No threads yet."))))), /* @__PURE__ */ React14.createElement(Menu, { anchorEl: threadMenuAnchor, open: !!threadMenuAnchor, onClose: closeThreadMenu }, /* @__PURE__ */ React14.createElement(
          MenuItem3,
          {
            onClick: () => {
              if (threadMenuTarget) chat.togglePin(threadMenuTarget);
              closeThreadMenu();
            }
          },
          /* @__PURE__ */ React14.createElement(ListItemIcon, null, menuTargetThread?.pinned ? /* @__PURE__ */ React14.createElement(PushPinIcon, { fontSize: "small" }) : /* @__PURE__ */ React14.createElement(PushPinOutlinedIcon, { fontSize: "small" })),
          menuTargetThread?.pinned ? "Unpin" : "Pin"
        ), /* @__PURE__ */ React14.createElement(
          MenuItem3,
          {
            onClick: () => {
              if (threadMenuTarget) chat.exportThread(threadMenuTarget);
              closeThreadMenu();
            }
          },
          /* @__PURE__ */ React14.createElement(ListItemIcon, null, /* @__PURE__ */ React14.createElement(FileDownloadIcon, { fontSize: "small" })),
          "Export"
        ), /* @__PURE__ */ React14.createElement(
          MenuItem3,
          {
            onClick: () => {
              if (threadMenuTarget) chat.deleteThread(threadMenuTarget);
              closeThreadMenu();
            }
          },
          /* @__PURE__ */ React14.createElement(ListItemIcon, null, /* @__PURE__ */ React14.createElement(DeleteIcon, { fontSize: "small" })),
          "Delete"
        )))
      ), /* @__PURE__ */ React14.createElement(
        Box12,
        {
          sx: {
            flex: 3,
            display: "flex",
            justifyContent: "center",
            overflow: "hidden"
          }
        },
        /* @__PURE__ */ React14.createElement(
          Box12,
          {
            sx: {
              width: "100%",
              maxWidth: CHAT_MAX_WIDTH,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }
          },
          /* @__PURE__ */ React14.createElement(
            Box12,
            {
              sx: {
                flexShrink: 0,
                px: 2,
                py: 1,
                borderBottom: 1,
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                gap: 1
              }
            },
            /* @__PURE__ */ React14.createElement(ChatIcon, { fontSize: "small", color: "action" }),
            /* @__PURE__ */ React14.createElement(Typography8, { variant: "subtitle2", noWrap: true, sx: { flex: 1 } }, chat.activeThread?.title ?? "AI Chat"),
            /* @__PURE__ */ React14.createElement(Tooltip5, { title: rightPanelCollapsed ? "Show context panel" : "Hide context panel" }, /* @__PURE__ */ React14.createElement(IconButton4, { size: "small", onClick: () => setRightPanelCollapsed((v) => !v) }, rightPanelCollapsed ? /* @__PURE__ */ React14.createElement(ChevronLeftIcon, { fontSize: "small" }) : /* @__PURE__ */ React14.createElement(ChevronRightIcon, { fontSize: "small" })))
          ),
          chat.error && /* @__PURE__ */ React14.createElement(Box12, { sx: { px: 2, pt: 1 } }, /* @__PURE__ */ React14.createElement(ErrorBanner, { error: chat.error, onDismiss: () => {
          } })),
          /* @__PURE__ */ React14.createElement(
            Box12,
            {
              ref: messagesContainerRef,
              sx: {
                flex: 1,
                overflowY: "auto",
                minHeight: 0
              }
            },
            messages.length === 0 ? /* @__PURE__ */ React14.createElement(Box12, { sx: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React14.createElement(Typography8, { color: "text.secondary" }, "Start a conversation\u2026")) : /* @__PURE__ */ React14.createElement(
              MessageList,
              {
                messages,
                streamingMessageIds: chat.streamingMessageIds,
                onFeedback: chat.submitFeedback,
                onRegenerate: chat.regenerateFrom,
                onEditAndResend: chat.editAndResend
              }
            ),
            /* @__PURE__ */ React14.createElement("div", { ref: messagesEndRef })
          ),
          (urlPreviewLoading || urlPreview || urlPreviewError) && /* @__PURE__ */ React14.createElement(Box12, { sx: { px: 2, pt: 1 } }, urlPreviewChip),
          (stagedFiles.length > 0 || attachError) && /* @__PURE__ */ React14.createElement(Box12, { sx: { px: 2, pt: 1, display: "flex", gap: 0.5, flexWrap: "wrap" } }, stagedFiles.map((f, i) => /* @__PURE__ */ React14.createElement(
            Chip6,
            {
              key: i,
              size: "small",
              icon: /* @__PURE__ */ React14.createElement(AttachFileIcon, { fontSize: "small" }),
              label: f.filename ?? f.mediaType,
              variant: "outlined",
              onDelete: () => removeStagedFile(i),
              deleteIcon: /* @__PURE__ */ React14.createElement(CloseIcon, { fontSize: "small" })
            }
          )), attachError && /* @__PURE__ */ React14.createElement(
            Chip6,
            {
              size: "small",
              color: "error",
              label: attachError,
              variant: "outlined",
              onDelete: () => setAttachError(null),
              deleteIcon: /* @__PURE__ */ React14.createElement(CloseIcon, { fontSize: "small" })
            }
          )),
          /* @__PURE__ */ React14.createElement(
            Box12,
            {
              sx: {
                flexShrink: 0,
                borderTop: 1,
                borderColor: "divider",
                px: 2,
                py: 1.5,
                display: "flex",
                gap: 1,
                alignItems: "flex-end"
              }
            },
            /* @__PURE__ */ React14.createElement(Tooltip5, { title: "Attach image" }, /* @__PURE__ */ React14.createElement(IconButton4, { size: "small", onClick: () => attachInputRef.current?.click() }, /* @__PURE__ */ React14.createElement(AttachFileIcon, { fontSize: "small" }))),
            /* @__PURE__ */ React14.createElement(
              "input",
              {
                ref: attachInputRef,
                type: "file",
                accept: ALLOWED_ATTACHMENT_MEDIA_TYPES,
                multiple: true,
                hidden: true,
                onChange: handleAttachFiles
              }
            ),
            /* @__PURE__ */ React14.createElement(
              InputBase,
              {
                multiline: true,
                minRows: 1,
                maxRows: 5,
                fullWidth: true,
                placeholder: "Send a message\u2026  (Enter to send, Shift+Enter for newline)",
                value: input,
                onChange: (e) => setInput(e.target.value),
                onKeyDown: handleKeyDown,
                sx: {
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  px: 1.5,
                  py: 0.75,
                  fontSize: "0.9rem"
                }
              }
            ),
            isStreaming ? /* @__PURE__ */ React14.createElement(Tooltip5, { title: "Stop" }, /* @__PURE__ */ React14.createElement(IconButton4, { color: "error", onClick: chat.stopGeneration }, /* @__PURE__ */ React14.createElement(StopIcon, null))) : /* @__PURE__ */ React14.createElement(Tooltip5, { title: "Send" }, /* @__PURE__ */ React14.createElement(
              IconButton4,
              {
                color: "primary",
                onClick: handleSend,
                disabled: !input.trim()
              },
              /* @__PURE__ */ React14.createElement(SendIcon, null)
            ))
          ),
          statusParts.length > 0 && /* @__PURE__ */ React14.createElement(Box12, { sx: { px: 2, pb: 1 } }, /* @__PURE__ */ React14.createElement(Typography8, { variant: "caption", color: "text.secondary" }, statusParts.join(" \xB7 ")))
        )
      ), !rightPanelCollapsed && /* @__PURE__ */ React14.createElement(
        Box12,
        {
          sx: {
            width: RIGHT_RAIL_WIDTH,
            flexShrink: 0,
            borderLeft: 1,
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto"
          }
        },
        /* @__PURE__ */ React14.createElement(SourcesPanel, { citations: chat.citations }),
        /* @__PURE__ */ React14.createElement(Divider3, null),
        /* @__PURE__ */ React14.createElement(
          UsagePanel,
          {
            lastTurnUsage,
            totalTokens,
            keySpend: chat.keySpend
          }
        )
      ));
    };
  }
});

// src/components/BarList.tsx
import React15 from "react";
import { Box as Box13, Typography as Typography9 } from "@mui/material";
var BarList;
var init_BarList = __esm({
  "src/components/BarList.tsx"() {
    "use strict";
    BarList = ({ rows, emptyLabel = "No data yet." }) => {
      if (rows.length === 0) {
        return /* @__PURE__ */ React15.createElement(Typography9, { variant: "body2", color: "text.secondary" }, emptyLabel);
      }
      const max = Math.max(...rows.map((r) => r.count), 1);
      return /* @__PURE__ */ React15.createElement(Box13, { sx: { display: "flex", flexDirection: "column", gap: 1 } }, rows.map((row) => /* @__PURE__ */ React15.createElement(Box13, { key: row.key, sx: { display: "flex", alignItems: "center", gap: 1 } }, /* @__PURE__ */ React15.createElement(Typography9, { variant: "body2", sx: { width: 180, flexShrink: 0 }, noWrap: true, title: row.key }, row.key), /* @__PURE__ */ React15.createElement(Box13, { sx: { flex: 1, bgcolor: "action.hover", borderRadius: 1, overflow: "hidden", height: 18 } }, /* @__PURE__ */ React15.createElement(
        Box13,
        {
          sx: {
            width: `${row.count / max * 100}%`,
            height: "100%",
            bgcolor: "primary.main",
            borderRadius: 1
          }
        }
      )), /* @__PURE__ */ React15.createElement(Typography9, { variant: "body2", sx: { width: 40, textAlign: "right", flexShrink: 0 } }, row.count))));
    };
  }
});

// src/components/AnalyticsPage.tsx
var AnalyticsPage_exports = {};
__export(AnalyticsPage_exports, {
  AnalyticsPage: () => AnalyticsPage
});
import React16, { useEffect as useEffect5, useState as useState8 } from "react";
import { Box as Box14, Paper, Select as Select3, MenuItem as MenuItem4, Typography as Typography10, Alert as Alert2 } from "@mui/material";
import { useApi as useApi5 } from "@backstage/core-plugin-api";
var RANGES, AnalyticsPage;
var init_AnalyticsPage = __esm({
  "src/components/AnalyticsPage.tsx"() {
    "use strict";
    init_api();
    init_BarList();
    RANGES = [
      { value: "24h", label: "Last 24 hours" },
      { value: "7d", label: "Last 7 days" },
      { value: "30d", label: "Last 30 days" },
      { value: "all", label: "All time" }
    ];
    AnalyticsPage = () => {
      const chatApi = useApi5(aiConversationApiRef);
      const [range, setRange] = useState8("30d");
      const [bySkill, setBySkill] = useState8([]);
      const [byModel, setByModel] = useState8([]);
      const [feedback, setFeedback] = useState8(null);
      const [error, setError] = useState8(null);
      const [loading, setLoading] = useState8(true);
      useEffect5(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        Promise.all([
          chatApi.getUsageSummary("skill", range),
          chatApi.getUsageSummary("model", range),
          chatApi.getFeedbackSummary()
        ]).then(([skill, model, fb]) => {
          if (!alive) return;
          setBySkill(skill);
          setByModel(model);
          setFeedback(fb);
        }).catch((err) => {
          if (alive) setError(err.message ?? "Failed to load analytics");
        }).finally(() => alive && setLoading(false));
        return () => {
          alive = false;
        };
      }, [chatApi, range]);
      const feedbackRows = feedback ? [{ key: "\u{1F44D} up", count: feedback.up }, { key: "\u{1F44E} down", count: feedback.down }] : [];
      return /* @__PURE__ */ React16.createElement(Box14, { sx: { p: 3, maxWidth: 900, mx: "auto" } }, /* @__PURE__ */ React16.createElement(Box14, { sx: { display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 } }, /* @__PURE__ */ React16.createElement(Typography10, { variant: "h5" }, "AI Chat analytics"), /* @__PURE__ */ React16.createElement(Select3, { size: "small", value: range, onChange: (e) => setRange(e.target.value) }, RANGES.map((r) => /* @__PURE__ */ React16.createElement(MenuItem4, { key: r.value, value: r.value }, r.label)))), error && /* @__PURE__ */ React16.createElement(Alert2, { severity: "error", sx: { mb: 2 } }, error), /* @__PURE__ */ React16.createElement(Box14, { sx: { display: "flex", flexDirection: "column", gap: 2 } }, /* @__PURE__ */ React16.createElement(Paper, { variant: "outlined", sx: { p: 2 } }, /* @__PURE__ */ React16.createElement(Typography10, { variant: "subtitle1", sx: { mb: 1.5 } }, "Turns by skill"), /* @__PURE__ */ React16.createElement(BarList, { rows: bySkill, emptyLabel: loading ? "Loading\u2026" : "No chat turns in this range." })), /* @__PURE__ */ React16.createElement(Paper, { variant: "outlined", sx: { p: 2 } }, /* @__PURE__ */ React16.createElement(Typography10, { variant: "subtitle1", sx: { mb: 1.5 } }, "Turns by model"), /* @__PURE__ */ React16.createElement(BarList, { rows: byModel, emptyLabel: loading ? "Loading\u2026" : "No chat turns in this range." })), /* @__PURE__ */ React16.createElement(Paper, { variant: "outlined", sx: { p: 2 } }, /* @__PURE__ */ React16.createElement(Typography10, { variant: "subtitle1", sx: { mb: 1.5 } }, "Feedback (all time)"), /* @__PURE__ */ React16.createElement(BarList, { rows: feedbackRows, emptyLabel: loading ? "Loading\u2026" : "No feedback recorded yet." }))));
    };
  }
});

// src/plugin.tsx
init_api();
import React17 from "react";
import { Chat as ChatIcon2, BarChart as BarChartIcon } from "@mui/icons-material";
import {
  createFrontendPlugin,
  ApiBlueprint,
  PageBlueprint,
  fetchApiRef as fetchApiRef2
} from "@backstage/frontend-plugin-api";
var liteLlmChatApi = ApiBlueprint.make({
  params: (defineParams) => defineParams({
    api: aiConversationApiRef,
    deps: { fetchApi: fetchApiRef2 },
    factory: ({ fetchApi }) => new AiConversationApi(fetchApi)
  })
});
var chatPage = PageBlueprint.make({
  params: {
    path: "/ai-conversation",
    title: "AI Chat",
    icon: /* @__PURE__ */ React17.createElement(ChatIcon2, null),
    loader: async () => {
      const { ChatPage: ChatPage2 } = await Promise.resolve().then(() => (init_ChatPage(), ChatPage_exports));
      return /* @__PURE__ */ React17.createElement(ChatPage2, null);
    }
  }
});
var analyticsPage = PageBlueprint.make({
  name: "analytics",
  params: {
    path: "/ai-conversation/analytics",
    title: "AI Chat Analytics",
    icon: /* @__PURE__ */ React17.createElement(BarChartIcon, null),
    loader: async () => {
      const { AnalyticsPage: AnalyticsPage2 } = await Promise.resolve().then(() => (init_AnalyticsPage(), AnalyticsPage_exports));
      return /* @__PURE__ */ React17.createElement(AnalyticsPage2, null);
    }
  }
});
var aiConversationPlugin = createFrontendPlugin({
  pluginId: "ai-conversation",
  extensions: [liteLlmChatApi, chatPage, analyticsPage]
});

// src/index.ts
init_ChatPage();
init_AnalyticsPage();
init_api();
export {
  AiConversationApi,
  AnalyticsPage,
  ChatPage,
  aiConversationApiRef,
  aiConversationPlugin
};
//# sourceMappingURL=index.esm.js.map
