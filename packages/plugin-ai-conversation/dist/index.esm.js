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
    personaId: typeof raw.personaId === "string" ? raw.personaId : "",
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
      async listPersonas() {
        const res = await this.fetchApi.fetch(`${BASE_PATH}/personas`);
        if (!res.ok) throw new Error(`personas ${res.status}`);
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
        if (filters?.personaId) params.set("personaId", filters.personaId);
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
      async chatCompletions(req) {
        const res = await this.fetchApi.fetch(`${BASE_PATH}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...req, stream: false })
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`${res.status}: ${text}`);
        }
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content ?? data.content ?? "";
        const rawResults = data.search_results ?? data.citations ?? [];
        const citations = rawResults.map((r) => ({
          filename: r.filename ?? r.file_name ?? r.source ?? r.name ?? "",
          score: typeof r.score === "number" ? r.score : 0,
          snippet: r.text ?? r.snippet ?? r.content ?? ""
        }));
        return { content, citations };
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
          vector_store_ids: s.vectorStoreIds.length ? s.vectorStoreIds : void 0,
          persona_id: s.personaId || void 0,
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
function findQuestionFor(messages, messageId) {
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx <= 0) return void 0;
  return messages[idx - 1];
}
function useThreads(opts) {
  const {
    userId,
    model,
    vectorStoreIds,
    personaId,
    customSystemPrompt,
    toneId,
    focusId,
    verbosityId,
    reasoningEffort,
    keyAlias,
    keyToken,
    topK,
    webSearch,
    persistenceEnabled
  } = opts;
  const api = useApi(aiConversationApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [threads, setThreads] = useState(() => loadThreads(userId));
  const [activeId, setActiveId] = useState(() => threads[0]?.id ?? null);
  const [error, setError] = useState(null);
  const [citations, setCitations] = useState([]);
  const [keySpend, setKeySpend] = useState(null);
  const activeThread = threads.find((t) => t.id === activeId) ?? null;
  const isCompareThread = activeThread?.mode === "compare";
  const settingsRef = useRef2({
    model,
    vectorStoreIds,
    personaId,
    customSystemPrompt,
    toneId,
    focusId,
    verbosityId,
    reasoningEffort,
    webSearch,
    topK,
    userKey: keyToken,
    threadId: activeThread?.id ?? ""
  });
  settingsRef.current = {
    model,
    vectorStoreIds,
    personaId,
    customSystemPrompt,
    toneId,
    focusId,
    verbosityId,
    reasoningEffort,
    webSearch,
    topK,
    userKey: keyToken,
    threadId: activeThread?.id ?? ""
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
    onError: (err) => setError(err.message),
    onFinish: () => {
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
          const localIds = new Set(prev.map((t) => t.id));
          const fresh = persisted.map(fromPersisted).filter((t) => !localIds.has(t.id));
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
      personaId,
      customSystemPrompt,
      keyAlias,
      keyToken,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalTokens: 0,
      lastTurnUsage: null
    };
    setThreads((prev) => [thread, ...prev]);
    setActiveId(thread.id);
  }, [keyToken, activeId, persistenceEnabled, api]);
  const newThread = useCallback2(() => {
    const thread = {
      id: genId(),
      title: "New chat",
      messages: [],
      model,
      vectorStoreIds,
      personaId,
      customSystemPrompt,
      keyAlias,
      keyToken,
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
    compareChat.reset();
  }, [model, vectorStoreIds, personaId, customSystemPrompt, keyAlias, keyToken, compareChat]);
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
            personaId,
            customSystemPrompt,
            toneId,
            focusId,
            verbosityId,
            reasoningEffort: reasoningEffort || void 0,
            keyAlias,
            keyToken,
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
      personaId,
      customSystemPrompt,
      toneId,
      focusId,
      verbosityId,
      reasoningEffort,
      keyAlias,
      webSearch,
      chat
    ]
  );
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
            personaId,
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
      personaId,
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
      personaId: typeof src.personaId === "string" ? src.personaId : "",
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
        personaId: activeThread.personaId || void 0,
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
import { Select, MenuItem, FormControl, InputLabel, Typography } from "@mui/material";
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
          if (!value && m.length) {
            const def = defaultModel && m.find((x) => x.model_name === defaultModel)?.model_name || m[0].model_name;
            onChange(def);
          }
        }).catch((err) => {
          if (alive) setError(err.message ?? "Failed to load models");
        }).finally(() => alive && setLoading(false));
        return () => {
          alive = false;
        };
      }, []);
      return /* @__PURE__ */ React.createElement(FormControl, { size: "small", error: !!error, sx: { minWidth: 200 } }, /* @__PURE__ */ React.createElement(InputLabel, null, "Model"), /* @__PURE__ */ React.createElement(
        Select,
        {
          value,
          label: "Model",
          onChange: (e) => onChange(e.target.value),
          disabled: loading
        },
        models.map((m) => /* @__PURE__ */ React.createElement(MenuItem, { key: m.model_name, value: m.model_name }, m.model_name))
      ), error && /* @__PURE__ */ React.createElement(Typography, { variant: "caption", color: "error", sx: { mt: 0.5 } }, error));
    };
  }
});

// src/components/CompareModelPicker.tsx
import React2, { useEffect as useEffect3, useState as useState3 } from "react";
import { Autocomplete, Box, Checkbox, Chip, TextField, Typography as Typography2 } from "@mui/material";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import { useApi as useApi3 } from "@backstage/core-plugin-api";
import { liteLlmApiRef as liteLlmApiRef2 } from "@acarmisc/backstage-plugin-litellm";
var CompareModelPicker;
var init_CompareModelPicker = __esm({
  "src/components/CompareModelPicker.tsx"() {
    "use strict";
    CompareModelPicker = ({ value, onChange }) => {
      const liteLlmApi = useApi3(liteLlmApiRef2);
      const [models, setModels] = useState3([]);
      const [loading, setLoading] = useState3(true);
      const [error, setError] = useState3(null);
      useEffect3(() => {
        let alive = true;
        liteLlmApi.listModels().then((all) => {
          if (!alive) return;
          setModels(all.filter((x) => !x.model_name.startsWith("claude")));
        }).catch((err) => {
          if (alive) setError(err.message ?? "Failed to load models");
        }).finally(() => alive && setLoading(false));
        return () => {
          alive = false;
        };
      }, [liteLlmApi]);
      return /* @__PURE__ */ React2.createElement(Box, null, /* @__PURE__ */ React2.createElement(
        Autocomplete,
        {
          multiple: true,
          size: "small",
          options: models,
          value: models.filter((m) => value.includes(m.model_name)),
          loading,
          disableCloseOnSelect: true,
          getOptionLabel: (m) => m.model_name,
          isOptionEqualToValue: (a, b) => a.model_name === b.model_name,
          onChange: (_e, newValue) => onChange(newValue.map((m) => m.model_name)),
          renderOption: (props, option, { selected: isSelected }) => /* @__PURE__ */ React2.createElement("li", { ...props, key: option.model_name }, /* @__PURE__ */ React2.createElement(
            Checkbox,
            {
              icon: /* @__PURE__ */ React2.createElement(CheckBoxOutlineBlankIcon, { fontSize: "small" }),
              checkedIcon: /* @__PURE__ */ React2.createElement(CheckBoxIcon, { fontSize: "small" }),
              checked: isSelected,
              size: "small",
              sx: { mr: 1, p: 0 }
            }
          ), option.model_name),
          renderTags: (tagValue, getTagProps) => tagValue.map((option, index) => /* @__PURE__ */ React2.createElement(Chip, { ...getTagProps({ index }), key: option.model_name, size: "small", label: option.model_name })),
          renderInput: (params) => /* @__PURE__ */ React2.createElement(
            TextField,
            {
              ...params,
              label: "Compare models",
              placeholder: value.length ? void 0 : "Pick 2+ models\u2026",
              error: !!error
            }
          ),
          sx: { minWidth: 200 }
        }
      ), error && /* @__PURE__ */ React2.createElement(Typography2, { variant: "caption", color: "error", sx: { display: "block", mt: 0.5 } }, error));
    };
  }
});

// src/components/VectorStorePicker.tsx
import React3, { useEffect as useEffect4, useState as useState4 } from "react";
import { Autocomplete as Autocomplete2, Box as Box2, Checkbox as Checkbox2, Chip as Chip2, TextField as TextField2, Typography as Typography3 } from "@mui/material";
import CheckBoxOutlineBlankIcon2 from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon2 from "@mui/icons-material/CheckBox";
import { useApi as useApi4 } from "@backstage/core-plugin-api";
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
      const chatApi = useApi4(aiConversationApiRef);
      const [stores, setStores] = useState4([]);
      const [loading, setLoading] = useState4(true);
      const [error, setError] = useState4(null);
      useEffect4(() => {
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
      return /* @__PURE__ */ React3.createElement(Box2, null, /* @__PURE__ */ React3.createElement(
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
          renderOption: (props, option, { selected: isSelected }) => /* @__PURE__ */ React3.createElement("li", { ...props, key: option.id }, /* @__PURE__ */ React3.createElement(
            Checkbox2,
            {
              icon: /* @__PURE__ */ React3.createElement(CheckBoxOutlineBlankIcon2, { fontSize: "small" }),
              checkedIcon: /* @__PURE__ */ React3.createElement(CheckBoxIcon2, { fontSize: "small" }),
              checked: isSelected,
              size: "small",
              sx: { mr: 1, p: 0 }
            }
          ), option.name, " ", option.file_count != null ? `(${option.file_count})` : ""),
          renderTags: (tagValue, getTagProps) => tagValue.map((option, index) => /* @__PURE__ */ React3.createElement(
            Chip2,
            {
              ...getTagProps({ index }),
              key: option.id,
              size: "small",
              label: option.name
            }
          )),
          renderInput: (params) => /* @__PURE__ */ React3.createElement(
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
      ), error && /* @__PURE__ */ React3.createElement(Typography3, { variant: "caption", color: "error", sx: { display: "block", mt: 0.5 } }, error));
    };
  }
});

// src/components/PersonaPicker.tsx
import React4 from "react";
import { Select as Select2, MenuItem as MenuItem2, FormControl as FormControl2, InputLabel as InputLabel2, Typography as Typography4 } from "@mui/material";
var PersonaPicker;
var init_PersonaPicker = __esm({
  "src/components/PersonaPicker.tsx"() {
    "use strict";
    PersonaPicker = ({
      value,
      personas,
      loading,
      error,
      onChange
    }) => {
      return /* @__PURE__ */ React4.createElement(FormControl2, { size: "small", error: !!error, sx: { minWidth: 200 } }, /* @__PURE__ */ React4.createElement(InputLabel2, { shrink: true }, "Persona"), /* @__PURE__ */ React4.createElement(
        Select2,
        {
          value,
          label: "Persona",
          displayEmpty: true,
          onChange: (e) => {
            const id = e.target.value;
            onChange(id, personas.find((p) => p.id === id));
          },
          disabled: loading
        },
        /* @__PURE__ */ React4.createElement(MenuItem2, { value: "" }, /* @__PURE__ */ React4.createElement("em", null, "None")),
        personas.map((p) => /* @__PURE__ */ React4.createElement(MenuItem2, { key: p.id, value: p.id }, p.title))
      ), error && /* @__PURE__ */ React4.createElement(Typography4, { variant: "caption", color: "error", sx: { mt: 0.5 } }, error));
    };
  }
});

// src/components/KeyPicker.tsx
import React5, { useState as useState5 } from "react";
import { Button, Box as Box3, Typography as Typography5, CircularProgress, Tooltip, IconButton } from "@mui/material";
import KeyIcon from "@mui/icons-material/VpnKey";
import DeleteIcon from "@mui/icons-material/Delete";
import { useApi as useApi5 } from "@backstage/core-plugin-api";
var KeyPicker;
var init_KeyPicker = __esm({
  "src/components/KeyPicker.tsx"() {
    "use strict";
    init_api();
    KeyPicker = ({ value, onChange, onDelete }) => {
      const chatApi = useApi5(aiConversationApiRef);
      const [loading, setLoading] = useState5(false);
      const [error, setError] = useState5(null);
      const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        try {
          const keyInfo = await chatApi.mintChatKey();
          onChange({ alias: keyInfo.key_alias, token: keyInfo.key });
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      const handleDelete = async () => {
        if (!value.token) return;
        try {
          await chatApi.deleteChatKey(value.token);
        } catch {
        }
        onDelete?.();
        onChange({ alias: "", token: "" });
      };
      if (value.token) {
        return /* @__PURE__ */ React5.createElement(Box3, { sx: { display: "flex", alignItems: "center", gap: 1, minWidth: 200 } }, /* @__PURE__ */ React5.createElement(KeyIcon, { fontSize: "small", color: "success" }), /* @__PURE__ */ React5.createElement(Typography5, { variant: "body2", sx: { flex: 1, overflow: "hidden", textOverflow: "ellipsis" } }, value.alias || "chat key"), /* @__PURE__ */ React5.createElement(Tooltip, { title: "Delete chat key" }, /* @__PURE__ */ React5.createElement(IconButton, { edge: "end", size: "small", onClick: handleDelete }, /* @__PURE__ */ React5.createElement(DeleteIcon, { fontSize: "small" }))));
      }
      return /* @__PURE__ */ React5.createElement(Box3, { sx: { minWidth: 200 } }, /* @__PURE__ */ React5.createElement(
        Button,
        {
          size: "small",
          variant: "outlined",
          startIcon: loading ? /* @__PURE__ */ React5.createElement(CircularProgress, { size: 16 }) : /* @__PURE__ */ React5.createElement(KeyIcon, null),
          onClick: handleGenerate,
          disabled: loading
        },
        loading ? "Minting\u2026" : "Generate chat key"
      ), error && /* @__PURE__ */ React5.createElement(Typography5, { variant: "caption", color: "error", sx: { display: "block", mt: 0.5 } }, error));
    };
  }
});

// src/components/OptionPicker.tsx
import React6 from "react";
import { Select as Select3, MenuItem as MenuItem3, FormControl as FormControl3, InputLabel as InputLabel3 } from "@mui/material";
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
      return /* @__PURE__ */ React6.createElement(FormControl3, { size: "small", sx: { minWidth: 160 } }, /* @__PURE__ */ React6.createElement(InputLabel3, { shrink: true }, label), /* @__PURE__ */ React6.createElement(
        Select3,
        {
          value,
          label,
          displayEmpty: true,
          onChange: (e) => onChange(e.target.value),
          disabled: loading
        },
        /* @__PURE__ */ React6.createElement(MenuItem3, { value: "" }, /* @__PURE__ */ React6.createElement("em", null, noneLabel)),
        options.map((o) => /* @__PURE__ */ React6.createElement(MenuItem3, { key: o.id, value: o.id }, o.label))
      ));
    };
  }
});

// src/components/ChatSettingsPanel.tsx
import React7 from "react";
import {
  Box as Box4,
  Typography as Typography6,
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
    init_CompareModelPicker();
    init_VectorStorePicker();
    init_PersonaPicker();
    init_KeyPicker();
    init_OptionPicker();
    REASONING_EFFORT_OPTIONS = [
      { id: "low", label: "Low" },
      { id: "medium", label: "Medium" },
      { id: "high", label: "High" }
    ];
    ChatSettingsPanel = ({
      chatApi,
      showSettings,
      onToggleShowSettings,
      configError,
      config,
      personas,
      personasLoading,
      personasError,
      personaId,
      onPersonaChange,
      traits,
      traitsLoading,
      toneId,
      onToneChange,
      focusId,
      onFocusChange,
      customSystemPrompt,
      onCustomSystemPromptChange,
      compareMode,
      onCompareModeChange,
      compareModelsSel,
      onCompareModelsChange,
      model,
      onModelChange,
      vectorStoreIds,
      onVectorStoreIdsChange,
      webSearch,
      onWebSearchChange,
      verbosityId,
      onVerbosityChange,
      reasoningEffort,
      onReasoningEffortChange,
      keyVal,
      onKeyChange,
      activeThreadKeyToken
    }) => /* @__PURE__ */ React7.createElement(Box4, { sx: { flexShrink: 0 } }, /* @__PURE__ */ React7.createElement(
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
      /* @__PURE__ */ React7.createElement(SettingsIcon, { fontSize: "small", sx: { mr: 1 } }),
      /* @__PURE__ */ React7.createElement(Typography6, { variant: "overline", sx: { flex: 1 } }, "Settings"),
      /* @__PURE__ */ React7.createElement(
        ExpandMoreIcon,
        {
          fontSize: "small",
          sx: {
            transform: showSettings ? "rotate(180deg)" : "none",
            transition: "transform 0.2s"
          }
        }
      )
    ), /* @__PURE__ */ React7.createElement(Collapse, { in: showSettings }, /* @__PURE__ */ React7.createElement(Box4, { sx: { p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 } }, configError && /* @__PURE__ */ React7.createElement(Typography6, { variant: "caption", color: "error" }, "Couldn't load chat defaults: ", configError), /* @__PURE__ */ React7.createElement(
      PersonaPicker,
      {
        value: personaId,
        personas,
        loading: personasLoading,
        error: personasError,
        onChange: onPersonaChange
      }
    ), /* @__PURE__ */ React7.createElement(Box4, { sx: { display: "flex", gap: 1.5, flexWrap: "wrap" } }, /* @__PURE__ */ React7.createElement(
      OptionPicker,
      {
        label: "Tone",
        value: toneId,
        options: traits.tones,
        onChange: onToneChange,
        loading: traitsLoading
      }
    ), /* @__PURE__ */ React7.createElement(
      OptionPicker,
      {
        label: "Focus",
        value: focusId,
        options: traits.focuses,
        onChange: onFocusChange,
        loading: traitsLoading
      }
    )), /* @__PURE__ */ React7.createElement(
      TextField3,
      {
        label: "Custom system prompt",
        placeholder: personaId ? "Appended after the persona system prompt\u2026" : "Used as the system prompt (no persona selected)\u2026",
        value: customSystemPrompt,
        onChange: (e) => onCustomSystemPromptChange(e.target.value),
        multiline: true,
        minRows: 2,
        maxRows: 6,
        size: "small",
        fullWidth: true
      }
    ), /* @__PURE__ */ React7.createElement(
      FormControlLabel,
      {
        control: /* @__PURE__ */ React7.createElement(
          Switch,
          {
            size: "small",
            checked: compareMode,
            onChange: (e) => onCompareModeChange(e.target.checked)
          }
        ),
        label: /* @__PURE__ */ React7.createElement(Typography6, { variant: "body2" }, "Compare models side-by-side")
      }
    ), compareMode ? /* @__PURE__ */ React7.createElement(CompareModelPicker, { value: compareModelsSel, onChange: onCompareModelsChange }) : /* @__PURE__ */ React7.createElement(ModelPicker, { value: model, onChange: onModelChange, defaultModel: config.defaultModel }), /* @__PURE__ */ React7.createElement(Accordion, { disableGutters: true, variant: "outlined", sx: { "&:before": { display: "none" } } }, /* @__PURE__ */ React7.createElement(AccordionSummary, { expandIcon: /* @__PURE__ */ React7.createElement(ExpandMoreIcon, { fontSize: "small" }) }, /* @__PURE__ */ React7.createElement(Typography6, { variant: "body2", sx: { fontWeight: 500 } }, "Advanced")), /* @__PURE__ */ React7.createElement(AccordionDetails, { sx: { display: "flex", flexDirection: "column", gap: 1.5 } }, /* @__PURE__ */ React7.createElement(
      VectorStorePicker,
      {
        value: vectorStoreIds,
        onChange: onVectorStoreIdsChange,
        defaultVectorStoreIds: config.defaultVectorStoreIds
      }
    ), /* @__PURE__ */ React7.createElement(
      FormControlLabel,
      {
        control: /* @__PURE__ */ React7.createElement(
          Switch,
          {
            size: "small",
            checked: webSearch,
            onChange: (e) => onWebSearchChange(e.target.checked)
          }
        ),
        label: /* @__PURE__ */ React7.createElement(Typography6, { variant: "body2" }, "Include web search")
      }
    ), /* @__PURE__ */ React7.createElement(Box4, { sx: { display: "flex", gap: 1.5, flexWrap: "wrap" } }, /* @__PURE__ */ React7.createElement(
      OptionPicker,
      {
        label: "Verbosity",
        value: verbosityId,
        options: traits.verbosities,
        onChange: onVerbosityChange,
        loading: traitsLoading
      }
    ), /* @__PURE__ */ React7.createElement(
      OptionPicker,
      {
        label: "Reasoning effort",
        value: reasoningEffort,
        options: REASONING_EFFORT_OPTIONS,
        onChange: (id) => onReasoningEffortChange(id),
        noneLabel: "Model default"
      }
    )), /* @__PURE__ */ React7.createElement(
      KeyPicker,
      {
        value: keyVal,
        onChange: onKeyChange,
        onDelete: () => {
          if (activeThreadKeyToken) {
            chatApi.deleteChatKey(activeThreadKeyToken).catch(() => {
            });
          }
        }
      }
    ))))));
  }
});

// src/components/PersonaHomepage.tsx
import React8 from "react";
import { Box as Box5, Typography as Typography7, Chip as Chip3, CircularProgress as CircularProgress2 } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
var PersonaHomepage;
var init_PersonaHomepage = __esm({
  "src/components/PersonaHomepage.tsx"() {
    "use strict";
    PersonaHomepage = ({
      personas,
      loading,
      error,
      selectedId,
      onSelect
    }) => {
      if (loading) {
        return /* @__PURE__ */ React8.createElement(Box5, { sx: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React8.createElement(CircularProgress2, { size: 24 }));
      }
      if (error || personas.length === 0) {
        return /* @__PURE__ */ React8.createElement(Box5, { sx: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React8.createElement(Typography7, { color: "text.secondary" }, error ? `Couldn't load personas: ${error}` : "Start a conversation\u2026"));
      }
      return /* @__PURE__ */ React8.createElement(
        Box5,
        {
          sx: {
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 2,
            px: 2,
            py: 4
          }
        },
        /* @__PURE__ */ React8.createElement(Typography7, { variant: "subtitle1", align: "center", color: "text.secondary" }, "Pick a persona to get started, or just start typing"),
        /* @__PURE__ */ React8.createElement(
          Box5,
          {
            sx: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 1.5
            }
          },
          personas.map((p) => {
            const selected = p.id === selectedId;
            return /* @__PURE__ */ React8.createElement(
              Box5,
              {
                key: p.id,
                role: "button",
                tabIndex: 0,
                onClick: () => onSelect(p.id, p),
                onKeyDown: (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(p.id, p);
                  }
                },
                sx: {
                  cursor: "pointer",
                  border: 1,
                  borderColor: selected ? "primary.main" : "divider",
                  borderRadius: 2,
                  p: 1.5,
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.5,
                  bgcolor: selected ? "action.selected" : "background.paper",
                  transition: "border-color 0.15s, background-color 0.15s",
                  "&:hover": {
                    borderColor: "primary.main",
                    bgcolor: "action.hover"
                  }
                }
              },
              /* @__PURE__ */ React8.createElement(Box5, { sx: { display: "flex", alignItems: "center", gap: 0.75 } }, /* @__PURE__ */ React8.createElement(PersonIcon, { fontSize: "small", color: selected ? "primary" : "action" }), /* @__PURE__ */ React8.createElement(Typography7, { variant: "body2", sx: { fontWeight: 600 }, noWrap: true }, p.title)),
              p.description && /* @__PURE__ */ React8.createElement(
                Typography7,
                {
                  variant: "caption",
                  color: "text.secondary",
                  sx: {
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }
                },
                p.description
              ),
              p.tags && p.tags.length > 0 && /* @__PURE__ */ React8.createElement(Box5, { sx: { display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 } }, p.tags.map((tag) => /* @__PURE__ */ React8.createElement(Chip3, { key: tag, label: tag, size: "small", variant: "outlined" })))
            );
          })
        )
      );
    };
  }
});

// src/components/PersonaAvatar.tsx
import React9 from "react";
import { Avatar, Box as Box6 } from "@mui/material";
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
      return /* @__PURE__ */ React9.createElement(Box6, { sx: { position: "relative", width: ringSize, height: ringSize, flexShrink: 0 } }, /* @__PURE__ */ React9.createElement(
        Box6,
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
      ), /* @__PURE__ */ React9.createElement(
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
import React10, { useState as useState6 } from "react";
import { Box as Box7, IconButton as IconButton2, Tooltip as Tooltip2 } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
function extractText2(node) {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText2).join("");
  if (React10.isValidElement(node)) {
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
      const [copied, setCopied] = useState6(false);
      const isBlock = /language-/.test(className ?? "");
      if (!isBlock) {
        return /* @__PURE__ */ React10.createElement("code", { className, style: { fontFamily: MONO_FONT_STACK }, ...props }, children);
      }
      const handleCopy = () => {
        const text = extractText2(children).replace(/\n$/, "");
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      };
      return /* @__PURE__ */ React10.createElement(Box7, { sx: { position: "relative", "&:hover .litellm-copy-btn": { opacity: 1 } } }, /* @__PURE__ */ React10.createElement(Tooltip2, { title: copied ? "Copied" : "Copy code" }, /* @__PURE__ */ React10.createElement(
        IconButton2,
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
        copied ? /* @__PURE__ */ React10.createElement(CheckIcon, { fontSize: "inherit" }) : /* @__PURE__ */ React10.createElement(ContentCopyIcon, { fontSize: "inherit" })
      )), /* @__PURE__ */ React10.createElement("code", { className, style: { fontFamily: MONO_FONT_STACK }, ...props }, children));
    };
  }
});

// src/components/AssistantMessage.tsx
import React11, { useState as useState7 } from "react";
import { Box as Box8, Chip as Chip4, IconButton as IconButton3, Tooltip as Tooltip3 } from "@mui/material";
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
        return /* @__PURE__ */ React11.createElement(
          Chip4,
          {
            size: "small",
            icon: /* @__PURE__ */ React11.createElement(ErrorOutlineIcon, { fontSize: "small" }),
            label: `${toolName} failed`,
            color: "error",
            variant: "outlined",
            sx: { mb: 0.5 }
          }
        );
      }
      if (state === "output-available") {
        return /* @__PURE__ */ React11.createElement(
          Chip4,
          {
            size: "small",
            icon: /* @__PURE__ */ React11.createElement(BuildIcon, { fontSize: "small" }),
            label: `${toolName} done`,
            variant: "outlined",
            sx: { mb: 0.5 }
          }
        );
      }
      return /* @__PURE__ */ React11.createElement(
        Chip4,
        {
          size: "small",
          icon: /* @__PURE__ */ React11.createElement(BuildIcon, { fontSize: "small" }),
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
        return /* @__PURE__ */ React11.createElement(
          Box8,
          {
            component: "img",
            src: url,
            alt: filename ?? "attachment",
            sx: { maxWidth: 240, maxHeight: 240, borderRadius: 1, display: "block", mb: 0.5 }
          }
        );
      }
      return /* @__PURE__ */ React11.createElement(Chip4, { size: "small", label: filename ?? mediaType, variant: "outlined", sx: { mb: 0.5 } });
    };
    AssistantMessage = ({
      message,
      isStreaming,
      avatarLabel = "AI",
      onFeedback,
      onRegenerate
    }) => {
      const [copied, setCopied] = useState7(false);
      const text = extractText(message);
      const showActions = !!text && !isStreaming;
      const handleCopy = () => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      };
      const cursor = /* @__PURE__ */ React11.createElement(
        Box8,
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
            return /* @__PURE__ */ React11.createElement(
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
            return /* @__PURE__ */ React11.createElement(FilePart, { key: i, url: p.url, mediaType: p.mediaType, filename: p.filename });
          }
          if (typeof part.type === "string" && part.type.startsWith("tool-")) {
            return /* @__PURE__ */ React11.createElement(ToolCallPart, { key: i, part });
          }
          return null;
        });
      } else if (isStreaming) {
        body = cursor;
      } else {
        body = null;
      }
      return /* @__PURE__ */ React11.createElement(
        Box8,
        {
          sx: {
            display: "flex",
            gap: 1,
            alignSelf: "flex-start",
            maxWidth: "85%",
            "&:hover .litellm-actions": { opacity: 1 }
          }
        },
        /* @__PURE__ */ React11.createElement(PersonaAvatar, { label: avatarLabel.slice(0, 2).toUpperCase(), isStreaming, size: 28 }),
        /* @__PURE__ */ React11.createElement(Box8, { sx: { minWidth: 0, flex: 1 } }, /* @__PURE__ */ React11.createElement(
          Box8,
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
        ), showActions && /* @__PURE__ */ React11.createElement(
          Box8,
          {
            className: "litellm-actions",
            sx: { display: "flex", gap: 0.25, mt: 0.25, opacity: 0, transition: "opacity 0.15s" }
          },
          onFeedback && /* @__PURE__ */ React11.createElement(React11.Fragment, null, /* @__PURE__ */ React11.createElement(
            IconButton3,
            {
              size: "small",
              "aria-label": "Good response",
              color: message.metadata?.feedback === "up" ? "primary" : "default",
              onClick: () => onFeedback(message.id, "up")
            },
            message.metadata?.feedback === "up" ? /* @__PURE__ */ React11.createElement(ThumbUpIcon, { fontSize: "small" }) : /* @__PURE__ */ React11.createElement(ThumbUpOutlinedIcon, { fontSize: "small" })
          ), /* @__PURE__ */ React11.createElement(
            IconButton3,
            {
              size: "small",
              "aria-label": "Bad response",
              color: message.metadata?.feedback === "down" ? "primary" : "default",
              onClick: () => onFeedback(message.id, "down")
            },
            message.metadata?.feedback === "down" ? /* @__PURE__ */ React11.createElement(ThumbDownIcon, { fontSize: "small" }) : /* @__PURE__ */ React11.createElement(ThumbDownOutlinedIcon, { fontSize: "small" })
          )),
          onRegenerate && /* @__PURE__ */ React11.createElement(Tooltip3, { title: "Regenerate" }, /* @__PURE__ */ React11.createElement(IconButton3, { size: "small", "aria-label": "Regenerate", onClick: () => onRegenerate(message.id) }, /* @__PURE__ */ React11.createElement(ReplayIcon, { fontSize: "small" }))),
          /* @__PURE__ */ React11.createElement(Tooltip3, { title: copied ? "Copied" : "Copy" }, /* @__PURE__ */ React11.createElement(IconButton3, { size: "small", "aria-label": "Copy", onClick: handleCopy }, copied ? /* @__PURE__ */ React11.createElement(CheckIcon2, { fontSize: "small" }) : /* @__PURE__ */ React11.createElement(ContentCopyIcon2, { fontSize: "small" })))
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
import React12, { useState as useState8 } from "react";
import { Box as Box9, Button as Button2, Chip as Chip5, IconButton as IconButton4, TextField as TextField4, Tooltip as Tooltip4 } from "@mui/material";
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
      const [editing, setEditing] = useState8(false);
      const [draft, setDraft] = useState8(text);
      const [copied, setCopied] = useState8(false);
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
        return /* @__PURE__ */ React12.createElement(Box9, { sx: { alignSelf: "flex-end", maxWidth: "80%", width: "100%", display: "flex", flexDirection: "column", gap: 0.5 } }, /* @__PURE__ */ React12.createElement(
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
        ), /* @__PURE__ */ React12.createElement(Box9, { sx: { display: "flex", gap: 1, justifyContent: "flex-end" } }, /* @__PURE__ */ React12.createElement(Button2, { size: "small", onClick: () => setEditing(false) }, "Cancel"), /* @__PURE__ */ React12.createElement(Button2, { size: "small", variant: "contained", onClick: saveEdit, disabled: !draft.trim() }, "Save & resend")));
      }
      return /* @__PURE__ */ React12.createElement(
        Box9,
        {
          sx: {
            alignSelf: "flex-end",
            maxWidth: "80%",
            "&:hover .litellm-actions": { opacity: 1 }
          }
        },
        message.metadata?.attachedUrl && /* @__PURE__ */ React12.createElement(Box9, { sx: { display: "flex", justifyContent: "flex-end", mb: 0.5 } }, /* @__PURE__ */ React12.createElement(Tooltip4, { title: message.metadata.attachedUrl.url }, /* @__PURE__ */ React12.createElement(
          Chip5,
          {
            size: "small",
            icon: /* @__PURE__ */ React12.createElement(LinkIcon, { fontSize: "small" }),
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
        fileParts.length > 0 && /* @__PURE__ */ React12.createElement(Box9, { sx: { display: "flex", flexWrap: "wrap", gap: 0.5, justifyContent: "flex-end", mb: 0.5 } }, fileParts.map(
          (p, i) => p.mediaType.startsWith("image/") ? /* @__PURE__ */ React12.createElement(
            Box9,
            {
              key: i,
              component: "img",
              src: p.url,
              alt: p.filename ?? "attachment",
              sx: { maxWidth: 160, maxHeight: 160, borderRadius: 1 }
            }
          ) : /* @__PURE__ */ React12.createElement(Chip5, { key: i, size: "small", label: p.filename ?? p.mediaType, variant: "outlined" })
        )),
        text && /* @__PURE__ */ React12.createElement(
          Box9,
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
        /* @__PURE__ */ React12.createElement(
          Box9,
          {
            className: "litellm-actions",
            sx: { display: "flex", gap: 0.25, mt: 0.25, justifyContent: "flex-end", opacity: 0, transition: "opacity 0.15s" }
          },
          onEditAndResend && /* @__PURE__ */ React12.createElement(Tooltip4, { title: "Edit & resend" }, /* @__PURE__ */ React12.createElement(IconButton4, { size: "small", "aria-label": "Edit and resend", onClick: startEdit }, /* @__PURE__ */ React12.createElement(EditIcon, { fontSize: "small" }))),
          /* @__PURE__ */ React12.createElement(Tooltip4, { title: copied ? "Copied" : "Copy" }, /* @__PURE__ */ React12.createElement(IconButton4, { size: "small", "aria-label": "Copy", onClick: handleCopy }, copied ? /* @__PURE__ */ React12.createElement(CheckIcon3, { fontSize: "small" }) : /* @__PURE__ */ React12.createElement(ContentCopyIcon3, { fontSize: "small" })))
        )
      );
    };
  }
});

// src/components/MessageList.tsx
import React13 from "react";
import { Box as Box10, Typography as Typography8 } from "@mui/material";
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
      return /* @__PURE__ */ React13.createElement(
        Box10,
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
        groups.map((group, gi) => /* @__PURE__ */ React13.createElement(React13.Fragment, { key: group.user?.id ?? `g${gi}` }, group.user && /* @__PURE__ */ React13.createElement(UserMessage, { message: group.user, onEditAndResend }), group.assistants.length > 1 ? /* @__PURE__ */ React13.createElement(Box10, { sx: { display: "flex", gap: 1.5, overflowX: "auto", width: "100%" } }, group.assistants.map((msg) => /* @__PURE__ */ React13.createElement(Box10, { key: msg.id, sx: { flex: "1 1 320px", minWidth: 280, maxWidth: "none" } }, msg.metadata?.compareModel && /* @__PURE__ */ React13.createElement(Typography8, { variant: "caption", color: "text.secondary", sx: { display: "block", mb: 0.25 } }, msg.metadata.compareModel), /* @__PURE__ */ React13.createElement(
          AssistantMessage,
          {
            message: msg,
            isStreaming: streamingMessageIds.has(msg.id),
            avatarLabel: msg.metadata?.compareModel ?? avatarLabel,
            onFeedback,
            onRegenerate
          }
        )))) : group.assistants.map((msg) => /* @__PURE__ */ React13.createElement(
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
import React14 from "react";
import { Alert, AlertTitle } from "@mui/material";
var ErrorBanner;
var init_ErrorBanner = __esm({
  "src/components/ErrorBanner.tsx"() {
    "use strict";
    ErrorBanner = ({ error, onDismiss }) => {
      if (!error) return null;
      return /* @__PURE__ */ React14.createElement(Alert, { severity: "error", onClose: onDismiss, sx: { mb: 1 } }, /* @__PURE__ */ React14.createElement(AlertTitle, null, "Chat error"), error);
    };
  }
});

// src/components/SourcesPanel.tsx
import React15 from "react";
import { Box as Box11, Chip as Chip6, Typography as Typography9 } from "@mui/material";
var SourcesPanel;
var init_SourcesPanel = __esm({
  "src/components/SourcesPanel.tsx"() {
    "use strict";
    init_safeUrl();
    SourcesPanel = ({ citations }) => {
      return /* @__PURE__ */ React15.createElement(Box11, { sx: { p: 1.5 } }, /* @__PURE__ */ React15.createElement(Typography9, { variant: "overline", color: "text.secondary" }, "Sources"), citations.length === 0 ? /* @__PURE__ */ React15.createElement(Typography9, { variant: "body2", color: "text.secondary", sx: { mt: 0.5 } }, "No sources for the latest reply yet.") : citations.map((c, i) => /* @__PURE__ */ React15.createElement(Box11, { key: i, sx: { mt: 1.5 } }, /* @__PURE__ */ React15.createElement(Box11, { sx: { display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React15.createElement(Typography9, { variant: "body2", fontWeight: 500 }, safeHref(c.url) ? /* @__PURE__ */ React15.createElement("a", { href: safeHref(c.url), target: "_blank", rel: "noopener noreferrer" }, c.filename) : c.filename), c.source && /* @__PURE__ */ React15.createElement(
        Chip6,
        {
          size: "small",
          label: c.source === "web" ? "Web" : "Knowledge base",
          variant: "outlined",
          color: c.source === "web" ? "secondary" : "default"
        }
      ), /* @__PURE__ */ React15.createElement(Chip6, { size: "small", label: c.score.toFixed(3), color: "primary", variant: "outlined" })), /* @__PURE__ */ React15.createElement(
        Typography9,
        {
          variant: "body2",
          color: "text.secondary",
          sx: {
            mt: 0.5,
            whiteSpace: "pre-wrap",
            maxHeight: 120,
            overflow: "auto",
            fontFamily: "monospace",
            fontSize: "0.75rem"
          }
        },
        c.snippet
      ))));
    };
  }
});

// src/components/UsagePanel.tsx
import React16 from "react";
import { Box as Box12, Divider, LinearProgress, Typography as Typography10 } from "@mui/material";
function formatUsd(n) {
  return `$${n.toFixed(4)}`;
}
var Stat, UsagePanel;
var init_UsagePanel = __esm({
  "src/components/UsagePanel.tsx"() {
    "use strict";
    Stat = ({ label, value }) => /* @__PURE__ */ React16.createElement(Box12, { sx: { display: "flex", justifyContent: "space-between", py: 0.25 } }, /* @__PURE__ */ React16.createElement(Typography10, { variant: "body2", color: "text.secondary" }, label), /* @__PURE__ */ React16.createElement(Typography10, { variant: "body2", fontWeight: 500 }, value));
    UsagePanel = ({
      lastTurnUsage,
      totalTokens,
      keySpend
    }) => {
      const budgetPct = keySpend?.max_budget && keySpend.max_budget > 0 ? Math.min(100, keySpend.spend / keySpend.max_budget * 100) : null;
      return /* @__PURE__ */ React16.createElement(Box12, { sx: { p: 1.5 } }, /* @__PURE__ */ React16.createElement(Typography10, { variant: "overline", color: "text.secondary" }, "Usage"), !lastTurnUsage && !keySpend ? /* @__PURE__ */ React16.createElement(Typography10, { variant: "body2", color: "text.secondary", sx: { mt: 0.5 } }, "Send a message to see token and budget usage.") : /* @__PURE__ */ React16.createElement(Box12, { sx: { mt: 0.5 } }, lastTurnUsage && /* @__PURE__ */ React16.createElement(React16.Fragment, null, /* @__PURE__ */ React16.createElement(Stat, { label: "This turn", value: `${lastTurnUsage.total_tokens.toLocaleString()} tokens` }), /* @__PURE__ */ React16.createElement(Stat, { label: "Prompt / completion", value: `${lastTurnUsage.prompt_tokens.toLocaleString()} / ${lastTurnUsage.completion_tokens.toLocaleString()}` }), /* @__PURE__ */ React16.createElement(Stat, { label: "Session total", value: `${totalTokens.toLocaleString()} tokens` })), keySpend && /* @__PURE__ */ React16.createElement(React16.Fragment, null, /* @__PURE__ */ React16.createElement(Divider, { sx: { my: 1 } }), /* @__PURE__ */ React16.createElement(Stat, { label: "Spent", value: formatUsd(keySpend.spend) }), keySpend.max_budget != null && /* @__PURE__ */ React16.createElement(React16.Fragment, null, /* @__PURE__ */ React16.createElement(Stat, { label: "Budget", value: `${formatUsd(keySpend.spend)} / ${formatUsd(keySpend.max_budget)}` }), /* @__PURE__ */ React16.createElement(
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
import React17, { useEffect as useEffect5, useMemo as useMemo3, useRef as useRef3, useState as useState9 } from "react";
import {
  Box as Box13,
  Button as Button3,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton as IconButton5,
  Divider as Divider2,
  Typography as Typography11,
  Tooltip as Tooltip5,
  InputBase,
  Menu,
  MenuItem as MenuItem4,
  ListItemIcon,
  Chip as Chip7
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon2 from "@mui/icons-material/Delete";
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
import { useApi as useApi6, identityApiRef } from "@backstage/core-plugin-api";
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
var SIDEBAR_WIDTH, SIDEBAR_RAIL_WIDTH, RIGHT_RAIL_WIDTH, CHAT_MAX_WIDTH, URL_TOKEN_RE, URL_PREVIEW_DEBOUNCE_MS, ChatPage;
var init_ChatPage = __esm({
  "src/components/ChatPage.tsx"() {
    "use strict";
    init_api();
    init_useThreads();
    init_messageShape();
    init_theme();
    init_ChatSettingsPanel();
    init_PersonaHomepage();
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
    ChatPage = () => {
      const chatApi = useApi6(aiConversationApiRef);
      const identityApi = useApi6(identityApiRef);
      const [userId, setUserId] = useState9("default");
      const [config, setConfig] = useState9({
        defaultModel: null,
        defaultVectorStoreIds: null,
        maxRequestBudget: null,
        persistence: { enabled: false, ttlDays: 30 }
      });
      const [model, setModel] = useState9("");
      const [compareMode, setCompareModeUi] = useState9(false);
      const [compareModelsSel, setCompareModelsSel] = useState9([]);
      const [vectorStoreIds, setVectorStoreIds] = useState9([]);
      const [webSearch, setWebSearch] = useState9(false);
      const [personaId, setPersonaId] = useState9("");
      const [customSystemPrompt, setCustomSystemPrompt] = useState9("");
      const [toneId, setToneId] = useState9("");
      const [focusId, setFocusId] = useState9("");
      const [verbosityId, setVerbosityId] = useState9("");
      const [reasoningEffort, setReasoningEffort] = useState9("");
      const [keyVal, setKeyVal] = useState9({
        alias: "",
        token: ""
      });
      const [showSettings, setShowSettings] = useState9(true);
      const [input, setInput] = useState9("");
      const [configError, setConfigError] = useState9(null);
      const [personas, setPersonas] = useState9([]);
      const [personasLoading, setPersonasLoading] = useState9(true);
      const [personasError, setPersonasError] = useState9(null);
      const [searchQuery, setSearchQuery] = useState9("");
      const [sidebarCollapsed, setSidebarCollapsed] = useState9(false);
      const [rightPanelCollapsed, setRightPanelCollapsed] = useState9(false);
      const [threadMenuAnchor, setThreadMenuAnchor] = useState9(null);
      const [threadMenuTarget, setThreadMenuTarget] = useState9(null);
      const [importError, setImportError] = useState9(null);
      const [urlPreview, setUrlPreview] = useState9(null);
      const [urlPreviewLoading, setUrlPreviewLoading] = useState9(false);
      const [urlPreviewError, setUrlPreviewError] = useState9(null);
      const [dismissedUrl, setDismissedUrl] = useState9(null);
      const [traits, setTraits] = useState9({ tones: [], focuses: [], verbosities: [] });
      const [traitsLoading, setTraitsLoading] = useState9(true);
      const messagesEndRef = useRef3(null);
      const messagesContainerRef = useRef3(null);
      const importInputRef = useRef3(null);
      useEffect5(() => {
        injectDesignSystemAssets();
        chatApi.getChatConfig().then(setConfig).catch((err) => setConfigError(err.message ?? "Failed to reach the chat backend"));
        chatApi.listPersonas().then(setPersonas).catch((err) => setPersonasError(err.message ?? "Failed to load personas")).finally(() => setPersonasLoading(false));
        chatApi.getChatTraits().then(setTraits).catch(() => {
        }).finally(() => setTraitsLoading(false));
        identityApi.getCredentials().then((c) => setUserId(c.token ? "oidc" : "default")).catch(() => {
        });
      }, [chatApi, identityApi]);
      const chat = useThreads({
        userId,
        model,
        vectorStoreIds,
        personaId,
        customSystemPrompt,
        toneId,
        focusId,
        verbosityId,
        reasoningEffort,
        keyAlias: keyVal.alias,
        keyToken: keyVal.token,
        topK: 5,
        webSearch,
        persistenceEnabled: config.persistence.enabled
      });
      const activeThreadId = chat.activeThread?.id ?? null;
      useEffect5(() => {
        if (!chat.activeThread) return;
        setModel(chat.activeThread.model);
        setVectorStoreIds(chat.activeThread.vectorStoreIds);
        setPersonaId(chat.activeThread.personaId ?? "");
        setCustomSystemPrompt(chat.activeThread.customSystemPrompt ?? "");
        setToneId(chat.activeThread.toneId ?? "");
        setFocusId(chat.activeThread.focusId ?? "");
        setVerbosityId(chat.activeThread.verbosityId ?? "");
        setReasoningEffort(chat.activeThread.reasoningEffort ?? "");
        setKeyVal({ alias: chat.activeThread.keyAlias, token: chat.activeThread.keyToken });
        setCompareModeUi(chat.activeThread.mode === "compare");
        setCompareModelsSel(chat.activeThread.compareModels ?? []);
        setWebSearch(!!chat.activeThread.webSearch);
      }, [activeThreadId]);
      const messages = useMemo3(() => chat.activeThread?.messages ?? [], [
        chat.activeThread
      ]);
      const isStreaming = chat.isStreaming;
      useEffect5(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [messages, isStreaming]);
      useEffect5(() => {
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
      const handlePersonaChange = (id, persona) => {
        setPersonaId(id);
        if (persona?.defaultModel) setModel(persona.defaultModel);
        if (persona?.defaultVectorStoreIds) {
          setVectorStoreIds(persona.defaultVectorStoreIds);
        }
      };
      const handleSend = () => {
        if (!input.trim() || !keyVal.token || isStreaming) return;
        if (compareMode && compareModelsSel.length === 0) return;
        const text = input.trim();
        const activeUrlMatch = text.match(URL_TOKEN_RE)?.[1];
        const attachedUrl = activeUrlMatch && urlPreview?.url === activeUrlMatch && activeUrlMatch !== dismissedUrl ? { url: urlPreview.url, title: urlPreview.title } : void 0;
        const compareModelsOverride = compareMode ? compareModelsSel : void 0;
        if (!chat.activeThread) {
          chat.newThread();
          requestAnimationFrame(() => chat.sendMessage(text, attachedUrl, compareModelsOverride));
        } else {
          chat.sendMessage(text, attachedUrl, compareModelsOverride);
        }
        setInput("");
        setUrlPreview(null);
        setUrlPreviewError(null);
        setDismissedUrl(null);
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
        urlPreviewChip = /* @__PURE__ */ React17.createElement(Chip7, { size: "small", icon: /* @__PURE__ */ React17.createElement(LinkIcon2, { fontSize: "small" }), label: "Fetching page\u2026", variant: "outlined" });
      } else if (urlPreviewError) {
        urlPreviewChip = /* @__PURE__ */ React17.createElement(
          Chip7,
          {
            size: "small",
            color: "error",
            icon: /* @__PURE__ */ React17.createElement(LinkIcon2, { fontSize: "small" }),
            label: urlPreviewError,
            variant: "outlined",
            onDelete: dismissUrlPreview,
            deleteIcon: /* @__PURE__ */ React17.createElement(CloseIcon, { fontSize: "small" })
          }
        );
      } else if (urlPreview) {
        urlPreviewChip = /* @__PURE__ */ React17.createElement(Tooltip5, { title: urlPreview.url }, /* @__PURE__ */ React17.createElement(
          Chip7,
          {
            size: "small",
            icon: /* @__PURE__ */ React17.createElement(LinkIcon2, { fontSize: "small" }),
            label: `Page attached: ${urlPreview.title}`,
            variant: "outlined",
            onDelete: dismissUrlPreview,
            deleteIcon: /* @__PURE__ */ React17.createElement(CloseIcon, { fontSize: "small" })
          }
        ));
      }
      return /* @__PURE__ */ React17.createElement(Box13, { sx: { display: "flex", height: "100dvh", overflow: "hidden" } }, /* @__PURE__ */ React17.createElement(
        Box13,
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
        /* @__PURE__ */ React17.createElement(Box13, { sx: { display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "flex-end", px: 0.5, py: 0.5 } }, /* @__PURE__ */ React17.createElement(Tooltip5, { title: sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar" }, /* @__PURE__ */ React17.createElement(IconButton5, { size: "small", onClick: () => setSidebarCollapsed((v) => !v) }, sidebarCollapsed ? /* @__PURE__ */ React17.createElement(ChevronRightIcon, { fontSize: "small" }) : /* @__PURE__ */ React17.createElement(ChevronLeftIcon, { fontSize: "small" })))),
        sidebarCollapsed ? /* @__PURE__ */ React17.createElement(Box13, { sx: { display: "flex", flexDirection: "column", alignItems: "center", gap: 1, pt: 1 } }, /* @__PURE__ */ React17.createElement(Tooltip5, { title: "New chat", placement: "right" }, /* @__PURE__ */ React17.createElement(IconButton5, { onClick: chat.newThread }, /* @__PURE__ */ React17.createElement(AddIcon, null))), /* @__PURE__ */ React17.createElement(Tooltip5, { title: "Settings", placement: "right" }, /* @__PURE__ */ React17.createElement(IconButton5, { onClick: () => setSidebarCollapsed(false) }, /* @__PURE__ */ React17.createElement(SettingsIcon2, null)))) : /* @__PURE__ */ React17.createElement(React17.Fragment, null, /* @__PURE__ */ React17.createElement(
          ChatSettingsPanel,
          {
            chatApi,
            showSettings,
            onToggleShowSettings: () => setShowSettings((v) => !v),
            configError,
            config,
            personas,
            personasLoading,
            personasError,
            personaId,
            onPersonaChange: handlePersonaChange,
            traits,
            traitsLoading,
            toneId,
            onToneChange: setToneId,
            focusId,
            onFocusChange: setFocusId,
            customSystemPrompt,
            onCustomSystemPromptChange: setCustomSystemPrompt,
            compareMode,
            onCompareModeChange: setCompareModeUi,
            compareModelsSel,
            onCompareModelsChange: setCompareModelsSel,
            model,
            onModelChange: setModel,
            vectorStoreIds,
            onVectorStoreIdsChange: setVectorStoreIds,
            webSearch,
            onWebSearchChange: setWebSearch,
            verbosityId,
            onVerbosityChange: setVerbosityId,
            reasoningEffort,
            onReasoningEffortChange: setReasoningEffort,
            keyVal,
            onKeyChange: setKeyVal,
            activeThreadKeyToken: chat.activeThread?.keyToken
          }
        ), /* @__PURE__ */ React17.createElement(Divider2, null), /* @__PURE__ */ React17.createElement(Box13, { sx: { p: 1.5, display: "flex", gap: 1 } }, /* @__PURE__ */ React17.createElement(
          Button3,
          {
            fullWidth: true,
            variant: "outlined",
            startIcon: /* @__PURE__ */ React17.createElement(AddIcon, null),
            onClick: chat.newThread,
            size: "small"
          },
          "New chat"
        ), /* @__PURE__ */ React17.createElement(Tooltip5, { title: "Import thread" }, /* @__PURE__ */ React17.createElement(IconButton5, { size: "small", onClick: () => importInputRef.current?.click() }, /* @__PURE__ */ React17.createElement(FileUploadIcon, { fontSize: "small" }))), /* @__PURE__ */ React17.createElement(
          "input",
          {
            ref: importInputRef,
            type: "file",
            accept: "application/json",
            hidden: true,
            onChange: handleImportFile
          }
        )), importError && /* @__PURE__ */ React17.createElement(Box13, { sx: { px: 1.5, pb: 1 } }, /* @__PURE__ */ React17.createElement(Typography11, { variant: "caption", color: "error" }, importError)), /* @__PURE__ */ React17.createElement(Box13, { sx: { px: 1.5, pb: 1 } }, /* @__PURE__ */ React17.createElement(Tooltip5, { title: persistenceTooltip }, /* @__PURE__ */ React17.createElement(Typography11, { variant: "caption", color: "text.secondary" }, config.persistence.enabled ? `History saved to your account${config.persistence.ttlDays > 0 ? ` \xB7 ${config.persistence.ttlDays}d retention` : ""}` : "History stored only in this browser"))), /* @__PURE__ */ React17.createElement(Box13, { sx: { px: 1.5, pb: 1 } }, /* @__PURE__ */ React17.createElement(
          InputBase,
          {
            fullWidth: true,
            placeholder: "Search threads\u2026",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            startAdornment: /* @__PURE__ */ React17.createElement(SearchIcon, { fontSize: "small", sx: { mr: 0.75, color: "text.secondary" } }),
            sx: {
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              px: 1,
              py: 0.5,
              fontSize: "0.85rem"
            }
          }
        )), /* @__PURE__ */ React17.createElement(Box13, { sx: { flex: 1, overflowY: "auto", minHeight: 0 } }, /* @__PURE__ */ React17.createElement(List, { dense: true }, visibleThreads.map((t) => /* @__PURE__ */ React17.createElement(
          ListItem,
          {
            key: t.id,
            disablePadding: true,
            secondaryAction: /* @__PURE__ */ React17.createElement(IconButton5, { edge: "end", size: "small", onClick: (e) => openThreadMenu(e, t.id) }, /* @__PURE__ */ React17.createElement(MoreVertIcon, { fontSize: "small" }))
          },
          /* @__PURE__ */ React17.createElement(
            ListItemButton,
            {
              selected: chat.activeThread?.id === t.id,
              onClick: () => chat.selectThread(t.id),
              sx: { pr: 6 }
            },
            t.pinned && /* @__PURE__ */ React17.createElement(PushPinIcon, { fontSize: "small", sx: { mr: 0.75, color: "text.secondary" } }),
            /* @__PURE__ */ React17.createElement(
              ListItemText,
              {
                primary: t.title,
                primaryTypographyProps: { noWrap: true, variant: "body2" },
                secondaryTypographyProps: { noWrap: true, variant: "caption" }
              }
            )
          )
        )), visibleThreads.length === 0 && /* @__PURE__ */ React17.createElement(Typography11, { variant: "caption", color: "text.secondary", sx: { px: 2, py: 1, display: "block" } }, searchQuery ? "No threads match your search." : "No threads yet."))), /* @__PURE__ */ React17.createElement(Menu, { anchorEl: threadMenuAnchor, open: !!threadMenuAnchor, onClose: closeThreadMenu }, /* @__PURE__ */ React17.createElement(
          MenuItem4,
          {
            onClick: () => {
              if (threadMenuTarget) chat.togglePin(threadMenuTarget);
              closeThreadMenu();
            }
          },
          /* @__PURE__ */ React17.createElement(ListItemIcon, null, menuTargetThread?.pinned ? /* @__PURE__ */ React17.createElement(PushPinIcon, { fontSize: "small" }) : /* @__PURE__ */ React17.createElement(PushPinOutlinedIcon, { fontSize: "small" })),
          menuTargetThread?.pinned ? "Unpin" : "Pin"
        ), /* @__PURE__ */ React17.createElement(
          MenuItem4,
          {
            onClick: () => {
              if (threadMenuTarget) chat.exportThread(threadMenuTarget);
              closeThreadMenu();
            }
          },
          /* @__PURE__ */ React17.createElement(ListItemIcon, null, /* @__PURE__ */ React17.createElement(FileDownloadIcon, { fontSize: "small" })),
          "Export"
        ), /* @__PURE__ */ React17.createElement(
          MenuItem4,
          {
            onClick: () => {
              if (threadMenuTarget) chat.deleteThread(threadMenuTarget);
              closeThreadMenu();
            }
          },
          /* @__PURE__ */ React17.createElement(ListItemIcon, null, /* @__PURE__ */ React17.createElement(DeleteIcon2, { fontSize: "small" })),
          "Delete"
        )))
      ), /* @__PURE__ */ React17.createElement(
        Box13,
        {
          sx: {
            flex: 3,
            display: "flex",
            justifyContent: "center",
            overflow: "hidden"
          }
        },
        /* @__PURE__ */ React17.createElement(
          Box13,
          {
            sx: {
              width: "100%",
              maxWidth: CHAT_MAX_WIDTH,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }
          },
          /* @__PURE__ */ React17.createElement(
            Box13,
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
            /* @__PURE__ */ React17.createElement(ChatIcon, { fontSize: "small", color: "action" }),
            /* @__PURE__ */ React17.createElement(Typography11, { variant: "subtitle2", noWrap: true, sx: { flex: 1 } }, chat.activeThread?.title ?? "AI Chat"),
            /* @__PURE__ */ React17.createElement(Tooltip5, { title: rightPanelCollapsed ? "Show context panel" : "Hide context panel" }, /* @__PURE__ */ React17.createElement(IconButton5, { size: "small", onClick: () => setRightPanelCollapsed((v) => !v) }, rightPanelCollapsed ? /* @__PURE__ */ React17.createElement(ChevronLeftIcon, { fontSize: "small" }) : /* @__PURE__ */ React17.createElement(ChevronRightIcon, { fontSize: "small" })))
          ),
          chat.error && /* @__PURE__ */ React17.createElement(Box13, { sx: { px: 2, pt: 1 } }, /* @__PURE__ */ React17.createElement(ErrorBanner, { error: chat.error, onDismiss: () => {
          } })),
          /* @__PURE__ */ React17.createElement(
            Box13,
            {
              ref: messagesContainerRef,
              sx: {
                flex: 1,
                overflowY: "auto",
                minHeight: 0
              }
            },
            messages.length === 0 ? /* @__PURE__ */ React17.createElement(
              PersonaHomepage,
              {
                personas,
                loading: personasLoading,
                error: personasError,
                selectedId: personaId,
                onSelect: handlePersonaChange
              }
            ) : /* @__PURE__ */ React17.createElement(
              MessageList,
              {
                messages,
                streamingMessageIds: chat.streamingMessageIds,
                onFeedback: chat.submitFeedback,
                onRegenerate: chat.regenerateFrom,
                onEditAndResend: chat.editAndResend
              }
            ),
            /* @__PURE__ */ React17.createElement("div", { ref: messagesEndRef })
          ),
          (urlPreviewLoading || urlPreview || urlPreviewError) && /* @__PURE__ */ React17.createElement(Box13, { sx: { px: 2, pt: 1 } }, urlPreviewChip),
          /* @__PURE__ */ React17.createElement(
            Box13,
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
            /* @__PURE__ */ React17.createElement(
              InputBase,
              {
                multiline: true,
                minRows: 1,
                maxRows: 5,
                fullWidth: true,
                placeholder: keyVal.token ? "Send a message\u2026  (Enter to send, Shift+Enter for newline)" : "Generate a chat key in Settings to start\u2026",
                value: input,
                onChange: (e) => setInput(e.target.value),
                onKeyDown: handleKeyDown,
                disabled: !keyVal.token,
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
            isStreaming ? /* @__PURE__ */ React17.createElement(Tooltip5, { title: "Stop" }, /* @__PURE__ */ React17.createElement(IconButton5, { color: "error", onClick: chat.stopGeneration }, /* @__PURE__ */ React17.createElement(StopIcon, null))) : /* @__PURE__ */ React17.createElement(Tooltip5, { title: "Send" }, /* @__PURE__ */ React17.createElement(
              IconButton5,
              {
                color: "primary",
                onClick: handleSend,
                disabled: !input.trim() || !keyVal.token || compareMode && compareModelsSel.length === 0
              },
              /* @__PURE__ */ React17.createElement(SendIcon, null)
            ))
          ),
          statusParts.length > 0 && /* @__PURE__ */ React17.createElement(Box13, { sx: { px: 2, pb: 1 } }, /* @__PURE__ */ React17.createElement(Typography11, { variant: "caption", color: "text.secondary" }, statusParts.join(" \xB7 ")))
        )
      ), !rightPanelCollapsed && /* @__PURE__ */ React17.createElement(
        Box13,
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
        /* @__PURE__ */ React17.createElement(SourcesPanel, { citations: chat.citations }),
        /* @__PURE__ */ React17.createElement(Divider2, null),
        /* @__PURE__ */ React17.createElement(
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
import React18 from "react";
import { Box as Box14, Typography as Typography12 } from "@mui/material";
var BarList;
var init_BarList = __esm({
  "src/components/BarList.tsx"() {
    "use strict";
    BarList = ({ rows, emptyLabel = "No data yet." }) => {
      if (rows.length === 0) {
        return /* @__PURE__ */ React18.createElement(Typography12, { variant: "body2", color: "text.secondary" }, emptyLabel);
      }
      const max = Math.max(...rows.map((r) => r.count), 1);
      return /* @__PURE__ */ React18.createElement(Box14, { sx: { display: "flex", flexDirection: "column", gap: 1 } }, rows.map((row) => /* @__PURE__ */ React18.createElement(Box14, { key: row.key, sx: { display: "flex", alignItems: "center", gap: 1 } }, /* @__PURE__ */ React18.createElement(Typography12, { variant: "body2", sx: { width: 180, flexShrink: 0 }, noWrap: true, title: row.key }, row.key), /* @__PURE__ */ React18.createElement(Box14, { sx: { flex: 1, bgcolor: "action.hover", borderRadius: 1, overflow: "hidden", height: 18 } }, /* @__PURE__ */ React18.createElement(
        Box14,
        {
          sx: {
            width: `${row.count / max * 100}%`,
            height: "100%",
            bgcolor: "primary.main",
            borderRadius: 1
          }
        }
      )), /* @__PURE__ */ React18.createElement(Typography12, { variant: "body2", sx: { width: 40, textAlign: "right", flexShrink: 0 } }, row.count))));
    };
  }
});

// src/components/AnalyticsPage.tsx
var AnalyticsPage_exports = {};
__export(AnalyticsPage_exports, {
  AnalyticsPage: () => AnalyticsPage
});
import React19, { useEffect as useEffect6, useState as useState10 } from "react";
import { Box as Box15, Paper, Select as Select4, MenuItem as MenuItem5, Typography as Typography13, Alert as Alert2 } from "@mui/material";
import { useApi as useApi7 } from "@backstage/core-plugin-api";
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
      const chatApi = useApi7(aiConversationApiRef);
      const [range, setRange] = useState10("30d");
      const [byPersona, setByPersona] = useState10([]);
      const [byModel, setByModel] = useState10([]);
      const [feedback, setFeedback] = useState10(null);
      const [error, setError] = useState10(null);
      const [loading, setLoading] = useState10(true);
      useEffect6(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        Promise.all([
          chatApi.getUsageSummary("persona", range),
          chatApi.getUsageSummary("model", range),
          chatApi.getFeedbackSummary()
        ]).then(([persona, model, fb]) => {
          if (!alive) return;
          setByPersona(persona);
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
      return /* @__PURE__ */ React19.createElement(Box15, { sx: { p: 3, maxWidth: 900, mx: "auto" } }, /* @__PURE__ */ React19.createElement(Box15, { sx: { display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 } }, /* @__PURE__ */ React19.createElement(Typography13, { variant: "h5" }, "AI Chat analytics"), /* @__PURE__ */ React19.createElement(Select4, { size: "small", value: range, onChange: (e) => setRange(e.target.value) }, RANGES.map((r) => /* @__PURE__ */ React19.createElement(MenuItem5, { key: r.value, value: r.value }, r.label)))), error && /* @__PURE__ */ React19.createElement(Alert2, { severity: "error", sx: { mb: 2 } }, error), /* @__PURE__ */ React19.createElement(Box15, { sx: { display: "flex", flexDirection: "column", gap: 2 } }, /* @__PURE__ */ React19.createElement(Paper, { variant: "outlined", sx: { p: 2 } }, /* @__PURE__ */ React19.createElement(Typography13, { variant: "subtitle1", sx: { mb: 1.5 } }, "Turns by persona"), /* @__PURE__ */ React19.createElement(BarList, { rows: byPersona, emptyLabel: loading ? "Loading\u2026" : "No chat turns in this range." })), /* @__PURE__ */ React19.createElement(Paper, { variant: "outlined", sx: { p: 2 } }, /* @__PURE__ */ React19.createElement(Typography13, { variant: "subtitle1", sx: { mb: 1.5 } }, "Turns by model"), /* @__PURE__ */ React19.createElement(BarList, { rows: byModel, emptyLabel: loading ? "Loading\u2026" : "No chat turns in this range." })), /* @__PURE__ */ React19.createElement(Paper, { variant: "outlined", sx: { p: 2 } }, /* @__PURE__ */ React19.createElement(Typography13, { variant: "subtitle1", sx: { mb: 1.5 } }, "Feedback (all time)"), /* @__PURE__ */ React19.createElement(BarList, { rows: feedbackRows, emptyLabel: loading ? "Loading\u2026" : "No feedback recorded yet." }))));
    };
  }
});

// src/plugin.tsx
init_api();
import React20 from "react";
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
    icon: /* @__PURE__ */ React20.createElement(ChatIcon2, null),
    loader: async () => {
      const { ChatPage: ChatPage2 } = await Promise.resolve().then(() => (init_ChatPage(), ChatPage_exports));
      return /* @__PURE__ */ React20.createElement(ChatPage2, null);
    }
  }
});
var analyticsPage = PageBlueprint.make({
  name: "analytics",
  params: {
    path: "/ai-conversation/analytics",
    title: "AI Chat Analytics",
    icon: /* @__PURE__ */ React20.createElement(BarChartIcon, null),
    loader: async () => {
      const { AnalyticsPage: AnalyticsPage2 } = await Promise.resolve().then(() => (init_AnalyticsPage(), AnalyticsPage_exports));
      return /* @__PURE__ */ React20.createElement(AnalyticsPage2, null);
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
