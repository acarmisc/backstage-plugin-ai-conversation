"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

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
var import_core_plugin_api, aiConversationApiRef, BASE_PATH, AiConversationApi;
var init_api = __esm({
  "src/api.ts"() {
    "use strict";
    import_core_plugin_api = require("@backstage/core-plugin-api");
    init_threadPersistence();
    aiConversationApiRef = (0, import_core_plugin_api.createApiRef)({
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
function createAiConversationTransport(fetchApi, getSettings) {
  return new import_ai.DefaultChatTransport({
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
var import_ai, BASE_PATH2;
var init_aiSdkTransport = __esm({
  "src/hooks/aiSdkTransport.ts"() {
    "use strict";
    import_ai = require("ai");
    BASE_PATH2 = "/api/ai-conversation";
  }
});

// src/hooks/useCompareChat.ts
function useCompareChat(options) {
  const { createTransport, onFinishColumn } = options;
  const columnsRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
  const versionRef = (0, import_react.useRef)(0);
  const listenersRef = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const notify = (0, import_react.useCallback)(() => {
    versionRef.current += 1;
    listenersRef.current.forEach((l) => l());
  }, []);
  const subscribe = (0, import_react.useCallback)((onStoreChange) => {
    listenersRef.current.add(onStoreChange);
    return () => {
      listenersRef.current.delete(onStoreChange);
    };
  }, []);
  const getSnapshot = (0, import_react.useCallback)(() => versionRef.current, []);
  (0, import_react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
  const teardownColumn = (0, import_react.useCallback)((entry) => {
    entry.unsubscribe();
  }, []);
  const reset = (0, import_react.useCallback)(() => {
    columnsRef.current.forEach((entry) => {
      entry.chat.stop().catch(() => {
      });
      teardownColumn(entry);
    });
    columnsRef.current.clear();
    notify();
  }, [notify, teardownColumn]);
  const sendToAll = (0, import_react.useCallback)(
    (models, baseMessages) => {
      columnsRef.current.forEach((entry) => {
        entry.chat.stop().catch(() => {
        });
        teardownColumn(entry);
      });
      columnsRef.current.clear();
      for (const model of models) {
        const transport = createTransport(model);
        const chat = new import_react2.Chat({
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
  const stopAll = (0, import_react.useCallback)(() => {
    columnsRef.current.forEach((entry) => {
      entry.chat.stop().catch(() => {
      });
    });
  }, []);
  const columns = (0, import_react.useMemo)(
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
var import_react, import_react2;
var init_useCompareChat = __esm({
  "src/hooks/useCompareChat.ts"() {
    "use strict";
    import_react = require("react");
    import_react2 = require("@ai-sdk/react");
  }
});

// src/hooks/useThreads.ts
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
  const api = (0, import_core_plugin_api2.useApi)(aiConversationApiRef);
  const fetchApi = (0, import_core_plugin_api2.useApi)(import_core_plugin_api3.fetchApiRef);
  const authRetryRef = (0, import_react3.useRef)(false);
  const lastSendRef = (0, import_react3.useRef)(null);
  const pendingRetryRef = (0, import_react3.useRef)(null);
  const [threads, setThreads] = (0, import_react3.useState)(() => loadThreads(userId));
  const [activeId, setActiveId] = (0, import_react3.useState)(() => threads[0]?.id ?? null);
  const [error, setError] = (0, import_react3.useState)(null);
  const [citations, setCitations] = (0, import_react3.useState)([]);
  const [keySpend, setKeySpend] = (0, import_react3.useState)(null);
  const loadedUserIdRef = (0, import_react3.useRef)(userId);
  (0, import_react3.useEffect)(() => {
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
  const settingsRef = (0, import_react3.useRef)({
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
  const transport = (0, import_react3.useMemo)(
    () => createAiConversationTransport(fetchApi, () => settingsRef.current),
    [fetchApi]
  );
  const chat = (0, import_react4.useChat)({
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
  (0, import_react3.useEffect)(() => {
    if (!activeThread || isCompareThread) return;
    const threadId = activeThread.id;
    setThreads(
      (prev) => prev.map((t) => t.id === threadId ? { ...t, messages: chat.messages, updatedAt: Date.now() } : t)
    );
  }, [chat.messages, isCompareThread]);
  const compareTurnRef = (0, import_react3.useRef)(null);
  (0, import_react3.useEffect)(() => {
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
  const streamingMessageIds = (0, import_react3.useMemo)(() => {
    if (isCompareThread) {
      return new Set(
        compareChat.columns.filter((c) => c.status === "submitted" || c.status === "streaming").map((c) => c.messages[c.messages.length - 1]?.id).filter((id) => !!id)
      );
    }
    const last = chat.messages[chat.messages.length - 1];
    return isStreaming && last ? /* @__PURE__ */ new Set([last.id]) : /* @__PURE__ */ new Set();
  }, [isCompareThread, compareChat.columns, chat.messages, isStreaming]);
  const threadsRef = (0, import_react3.useRef)(threads);
  threadsRef.current = threads;
  const activeIdRef = (0, import_react3.useRef)(activeId);
  activeIdRef.current = activeId;
  const saveTimeoutRef = (0, import_react3.useRef)(null);
  const syncActiveThreadToBackend = (0, import_react3.useCallback)(() => {
    if (!persistenceEnabled) return;
    const active = threadsRef.current.find((t) => t.id === activeIdRef.current);
    if (active) api.saveThread(active).catch(() => {
    });
  }, [persistenceEnabled, api]);
  (0, import_react3.useEffect)(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveThreads(userId, threadsRef.current);
      syncActiveThreadToBackend();
    }, SAVE_DEBOUNCE_MS);
  }, [userId, threads, syncActiveThreadToBackend]);
  (0, import_react3.useEffect)(() => {
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
  (0, import_react3.useEffect)(() => {
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
  (0, import_react3.useEffect)(() => {
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
  const newThread = (0, import_react3.useCallback)(
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
  const selectThread = (0, import_react3.useCallback)(
    (id) => {
      setActiveId(id);
      setError(null);
      setCitations([]);
      setKeySpend(null);
      compareChat.reset();
    },
    [compareChat]
  );
  const deleteThread = (0, import_react3.useCallback)(
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
  const stopGeneration = (0, import_react3.useCallback)(() => {
    chat.stop().catch(() => {
    });
    compareChat.stopAll();
  }, [chat, compareChat]);
  const runSend = (0, import_react3.useCallback)(
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
  (0, import_react3.useEffect)(() => {
    const replay = pendingRetryRef.current;
    if (!replay || !keyToken) return;
    pendingRetryRef.current = null;
    if (activeThread?.id !== replay.threadId) return;
    runSend(replay.text, replay.baseMessages, replay.attachedUrl, replay.files);
  }, [keyToken]);
  const runCompareSend = (0, import_react3.useCallback)(
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
  const sendMessage = (0, import_react3.useCallback)(
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
  const regenerateFrom = (0, import_react3.useCallback)(
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
  const editAndResend = (0, import_react3.useCallback)(
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
  const setCompareMode = (0, import_react3.useCallback)(
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
  const togglePin = (0, import_react3.useCallback)(
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
  const exportThread = (0, import_react3.useCallback)(
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
  const importThread = (0, import_react3.useCallback)(async (file) => {
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
  const submitFeedback = (0, import_react3.useCallback)(
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
var import_react3, import_core_plugin_api2, import_core_plugin_api3, import_react4, THREAD_EXPORT_VERSION, STORAGE_PREFIX, SAVE_DEBOUNCE_MS;
var init_useThreads = __esm({
  "src/hooks/useThreads.ts"() {
    "use strict";
    import_react3 = require("react");
    import_core_plugin_api2 = require("@backstage/core-plugin-api");
    import_core_plugin_api3 = require("@backstage/core-plugin-api");
    import_react4 = require("@ai-sdk/react");
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
var import_react5, import_material, import_core_plugin_api4, import_backstage_plugin_litellm, ModelPicker;
var init_ModelPicker = __esm({
  "src/components/ModelPicker.tsx"() {
    "use strict";
    import_react5 = __toESM(require("react"));
    import_material = require("@mui/material");
    import_core_plugin_api4 = require("@backstage/core-plugin-api");
    import_backstage_plugin_litellm = require("@acarmisc/backstage-plugin-litellm");
    ModelPicker = ({
      value,
      onChange,
      defaultModel
    }) => {
      const liteLlmApi = (0, import_core_plugin_api4.useApi)(import_backstage_plugin_litellm.liteLlmApiRef);
      const [models, setModels] = (0, import_react5.useState)([]);
      const [loading, setLoading] = (0, import_react5.useState)(true);
      const [error, setError] = (0, import_react5.useState)(null);
      (0, import_react5.useEffect)(() => {
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
      (0, import_react5.useEffect)(() => {
        if (value || models.length === 0) return;
        const def = defaultModel && models.find((x) => x.model_name === defaultModel)?.model_name || models[0].model_name;
        onChange(def);
      }, [value, models, defaultModel, onChange]);
      return /* @__PURE__ */ import_react5.default.createElement(import_material.Box, null, /* @__PURE__ */ import_react5.default.createElement(
        import_material.Autocomplete,
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
          renderInput: (params) => /* @__PURE__ */ import_react5.default.createElement(
            import_material.TextField,
            {
              ...params,
              label: "Model",
              error: !!error,
              fullWidth: true
            }
          )
        }
      ), error && /* @__PURE__ */ import_react5.default.createElement(import_material.Typography, { variant: "caption", color: "error", sx: { display: "block", mt: 0.5 } }, error));
    };
  }
});

// src/components/VectorStorePicker.tsx
var import_react6, import_material2, import_CheckBoxOutlineBlank, import_CheckBox, import_core_plugin_api5, VectorStorePicker;
var init_VectorStorePicker = __esm({
  "src/components/VectorStorePicker.tsx"() {
    "use strict";
    import_react6 = __toESM(require("react"));
    import_material2 = require("@mui/material");
    import_CheckBoxOutlineBlank = __toESM(require("@mui/icons-material/CheckBoxOutlineBlank"));
    import_CheckBox = __toESM(require("@mui/icons-material/CheckBox"));
    import_core_plugin_api5 = require("@backstage/core-plugin-api");
    init_api();
    VectorStorePicker = ({
      value,
      onChange,
      defaultVectorStoreIds
    }) => {
      const chatApi = (0, import_core_plugin_api5.useApi)(aiConversationApiRef);
      const [stores, setStores] = (0, import_react6.useState)([]);
      const [loading, setLoading] = (0, import_react6.useState)(true);
      const [error, setError] = (0, import_react6.useState)(null);
      (0, import_react6.useEffect)(() => {
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
      return /* @__PURE__ */ import_react6.default.createElement(import_material2.Box, null, /* @__PURE__ */ import_react6.default.createElement(
        import_material2.Autocomplete,
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
          renderOption: (props, option, { selected: isSelected }) => /* @__PURE__ */ import_react6.default.createElement("li", { ...props, key: option.id }, /* @__PURE__ */ import_react6.default.createElement(
            import_material2.Checkbox,
            {
              icon: /* @__PURE__ */ import_react6.default.createElement(import_CheckBoxOutlineBlank.default, { fontSize: "small" }),
              checkedIcon: /* @__PURE__ */ import_react6.default.createElement(import_CheckBox.default, { fontSize: "small" }),
              checked: isSelected,
              size: "small",
              sx: { mr: 1, p: 0 }
            }
          ), option.name, " ", option.file_count != null ? `(${option.file_count})` : ""),
          renderTags: (tagValue, getTagProps) => tagValue.map((option, index) => /* @__PURE__ */ import_react6.default.createElement(
            import_material2.Chip,
            {
              ...getTagProps({ index }),
              key: option.id,
              size: "small",
              label: option.name
            }
          )),
          renderInput: (params) => /* @__PURE__ */ import_react6.default.createElement(
            import_material2.TextField,
            {
              ...params,
              label: "Knowledge bases",
              placeholder: value.length ? void 0 : "None (no grounding)",
              error: !!error
            }
          ),
          sx: { minWidth: 200 }
        }
      ), error && /* @__PURE__ */ import_react6.default.createElement(import_material2.Typography, { variant: "caption", color: "error", sx: { display: "block", mt: 0.5 } }, error));
    };
  }
});

// src/components/OptionPicker.tsx
var import_react7, import_material3, OptionPicker;
var init_OptionPicker = __esm({
  "src/components/OptionPicker.tsx"() {
    "use strict";
    import_react7 = __toESM(require("react"));
    import_material3 = require("@mui/material");
    OptionPicker = ({
      label,
      value,
      options,
      onChange,
      loading,
      noneLabel = "Default"
    }) => {
      return /* @__PURE__ */ import_react7.default.createElement(import_material3.FormControl, { size: "small", sx: { minWidth: 160 } }, /* @__PURE__ */ import_react7.default.createElement(import_material3.InputLabel, { shrink: true }, label), /* @__PURE__ */ import_react7.default.createElement(
        import_material3.Select,
        {
          value,
          label,
          displayEmpty: true,
          onChange: (e) => onChange(e.target.value),
          disabled: loading
        },
        /* @__PURE__ */ import_react7.default.createElement(import_material3.MenuItem, { value: "" }, /* @__PURE__ */ import_react7.default.createElement("em", null, noneLabel)),
        options.map((o) => /* @__PURE__ */ import_react7.default.createElement(import_material3.MenuItem, { key: o.id, value: o.id }, o.label))
      ));
    };
  }
});

// src/components/SkillPicker.tsx
var import_react8, import_material4, SkillPicker;
var init_SkillPicker = __esm({
  "src/components/SkillPicker.tsx"() {
    "use strict";
    import_react8 = __toESM(require("react"));
    import_material4 = require("@mui/material");
    SkillPicker = ({ value, skills, onChange }) => {
      const selected = skills.find((s) => s.id === value);
      return /* @__PURE__ */ import_react8.default.createElement(import_material4.FormControl, { size: "small", fullWidth: true, disabled: skills.length === 0 }, /* @__PURE__ */ import_react8.default.createElement(import_material4.InputLabel, { shrink: true }, "Skill"), /* @__PURE__ */ import_react8.default.createElement(
        import_material4.Select,
        {
          value: skills.some((s) => s.id === value) ? value : "",
          label: "Skill",
          displayEmpty: true,
          onChange: (e) => onChange(e.target.value),
          renderValue: () => selected ? selected.title : /* @__PURE__ */ import_react8.default.createElement(import_material4.Typography, { component: "span", variant: "body2", color: "text.secondary" }, skills.length === 0 ? "No skills configured" : "None")
        },
        /* @__PURE__ */ import_react8.default.createElement(import_material4.MenuItem, { value: "" }, /* @__PURE__ */ import_react8.default.createElement("em", null, "None")),
        skills.map((s) => /* @__PURE__ */ import_react8.default.createElement(import_material4.MenuItem, { key: s.id, value: s.id, sx: { display: "block", py: 1 } }, /* @__PURE__ */ import_react8.default.createElement(import_material4.Box, { sx: { display: "flex", alignItems: "center", gap: 1 } }, /* @__PURE__ */ import_react8.default.createElement(import_material4.Typography, { variant: "body2", sx: { fontWeight: 500 } }, s.title), s.tags?.slice(0, 3).map((t) => /* @__PURE__ */ import_react8.default.createElement(import_material4.Chip, { key: t, label: t, size: "small", variant: "outlined", sx: { height: 18 } }))), s.description && /* @__PURE__ */ import_react8.default.createElement(
          import_material4.Typography,
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
var import_react9, import_material5, import_Settings, import_ExpandMore, REASONING_EFFORT_OPTIONS, ChatSettingsPanel;
var init_ChatSettingsPanel = __esm({
  "src/components/ChatSettingsPanel.tsx"() {
    "use strict";
    import_react9 = __toESM(require("react"));
    import_material5 = require("@mui/material");
    import_Settings = __toESM(require("@mui/icons-material/Settings"));
    import_ExpandMore = __toESM(require("@mui/icons-material/ExpandMore"));
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
    }) => /* @__PURE__ */ import_react9.default.createElement(import_material5.Box, { sx: { flexShrink: 0 } }, /* @__PURE__ */ import_react9.default.createElement(
      import_material5.Box,
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
      /* @__PURE__ */ import_react9.default.createElement(import_Settings.default, { fontSize: "small", sx: { mr: 1 } }),
      /* @__PURE__ */ import_react9.default.createElement(import_material5.Typography, { variant: "overline", sx: { flex: 1 } }, "Settings"),
      /* @__PURE__ */ import_react9.default.createElement(
        import_ExpandMore.default,
        {
          fontSize: "small",
          sx: {
            transform: showSettings ? "rotate(180deg)" : "none",
            transition: "transform 0.2s"
          }
        }
      )
    ), /* @__PURE__ */ import_react9.default.createElement(import_material5.Collapse, { in: showSettings }, /* @__PURE__ */ import_react9.default.createElement(import_material5.Box, { sx: { display: "flex", flexDirection: "column" } }, configError && /* @__PURE__ */ import_react9.default.createElement(import_material5.Typography, { variant: "caption", color: "error", sx: { px: 1.5, pt: 1 } }, "Couldn't load chat defaults: ", configError), /* @__PURE__ */ import_react9.default.createElement(import_material5.Box, { sx: { px: 1.5, py: 1.5, display: "flex", flexDirection: "column", gap: 1.5 } }, /* @__PURE__ */ import_react9.default.createElement(SkillPicker, { value: skillId, skills, onChange: onSkillChange }), /* @__PURE__ */ import_react9.default.createElement(ModelPicker, { value: model, onChange: onModelChange, defaultModel: config.defaultModel }), /* @__PURE__ */ import_react9.default.createElement(
      VectorStorePicker,
      {
        value: vectorStoreIds,
        onChange: onVectorStoreIdsChange,
        defaultVectorStoreIds: config.defaultVectorStoreIds
      }
    ), /* @__PURE__ */ import_react9.default.createElement(
      import_material5.TextField,
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
    )), /* @__PURE__ */ import_react9.default.createElement(import_material5.Accordion, { disableGutters: true, variant: "outlined", sx: { "&:before": { display: "none" }, mx: 1.5, mb: 1.5 } }, /* @__PURE__ */ import_react9.default.createElement(import_material5.AccordionSummary, { expandIcon: /* @__PURE__ */ import_react9.default.createElement(import_ExpandMore.default, { fontSize: "small" }) }, /* @__PURE__ */ import_react9.default.createElement(import_material5.Typography, { variant: "body2", sx: { fontWeight: 500 } }, "Advanced")), /* @__PURE__ */ import_react9.default.createElement(import_material5.AccordionDetails, { sx: { display: "flex", flexDirection: "column", gap: 1.5, pt: 1 } }, /* @__PURE__ */ import_react9.default.createElement(
      OptionPicker,
      {
        label: "Tone",
        value: toneId,
        options: traits.tones,
        onChange: onToneChange,
        loading: traitsLoading
      }
    ), /* @__PURE__ */ import_react9.default.createElement(
      OptionPicker,
      {
        label: "Focus",
        value: focusId,
        options: traits.focuses,
        onChange: onFocusChange,
        loading: traitsLoading
      }
    ), /* @__PURE__ */ import_react9.default.createElement(
      OptionPicker,
      {
        label: "Verbosity",
        value: verbosityId,
        options: traits.verbosities,
        onChange: onVerbosityChange,
        loading: traitsLoading
      }
    ), /* @__PURE__ */ import_react9.default.createElement(
      OptionPicker,
      {
        label: "Reasoning effort",
        value: reasoningEffort,
        options: REASONING_EFFORT_OPTIONS,
        onChange: (id) => onReasoningEffortChange(id),
        noneLabel: "Model default"
      }
    ), /* @__PURE__ */ import_react9.default.createElement(
      import_material5.FormControlLabel,
      {
        control: /* @__PURE__ */ import_react9.default.createElement(
          import_material5.Switch,
          {
            size: "small",
            checked: webSearch,
            onChange: (e) => onWebSearchChange(e.target.checked)
          }
        ),
        label: /* @__PURE__ */ import_react9.default.createElement(import_material5.Typography, { variant: "body2" }, "Include web search")
      }
    ))))));
  }
});

// src/components/PersonaAvatar.tsx
var import_react10, import_material6, PersonaAvatar;
var init_PersonaAvatar = __esm({
  "src/components/PersonaAvatar.tsx"() {
    "use strict";
    import_react10 = __toESM(require("react"));
    import_material6 = require("@mui/material");
    init_theme();
    PersonaAvatar = ({
      label,
      isStreaming = false,
      size = 32
    }) => {
      const ringSize = size + 4;
      return /* @__PURE__ */ import_react10.default.createElement(import_material6.Box, { sx: { position: "relative", width: ringSize, height: ringSize, flexShrink: 0 } }, /* @__PURE__ */ import_react10.default.createElement(
        import_material6.Box,
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
      ), /* @__PURE__ */ import_react10.default.createElement(
        import_material6.Avatar,
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
function extractText2(node) {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText2).join("");
  if (import_react11.default.isValidElement(node)) {
    return extractText2(node.props.children);
  }
  return "";
}
var import_react11, import_material7, import_ContentCopy, import_Check, CodeBlock;
var init_CodeBlock = __esm({
  "src/components/CodeBlock.tsx"() {
    "use strict";
    import_react11 = __toESM(require("react"));
    import_material7 = require("@mui/material");
    import_ContentCopy = __toESM(require("@mui/icons-material/ContentCopy"));
    import_Check = __toESM(require("@mui/icons-material/Check"));
    init_theme();
    CodeBlock = ({
      className,
      children,
      ...props
    }) => {
      const [copied, setCopied] = (0, import_react11.useState)(false);
      const isBlock = /language-/.test(className ?? "");
      if (!isBlock) {
        return /* @__PURE__ */ import_react11.default.createElement("code", { className, style: { fontFamily: MONO_FONT_STACK }, ...props }, children);
      }
      const handleCopy = () => {
        const text = extractText2(children).replace(/\n$/, "");
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      };
      return /* @__PURE__ */ import_react11.default.createElement(import_material7.Box, { sx: { position: "relative", "&:hover .litellm-copy-btn": { opacity: 1 } } }, /* @__PURE__ */ import_react11.default.createElement(import_material7.Tooltip, { title: copied ? "Copied" : "Copy code" }, /* @__PURE__ */ import_react11.default.createElement(
        import_material7.IconButton,
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
        copied ? /* @__PURE__ */ import_react11.default.createElement(import_Check.default, { fontSize: "inherit" }) : /* @__PURE__ */ import_react11.default.createElement(import_ContentCopy.default, { fontSize: "inherit" })
      )), /* @__PURE__ */ import_react11.default.createElement("code", { className, style: { fontFamily: MONO_FONT_STACK }, ...props }, children));
    };
  }
});

// src/components/AssistantMessage.tsx
var import_react12, import_material8, import_ThumbUp, import_ThumbUpOutlined, import_ThumbDown, import_ThumbDownOutlined, import_ContentCopy2, import_Check2, import_Replay, import_Build, import_ErrorOutline, import_react_markdown, import_remark_gfm, import_remark_math, import_rehype_katex, blink, ToolCallPart, FilePart, AssistantMessage;
var init_AssistantMessage = __esm({
  "src/components/AssistantMessage.tsx"() {
    "use strict";
    import_react12 = __toESM(require("react"));
    import_material8 = require("@mui/material");
    import_ThumbUp = __toESM(require("@mui/icons-material/ThumbUp"));
    import_ThumbUpOutlined = __toESM(require("@mui/icons-material/ThumbUpOutlined"));
    import_ThumbDown = __toESM(require("@mui/icons-material/ThumbDown"));
    import_ThumbDownOutlined = __toESM(require("@mui/icons-material/ThumbDownOutlined"));
    import_ContentCopy2 = __toESM(require("@mui/icons-material/ContentCopy"));
    import_Check2 = __toESM(require("@mui/icons-material/Check"));
    import_Replay = __toESM(require("@mui/icons-material/Replay"));
    import_Build = __toESM(require("@mui/icons-material/Build"));
    import_ErrorOutline = __toESM(require("@mui/icons-material/ErrorOutline"));
    import_react_markdown = __toESM(require("react-markdown"));
    import_remark_gfm = __toESM(require("remark-gfm"));
    import_remark_math = __toESM(require("remark-math"));
    import_rehype_katex = __toESM(require("rehype-katex"));
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
        return /* @__PURE__ */ import_react12.default.createElement(
          import_material8.Chip,
          {
            size: "small",
            icon: /* @__PURE__ */ import_react12.default.createElement(import_ErrorOutline.default, { fontSize: "small" }),
            label: `${toolName} failed`,
            color: "error",
            variant: "outlined",
            sx: { mb: 0.5 }
          }
        );
      }
      if (state === "output-available") {
        return /* @__PURE__ */ import_react12.default.createElement(
          import_material8.Chip,
          {
            size: "small",
            icon: /* @__PURE__ */ import_react12.default.createElement(import_Build.default, { fontSize: "small" }),
            label: `${toolName} done`,
            variant: "outlined",
            sx: { mb: 0.5 }
          }
        );
      }
      return /* @__PURE__ */ import_react12.default.createElement(
        import_material8.Chip,
        {
          size: "small",
          icon: /* @__PURE__ */ import_react12.default.createElement(import_Build.default, { fontSize: "small" }),
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
        return /* @__PURE__ */ import_react12.default.createElement(
          import_material8.Box,
          {
            component: "img",
            src: url,
            alt: filename ?? "attachment",
            sx: { maxWidth: 240, maxHeight: 240, borderRadius: 1, display: "block", mb: 0.5 }
          }
        );
      }
      return /* @__PURE__ */ import_react12.default.createElement(import_material8.Chip, { size: "small", label: filename ?? mediaType, variant: "outlined", sx: { mb: 0.5 } });
    };
    AssistantMessage = ({
      message,
      isStreaming,
      avatarLabel = "AI",
      onFeedback,
      onRegenerate
    }) => {
      const [copied, setCopied] = (0, import_react12.useState)(false);
      const text = extractText(message);
      const showActions = !!text && !isStreaming;
      const handleCopy = () => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      };
      const cursor = /* @__PURE__ */ import_react12.default.createElement(
        import_material8.Box,
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
            return /* @__PURE__ */ import_react12.default.createElement(
              import_react_markdown.default,
              {
                key: i,
                remarkPlugins: [import_remark_gfm.default, import_remark_math.default],
                rehypePlugins: [import_rehype_katex.default],
                components: { code: CodeBlock }
              },
              part.text
            );
          }
          if (part.type === "file") {
            const p = part;
            return /* @__PURE__ */ import_react12.default.createElement(FilePart, { key: i, url: p.url, mediaType: p.mediaType, filename: p.filename });
          }
          if (typeof part.type === "string" && part.type.startsWith("tool-")) {
            return /* @__PURE__ */ import_react12.default.createElement(ToolCallPart, { key: i, part });
          }
          return null;
        });
      } else if (isStreaming) {
        body = cursor;
      } else {
        body = null;
      }
      return /* @__PURE__ */ import_react12.default.createElement(
        import_material8.Box,
        {
          sx: {
            display: "flex",
            gap: 1,
            alignSelf: "flex-start",
            maxWidth: "85%"
          }
        },
        /* @__PURE__ */ import_react12.default.createElement(PersonaAvatar, { label: avatarLabel.slice(0, 2).toUpperCase(), isStreaming, size: 28 }),
        /* @__PURE__ */ import_react12.default.createElement(import_material8.Box, { sx: { minWidth: 0, flex: 1 } }, /* @__PURE__ */ import_react12.default.createElement(
          import_material8.Box,
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
        ), showActions && /* @__PURE__ */ import_react12.default.createElement(
          import_material8.Box,
          {
            className: "litellm-actions",
            sx: { display: "flex", gap: 0.25, mt: 0.25 }
          },
          onFeedback && /* @__PURE__ */ import_react12.default.createElement(import_react12.default.Fragment, null, /* @__PURE__ */ import_react12.default.createElement(
            import_material8.IconButton,
            {
              size: "small",
              "aria-label": "Good response",
              color: message.metadata?.feedback === "up" ? "primary" : "default",
              onClick: () => onFeedback(message.id, "up")
            },
            message.metadata?.feedback === "up" ? /* @__PURE__ */ import_react12.default.createElement(import_ThumbUp.default, { fontSize: "small" }) : /* @__PURE__ */ import_react12.default.createElement(import_ThumbUpOutlined.default, { fontSize: "small" })
          ), /* @__PURE__ */ import_react12.default.createElement(
            import_material8.IconButton,
            {
              size: "small",
              "aria-label": "Bad response",
              color: message.metadata?.feedback === "down" ? "primary" : "default",
              onClick: () => onFeedback(message.id, "down")
            },
            message.metadata?.feedback === "down" ? /* @__PURE__ */ import_react12.default.createElement(import_ThumbDown.default, { fontSize: "small" }) : /* @__PURE__ */ import_react12.default.createElement(import_ThumbDownOutlined.default, { fontSize: "small" })
          )),
          onRegenerate && /* @__PURE__ */ import_react12.default.createElement(import_material8.Tooltip, { title: "Regenerate" }, /* @__PURE__ */ import_react12.default.createElement(import_material8.IconButton, { size: "small", "aria-label": "Regenerate", onClick: () => onRegenerate(message.id) }, /* @__PURE__ */ import_react12.default.createElement(import_Replay.default, { fontSize: "small" }))),
          /* @__PURE__ */ import_react12.default.createElement(import_material8.Tooltip, { title: copied ? "Copied" : "Copy" }, /* @__PURE__ */ import_react12.default.createElement(import_material8.IconButton, { size: "small", "aria-label": "Copy", onClick: handleCopy }, copied ? /* @__PURE__ */ import_react12.default.createElement(import_Check2.default, { fontSize: "small" }) : /* @__PURE__ */ import_react12.default.createElement(import_ContentCopy2.default, { fontSize: "small" })))
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
var import_react13, import_material9, import_ContentCopy3, import_Check3, import_Edit, import_Link, UserMessage;
var init_UserMessage = __esm({
  "src/components/UserMessage.tsx"() {
    "use strict";
    import_react13 = __toESM(require("react"));
    import_material9 = require("@mui/material");
    import_ContentCopy3 = __toESM(require("@mui/icons-material/ContentCopy"));
    import_Check3 = __toESM(require("@mui/icons-material/Check"));
    import_Edit = __toESM(require("@mui/icons-material/Edit"));
    import_Link = __toESM(require("@mui/icons-material/Link"));
    init_safeUrl();
    init_messageShape();
    UserMessage = ({ message, onEditAndResend }) => {
      const text = extractText(message);
      const fileParts = message.parts.filter(
        (p) => p.type === "file"
      );
      const [editing, setEditing] = (0, import_react13.useState)(false);
      const [draft, setDraft] = (0, import_react13.useState)(text);
      const [copied, setCopied] = (0, import_react13.useState)(false);
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
        return /* @__PURE__ */ import_react13.default.createElement(import_material9.Box, { sx: { alignSelf: "flex-end", maxWidth: "80%", width: "100%", display: "flex", flexDirection: "column", gap: 0.5 } }, /* @__PURE__ */ import_react13.default.createElement(
          import_material9.TextField,
          {
            value: draft,
            onChange: (e) => setDraft(e.target.value),
            multiline: true,
            minRows: 1,
            maxRows: 8,
            size: "small",
            fullWidth: true
          }
        ), /* @__PURE__ */ import_react13.default.createElement(import_material9.Box, { sx: { display: "flex", gap: 1, justifyContent: "flex-end" } }, /* @__PURE__ */ import_react13.default.createElement(import_material9.Button, { size: "small", onClick: () => setEditing(false) }, "Cancel"), /* @__PURE__ */ import_react13.default.createElement(import_material9.Button, { size: "small", variant: "contained", onClick: saveEdit, disabled: !draft.trim() }, "Save & resend")));
      }
      return /* @__PURE__ */ import_react13.default.createElement(
        import_material9.Box,
        {
          sx: {
            alignSelf: "flex-end",
            maxWidth: "80%",
            "&:hover .litellm-actions": { opacity: 1 }
          }
        },
        message.metadata?.attachedUrl && /* @__PURE__ */ import_react13.default.createElement(import_material9.Box, { sx: { display: "flex", justifyContent: "flex-end", mb: 0.5 } }, /* @__PURE__ */ import_react13.default.createElement(import_material9.Tooltip, { title: message.metadata.attachedUrl.url }, /* @__PURE__ */ import_react13.default.createElement(
          import_material9.Chip,
          {
            size: "small",
            icon: /* @__PURE__ */ import_react13.default.createElement(import_Link.default, { fontSize: "small" }),
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
        fileParts.length > 0 && /* @__PURE__ */ import_react13.default.createElement(import_material9.Box, { sx: { display: "flex", flexWrap: "wrap", gap: 0.5, justifyContent: "flex-end", mb: 0.5 } }, fileParts.map(
          (p, i) => p.mediaType.startsWith("image/") ? /* @__PURE__ */ import_react13.default.createElement(
            import_material9.Box,
            {
              key: i,
              component: "img",
              src: p.url,
              alt: p.filename ?? "attachment",
              sx: { maxWidth: 160, maxHeight: 160, borderRadius: 1 }
            }
          ) : /* @__PURE__ */ import_react13.default.createElement(import_material9.Chip, { key: i, size: "small", label: p.filename ?? p.mediaType, variant: "outlined" })
        )),
        text && /* @__PURE__ */ import_react13.default.createElement(
          import_material9.Box,
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
        /* @__PURE__ */ import_react13.default.createElement(
          import_material9.Box,
          {
            className: "litellm-actions",
            sx: { display: "flex", gap: 0.25, mt: 0.25, justifyContent: "flex-end", opacity: 0, transition: "opacity 0.15s" }
          },
          onEditAndResend && /* @__PURE__ */ import_react13.default.createElement(import_material9.Tooltip, { title: "Edit & resend" }, /* @__PURE__ */ import_react13.default.createElement(import_material9.IconButton, { size: "small", "aria-label": "Edit and resend", onClick: startEdit }, /* @__PURE__ */ import_react13.default.createElement(import_Edit.default, { fontSize: "small" }))),
          /* @__PURE__ */ import_react13.default.createElement(import_material9.Tooltip, { title: copied ? "Copied" : "Copy" }, /* @__PURE__ */ import_react13.default.createElement(import_material9.IconButton, { size: "small", "aria-label": "Copy", onClick: handleCopy }, copied ? /* @__PURE__ */ import_react13.default.createElement(import_Check3.default, { fontSize: "small" }) : /* @__PURE__ */ import_react13.default.createElement(import_ContentCopy3.default, { fontSize: "small" })))
        )
      );
    };
  }
});

// src/components/MessageList.tsx
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
var import_react14, import_material10, MessageList;
var init_MessageList = __esm({
  "src/components/MessageList.tsx"() {
    "use strict";
    import_react14 = __toESM(require("react"));
    import_material10 = require("@mui/material");
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
      return /* @__PURE__ */ import_react14.default.createElement(
        import_material10.Box,
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
        groups.map((group, gi) => /* @__PURE__ */ import_react14.default.createElement(import_react14.default.Fragment, { key: group.user?.id ?? `g${gi}` }, group.user && /* @__PURE__ */ import_react14.default.createElement(UserMessage, { message: group.user, onEditAndResend }), group.assistants.length > 1 ? /* @__PURE__ */ import_react14.default.createElement(import_material10.Box, { sx: { display: "flex", gap: 1.5, overflowX: "auto", width: "100%" } }, group.assistants.map((msg) => /* @__PURE__ */ import_react14.default.createElement(import_material10.Box, { key: msg.id, sx: { flex: "1 1 320px", minWidth: 280, maxWidth: "none" } }, msg.metadata?.compareModel && /* @__PURE__ */ import_react14.default.createElement(import_material10.Typography, { variant: "caption", color: "text.secondary", sx: { display: "block", mb: 0.25 } }, msg.metadata.compareModel), /* @__PURE__ */ import_react14.default.createElement(
          AssistantMessage,
          {
            message: msg,
            isStreaming: streamingMessageIds.has(msg.id),
            avatarLabel: msg.metadata?.compareModel ?? avatarLabel,
            onFeedback,
            onRegenerate
          }
        )))) : group.assistants.map((msg) => /* @__PURE__ */ import_react14.default.createElement(
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
var import_react15, import_material11, ErrorBanner;
var init_ErrorBanner = __esm({
  "src/components/ErrorBanner.tsx"() {
    "use strict";
    import_react15 = __toESM(require("react"));
    import_material11 = require("@mui/material");
    ErrorBanner = ({ error, onDismiss }) => {
      if (!error) return null;
      return /* @__PURE__ */ import_react15.default.createElement(import_material11.Alert, { severity: "error", onClose: onDismiss, sx: { mb: 1 } }, /* @__PURE__ */ import_react15.default.createElement(import_material11.AlertTitle, null, "Chat error"), error);
    };
  }
});

// src/components/SourcesPanel.tsx
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
var import_react16, import_material12, import_ExpandMore2, SourceRow, SourcesPanel;
var init_SourcesPanel = __esm({
  "src/components/SourcesPanel.tsx"() {
    "use strict";
    import_react16 = __toESM(require("react"));
    import_material12 = require("@mui/material");
    import_ExpandMore2 = __toESM(require("@mui/icons-material/ExpandMore"));
    init_safeUrl();
    SourceRow = ({ source }) => {
      const href = safeHref(source.url);
      const rel = relevanceLabel(source.bestScore);
      const passages = source.snippets.length;
      return /* @__PURE__ */ import_react16.default.createElement(
        import_material12.Accordion,
        {
          disableGutters: true,
          variant: "outlined",
          sx: { "&:before": { display: "none" }, mb: 0.5 }
        },
        /* @__PURE__ */ import_react16.default.createElement(
          import_material12.AccordionSummary,
          {
            expandIcon: /* @__PURE__ */ import_react16.default.createElement(import_ExpandMore2.default, { fontSize: "small" }),
            sx: { minHeight: 0, "& .MuiAccordionSummary-content": { my: 0.75, mr: 1 } }
          },
          /* @__PURE__ */ import_react16.default.createElement(import_material12.Box, { sx: { display: "flex", flexDirection: "column", gap: 0.25, minWidth: 0 } }, /* @__PURE__ */ import_react16.default.createElement(
            import_material12.Typography,
            {
              variant: "body2",
              fontWeight: 500,
              sx: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
            },
            source.filename
          ), /* @__PURE__ */ import_react16.default.createElement(import_material12.Typography, { variant: "caption", color: "text.secondary" }, /* @__PURE__ */ import_react16.default.createElement(import_material12.Tooltip, { title: `Score ${source.bestScore.toFixed(3)}` }, /* @__PURE__ */ import_react16.default.createElement("span", null, rel, " relevance")), passages > 1 ? ` \xB7 ${passages} passages` : ""))
        ),
        /* @__PURE__ */ import_react16.default.createElement(import_material12.AccordionDetails, { sx: { pt: 0 } }, href && /* @__PURE__ */ import_react16.default.createElement(import_material12.Typography, { variant: "caption", sx: { display: "block", mb: 1 } }, /* @__PURE__ */ import_react16.default.createElement("a", { href, target: "_blank", rel: "noopener noreferrer" }, "Open source")), source.snippets.map((snippet, i) => /* @__PURE__ */ import_react16.default.createElement(import_material12.Box, { key: i }, i > 0 && /* @__PURE__ */ import_react16.default.createElement(import_material12.Divider, { sx: { my: 1 } }), /* @__PURE__ */ import_react16.default.createElement(
          import_material12.Typography,
          {
            variant: "body2",
            color: "text.secondary",
            sx: { whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto" }
          },
          snippet
        ))), source.snippets.length === 0 && /* @__PURE__ */ import_react16.default.createElement(import_material12.Typography, { variant: "body2", color: "text.secondary" }, "No excerpt available."))
      );
    };
    SourcesPanel = ({ citations }) => {
      const groups = groupSources(citations);
      const total = groups.reduce((n, g) => n + g.items.length, 0);
      return /* @__PURE__ */ import_react16.default.createElement(import_material12.Box, { sx: { p: 1.5 } }, /* @__PURE__ */ import_react16.default.createElement(import_material12.Box, { sx: { display: "flex", alignItems: "center", gap: 1 } }, /* @__PURE__ */ import_react16.default.createElement(import_material12.Typography, { variant: "overline", color: "text.secondary" }, "Sources"), total > 0 && /* @__PURE__ */ import_react16.default.createElement(import_material12.Chip, { size: "small", label: total, variant: "outlined" })), total === 0 ? /* @__PURE__ */ import_react16.default.createElement(import_material12.Typography, { variant: "body2", color: "text.secondary", sx: { mt: 0.5 } }, "No sources for the latest reply yet.") : groups.map((group) => /* @__PURE__ */ import_react16.default.createElement(import_material12.Box, { key: group.key, sx: { mt: 1 } }, /* @__PURE__ */ import_react16.default.createElement(
        import_material12.Typography,
        {
          variant: "caption",
          color: "text.secondary",
          sx: { display: "block", mb: 0.5, fontWeight: 600 }
        },
        group.label,
        " (",
        group.items.length,
        ")"
      ), group.items.map((s, i) => /* @__PURE__ */ import_react16.default.createElement(SourceRow, { key: `${group.key}-${i}`, source: s })))));
    };
  }
});

// src/components/UsagePanel.tsx
function formatUsd(n) {
  return `$${n.toFixed(4)}`;
}
var import_react17, import_material13, Stat, UsagePanel;
var init_UsagePanel = __esm({
  "src/components/UsagePanel.tsx"() {
    "use strict";
    import_react17 = __toESM(require("react"));
    import_material13 = require("@mui/material");
    Stat = ({ label, value }) => /* @__PURE__ */ import_react17.default.createElement(import_material13.Box, { sx: { display: "flex", justifyContent: "space-between", py: 0.25 } }, /* @__PURE__ */ import_react17.default.createElement(import_material13.Typography, { variant: "body2", color: "text.secondary" }, label), /* @__PURE__ */ import_react17.default.createElement(import_material13.Typography, { variant: "body2", fontWeight: 500 }, value));
    UsagePanel = ({
      lastTurnUsage,
      totalTokens,
      keySpend
    }) => {
      const budgetPct = keySpend?.max_budget && keySpend.max_budget > 0 ? Math.min(100, keySpend.spend / keySpend.max_budget * 100) : null;
      return /* @__PURE__ */ import_react17.default.createElement(import_material13.Box, { sx: { p: 1.5 } }, /* @__PURE__ */ import_react17.default.createElement(import_material13.Typography, { variant: "overline", color: "text.secondary" }, "Usage"), !lastTurnUsage && !keySpend ? /* @__PURE__ */ import_react17.default.createElement(import_material13.Typography, { variant: "body2", color: "text.secondary", sx: { mt: 0.5 } }, "Send a message to see token and budget usage.") : /* @__PURE__ */ import_react17.default.createElement(import_material13.Box, { sx: { mt: 0.5 } }, lastTurnUsage && /* @__PURE__ */ import_react17.default.createElement(import_react17.default.Fragment, null, /* @__PURE__ */ import_react17.default.createElement(Stat, { label: "This turn", value: `${lastTurnUsage.total_tokens.toLocaleString()} tokens` }), /* @__PURE__ */ import_react17.default.createElement(Stat, { label: "Prompt / completion", value: `${lastTurnUsage.prompt_tokens.toLocaleString()} / ${lastTurnUsage.completion_tokens.toLocaleString()}` }), /* @__PURE__ */ import_react17.default.createElement(Stat, { label: "Session total", value: `${totalTokens.toLocaleString()} tokens` })), keySpend && /* @__PURE__ */ import_react17.default.createElement(import_react17.default.Fragment, null, /* @__PURE__ */ import_react17.default.createElement(import_material13.Divider, { sx: { my: 1 } }), /* @__PURE__ */ import_react17.default.createElement(Stat, { label: "Spent", value: formatUsd(keySpend.spend) }), keySpend.max_budget != null && /* @__PURE__ */ import_react17.default.createElement(import_react17.default.Fragment, null, /* @__PURE__ */ import_react17.default.createElement(Stat, { label: "Budget", value: `${formatUsd(keySpend.spend)} / ${formatUsd(keySpend.max_budget)}` }), /* @__PURE__ */ import_react17.default.createElement(
        import_material13.LinearProgress,
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
var import_react18, import_material14, import_Add, import_Delete, import_Settings2, import_Chat, import_Send, import_Stop, import_Search, import_MoreVert, import_PushPin, import_PushPinOutlined, import_FileDownload, import_FileUpload, import_ChevronLeft, import_ChevronRight, import_Link2, import_Close, import_AttachFile, import_ExpandMore3, import_History, import_ai2, import_core_plugin_api6, SIDEBAR_WIDTH, SIDEBAR_RAIL_WIDTH, RIGHT_RAIL_WIDTH, CHAT_MAX_WIDTH, URL_TOKEN_RE, URL_PREVIEW_DEBOUNCE_MS, KEY_REMINT_SKEW_MS, MAX_ATTACHMENTS_PER_MESSAGE, ALLOWED_ATTACHMENT_MEDIA_TYPES, ChatPage;
var init_ChatPage = __esm({
  "src/components/ChatPage.tsx"() {
    "use strict";
    import_react18 = __toESM(require("react"));
    import_material14 = require("@mui/material");
    import_Add = __toESM(require("@mui/icons-material/Add"));
    import_Delete = __toESM(require("@mui/icons-material/Delete"));
    import_Settings2 = __toESM(require("@mui/icons-material/Settings"));
    import_Chat = __toESM(require("@mui/icons-material/Chat"));
    import_Send = __toESM(require("@mui/icons-material/Send"));
    import_Stop = __toESM(require("@mui/icons-material/Stop"));
    import_Search = __toESM(require("@mui/icons-material/Search"));
    import_MoreVert = __toESM(require("@mui/icons-material/MoreVert"));
    import_PushPin = __toESM(require("@mui/icons-material/PushPin"));
    import_PushPinOutlined = __toESM(require("@mui/icons-material/PushPinOutlined"));
    import_FileDownload = __toESM(require("@mui/icons-material/FileDownload"));
    import_FileUpload = __toESM(require("@mui/icons-material/FileUpload"));
    import_ChevronLeft = __toESM(require("@mui/icons-material/ChevronLeft"));
    import_ChevronRight = __toESM(require("@mui/icons-material/ChevronRight"));
    import_Link2 = __toESM(require("@mui/icons-material/Link"));
    import_Close = __toESM(require("@mui/icons-material/Close"));
    import_AttachFile = __toESM(require("@mui/icons-material/AttachFile"));
    import_ExpandMore3 = __toESM(require("@mui/icons-material/ExpandMore"));
    import_History = __toESM(require("@mui/icons-material/History"));
    import_ai2 = require("ai");
    import_core_plugin_api6 = require("@backstage/core-plugin-api");
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
      const chatApi = (0, import_core_plugin_api6.useApi)(aiConversationApiRef);
      const identityApi = (0, import_core_plugin_api6.useApi)(import_core_plugin_api6.identityApiRef);
      const [userId, setUserId] = (0, import_react18.useState)("default");
      const [config, setConfig] = (0, import_react18.useState)({
        defaultModel: null,
        defaultVectorStoreIds: null,
        maxRequestBudget: null,
        persistence: { enabled: false, ttlDays: 30 }
      });
      const [model, setModel] = (0, import_react18.useState)("");
      const [vectorStoreIds, setVectorStoreIds] = (0, import_react18.useState)([]);
      const [webSearch, setWebSearch] = (0, import_react18.useState)(false);
      const [customSystemPrompt, setCustomSystemPrompt] = (0, import_react18.useState)("");
      const [toneId, setToneId] = (0, import_react18.useState)("");
      const [focusId, setFocusId] = (0, import_react18.useState)("");
      const [verbosityId, setVerbosityId] = (0, import_react18.useState)("");
      const [reasoningEffort, setReasoningEffort] = (0, import_react18.useState)("");
      const [keyVal, setKeyVal] = (0, import_react18.useState)({
        alias: "",
        token: ""
      });
      const [skillId, setSkillId] = (0, import_react18.useState)("");
      const [skills, setSkills] = (0, import_react18.useState)([]);
      const [showSettings, setShowSettings] = (0, import_react18.useState)(true);
      const [input, setInput] = (0, import_react18.useState)("");
      const [configError, setConfigError] = (0, import_react18.useState)(null);
      const [searchQuery, setSearchQuery] = (0, import_react18.useState)("");
      const [historyOpen, setHistoryOpen] = (0, import_react18.useState)(false);
      const [sidebarCollapsed, setSidebarCollapsed] = (0, import_react18.useState)(false);
      const [rightPanelCollapsed, setRightPanelCollapsed] = (0, import_react18.useState)(false);
      const [threadMenuAnchor, setThreadMenuAnchor] = (0, import_react18.useState)(null);
      const [threadMenuTarget, setThreadMenuTarget] = (0, import_react18.useState)(null);
      const [importError, setImportError] = (0, import_react18.useState)(null);
      const [urlPreview, setUrlPreview] = (0, import_react18.useState)(null);
      const [urlPreviewLoading, setUrlPreviewLoading] = (0, import_react18.useState)(false);
      const [urlPreviewError, setUrlPreviewError] = (0, import_react18.useState)(null);
      const [dismissedUrl, setDismissedUrl] = (0, import_react18.useState)(null);
      const [traits, setTraits] = (0, import_react18.useState)({ tones: [], focuses: [], verbosities: [] });
      const [traitsLoading, setTraitsLoading] = (0, import_react18.useState)(true);
      const [stagedFiles, setStagedFiles] = (0, import_react18.useState)([]);
      const [attachError, setAttachError] = (0, import_react18.useState)(null);
      const messagesEndRef = (0, import_react18.useRef)(null);
      const messagesContainerRef = (0, import_react18.useRef)(null);
      const importInputRef = (0, import_react18.useRef)(null);
      const attachInputRef = (0, import_react18.useRef)(null);
      const pendingSendRef = (0, import_react18.useRef)(null);
      (0, import_react18.useEffect)(() => {
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
      (0, import_react18.useEffect)(() => {
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
      (0, import_react18.useEffect)(() => {
        if (!pendingSendRef.current || !activeThreadId) return;
        const pending = pendingSendRef.current;
        pendingSendRef.current = null;
        chat.sendMessage(pending.text, pending.attachedUrl, void 0, pending.files);
      }, [activeThreadId]);
      const messages = (0, import_react18.useMemo)(() => chat.activeThread?.messages ?? [], [
        chat.activeThread
      ]);
      const isStreaming = chat.isStreaming;
      (0, import_react18.useEffect)(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [messages, isStreaming]);
      (0, import_react18.useEffect)(() => {
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
      const visibleThreads = (0, import_react18.useMemo)(
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
          const parts = await (0, import_ai2.convertFileListToFileUIParts)(fileList);
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
        urlPreviewChip = /* @__PURE__ */ import_react18.default.createElement(import_material14.Chip, { size: "small", icon: /* @__PURE__ */ import_react18.default.createElement(import_Link2.default, { fontSize: "small" }), label: "Fetching page\u2026", variant: "outlined" });
      } else if (urlPreviewError) {
        urlPreviewChip = /* @__PURE__ */ import_react18.default.createElement(
          import_material14.Chip,
          {
            size: "small",
            color: "error",
            icon: /* @__PURE__ */ import_react18.default.createElement(import_Link2.default, { fontSize: "small" }),
            label: urlPreviewError,
            variant: "outlined",
            onDelete: dismissUrlPreview,
            deleteIcon: /* @__PURE__ */ import_react18.default.createElement(import_Close.default, { fontSize: "small" })
          }
        );
      } else if (urlPreview) {
        urlPreviewChip = /* @__PURE__ */ import_react18.default.createElement(import_material14.Tooltip, { title: urlPreview.url }, /* @__PURE__ */ import_react18.default.createElement(
          import_material14.Chip,
          {
            size: "small",
            icon: /* @__PURE__ */ import_react18.default.createElement(import_Link2.default, { fontSize: "small" }),
            label: `Page attached: ${urlPreview.title}`,
            variant: "outlined",
            onDelete: dismissUrlPreview,
            deleteIcon: /* @__PURE__ */ import_react18.default.createElement(import_Close.default, { fontSize: "small" })
          }
        ));
      }
      return /* @__PURE__ */ import_react18.default.createElement(import_material14.Box, { sx: { display: "flex", height: "100dvh", overflow: "hidden" } }, /* @__PURE__ */ import_react18.default.createElement(
        import_material14.Box,
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
        /* @__PURE__ */ import_react18.default.createElement(import_material14.Box, { sx: { display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "flex-end", px: 0.5, py: 0.5 } }, /* @__PURE__ */ import_react18.default.createElement(import_material14.Tooltip, { title: sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar" }, /* @__PURE__ */ import_react18.default.createElement(import_material14.IconButton, { size: "small", onClick: () => setSidebarCollapsed((v) => !v) }, sidebarCollapsed ? /* @__PURE__ */ import_react18.default.createElement(import_ChevronRight.default, { fontSize: "small" }) : /* @__PURE__ */ import_react18.default.createElement(import_ChevronLeft.default, { fontSize: "small" })))),
        sidebarCollapsed ? /* @__PURE__ */ import_react18.default.createElement(import_material14.Box, { sx: { display: "flex", flexDirection: "column", alignItems: "center", gap: 1, pt: 1 } }, /* @__PURE__ */ import_react18.default.createElement(import_material14.Tooltip, { title: "New chat", placement: "right" }, /* @__PURE__ */ import_react18.default.createElement(import_material14.IconButton, { onClick: () => chat.newThread() }, /* @__PURE__ */ import_react18.default.createElement(import_Add.default, null))), /* @__PURE__ */ import_react18.default.createElement(import_material14.Tooltip, { title: "Settings", placement: "right" }, /* @__PURE__ */ import_react18.default.createElement(import_material14.IconButton, { onClick: () => setSidebarCollapsed(false) }, /* @__PURE__ */ import_react18.default.createElement(import_Settings2.default, null)))) : /* @__PURE__ */ import_react18.default.createElement(import_react18.default.Fragment, null, /* @__PURE__ */ import_react18.default.createElement(
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
        ), /* @__PURE__ */ import_react18.default.createElement(import_material14.Divider, null), /* @__PURE__ */ import_react18.default.createElement(import_material14.Box, { sx: { p: 1.5, display: "flex", gap: 1 } }, /* @__PURE__ */ import_react18.default.createElement(
          import_material14.Button,
          {
            fullWidth: true,
            variant: "outlined",
            startIcon: /* @__PURE__ */ import_react18.default.createElement(import_Add.default, null),
            onClick: () => chat.newThread(),
            size: "small"
          },
          "New chat"
        ), /* @__PURE__ */ import_react18.default.createElement(import_material14.Tooltip, { title: "Import thread" }, /* @__PURE__ */ import_react18.default.createElement(import_material14.IconButton, { size: "small", onClick: () => importInputRef.current?.click() }, /* @__PURE__ */ import_react18.default.createElement(import_FileUpload.default, { fontSize: "small" }))), /* @__PURE__ */ import_react18.default.createElement(
          "input",
          {
            ref: importInputRef,
            type: "file",
            accept: "application/json",
            hidden: true,
            onChange: handleImportFile
          }
        )), importError && /* @__PURE__ */ import_react18.default.createElement(import_material14.Box, { sx: { px: 1.5, pb: 1 } }, /* @__PURE__ */ import_react18.default.createElement(import_material14.Typography, { variant: "caption", color: "error" }, importError)), /* @__PURE__ */ import_react18.default.createElement(
          import_material14.Box,
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
          /* @__PURE__ */ import_react18.default.createElement(import_History.default, { fontSize: "small", sx: { mr: 1 } }),
          /* @__PURE__ */ import_react18.default.createElement(import_material14.Typography, { variant: "overline", sx: { flex: 1 } }, "History"),
          config.persistence.enabled && /* @__PURE__ */ import_react18.default.createElement(import_material14.Tooltip, { title: persistenceTooltip }, /* @__PURE__ */ import_react18.default.createElement(import_material14.Typography, { variant: "caption", color: "text.secondary", sx: { mr: 0.5 } }, config.persistence.ttlDays > 0 ? `${config.persistence.ttlDays}d` : "saved")),
          /* @__PURE__ */ import_react18.default.createElement(
            import_ExpandMore3.default,
            {
              fontSize: "small",
              sx: {
                transform: historyOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.2s"
              }
            }
          )
        ), /* @__PURE__ */ import_react18.default.createElement(import_material14.Collapse, { in: historyOpen }, /* @__PURE__ */ import_react18.default.createElement(import_material14.Box, { sx: { display: "flex", flexDirection: "column", minHeight: 0 } }, /* @__PURE__ */ import_react18.default.createElement(import_material14.Box, { sx: { px: 1.5, pb: 1 } }, /* @__PURE__ */ import_react18.default.createElement(
          import_material14.InputBase,
          {
            fullWidth: true,
            placeholder: "Search threads\u2026",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            startAdornment: /* @__PURE__ */ import_react18.default.createElement(import_Search.default, { fontSize: "small", sx: { mr: 0.75, color: "text.secondary" } }),
            sx: {
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              px: 1,
              py: 0.5,
              fontSize: "0.85rem"
            }
          }
        )), /* @__PURE__ */ import_react18.default.createElement(import_material14.Box, { sx: { flex: 1, overflowY: "auto", minHeight: 0 } }, /* @__PURE__ */ import_react18.default.createElement(import_material14.List, { dense: true }, visibleThreads.map((t) => /* @__PURE__ */ import_react18.default.createElement(
          import_material14.ListItem,
          {
            key: t.id,
            disablePadding: true,
            secondaryAction: /* @__PURE__ */ import_react18.default.createElement(import_material14.IconButton, { edge: "end", size: "small", onClick: (e) => openThreadMenu(e, t.id) }, /* @__PURE__ */ import_react18.default.createElement(import_MoreVert.default, { fontSize: "small" }))
          },
          /* @__PURE__ */ import_react18.default.createElement(
            import_material14.ListItemButton,
            {
              selected: chat.activeThread?.id === t.id,
              onClick: () => chat.selectThread(t.id),
              sx: { pr: 6 }
            },
            t.pinned && /* @__PURE__ */ import_react18.default.createElement(import_PushPin.default, { fontSize: "small", sx: { mr: 0.75, color: "text.secondary" } }),
            /* @__PURE__ */ import_react18.default.createElement(
              import_material14.ListItemText,
              {
                primary: t.title,
                primaryTypographyProps: { noWrap: true, variant: "body2" },
                secondaryTypographyProps: { noWrap: true, variant: "caption" }
              }
            )
          )
        )), visibleThreads.length === 0 && /* @__PURE__ */ import_react18.default.createElement(import_material14.Typography, { variant: "caption", color: "text.secondary", sx: { px: 2, py: 1, display: "block" } }, searchQuery ? "No threads match your search." : "No threads yet."))))), /* @__PURE__ */ import_react18.default.createElement(import_material14.Menu, { anchorEl: threadMenuAnchor, open: !!threadMenuAnchor, onClose: closeThreadMenu }, /* @__PURE__ */ import_react18.default.createElement(
          import_material14.MenuItem,
          {
            onClick: () => {
              if (threadMenuTarget) chat.togglePin(threadMenuTarget);
              closeThreadMenu();
            }
          },
          /* @__PURE__ */ import_react18.default.createElement(import_material14.ListItemIcon, null, menuTargetThread?.pinned ? /* @__PURE__ */ import_react18.default.createElement(import_PushPin.default, { fontSize: "small" }) : /* @__PURE__ */ import_react18.default.createElement(import_PushPinOutlined.default, { fontSize: "small" })),
          menuTargetThread?.pinned ? "Unpin" : "Pin"
        ), /* @__PURE__ */ import_react18.default.createElement(
          import_material14.MenuItem,
          {
            onClick: () => {
              if (threadMenuTarget) chat.exportThread(threadMenuTarget);
              closeThreadMenu();
            }
          },
          /* @__PURE__ */ import_react18.default.createElement(import_material14.ListItemIcon, null, /* @__PURE__ */ import_react18.default.createElement(import_FileDownload.default, { fontSize: "small" })),
          "Export"
        ), /* @__PURE__ */ import_react18.default.createElement(
          import_material14.MenuItem,
          {
            onClick: () => {
              if (threadMenuTarget) chat.deleteThread(threadMenuTarget);
              closeThreadMenu();
            }
          },
          /* @__PURE__ */ import_react18.default.createElement(import_material14.ListItemIcon, null, /* @__PURE__ */ import_react18.default.createElement(import_Delete.default, { fontSize: "small" })),
          "Delete"
        )))
      ), /* @__PURE__ */ import_react18.default.createElement(
        import_material14.Box,
        {
          sx: {
            flex: 3,
            display: "flex",
            justifyContent: "center",
            overflow: "hidden"
          }
        },
        /* @__PURE__ */ import_react18.default.createElement(
          import_material14.Box,
          {
            sx: {
              width: "100%",
              maxWidth: CHAT_MAX_WIDTH,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }
          },
          /* @__PURE__ */ import_react18.default.createElement(
            import_material14.Box,
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
            /* @__PURE__ */ import_react18.default.createElement(import_Chat.default, { fontSize: "small", color: "action" }),
            /* @__PURE__ */ import_react18.default.createElement(import_material14.Typography, { variant: "subtitle2", noWrap: true, sx: { flex: 1 } }, chat.activeThread?.title ?? "AI Chat"),
            /* @__PURE__ */ import_react18.default.createElement(import_material14.Tooltip, { title: rightPanelCollapsed ? "Show context panel" : "Hide context panel" }, /* @__PURE__ */ import_react18.default.createElement(import_material14.IconButton, { size: "small", onClick: () => setRightPanelCollapsed((v) => !v) }, rightPanelCollapsed ? /* @__PURE__ */ import_react18.default.createElement(import_ChevronLeft.default, { fontSize: "small" }) : /* @__PURE__ */ import_react18.default.createElement(import_ChevronRight.default, { fontSize: "small" })))
          ),
          chat.error && /* @__PURE__ */ import_react18.default.createElement(import_material14.Box, { sx: { px: 2, pt: 1 } }, /* @__PURE__ */ import_react18.default.createElement(ErrorBanner, { error: chat.error, onDismiss: () => {
          } })),
          /* @__PURE__ */ import_react18.default.createElement(
            import_material14.Box,
            {
              ref: messagesContainerRef,
              sx: {
                flex: 1,
                overflowY: "auto",
                minHeight: 0
              }
            },
            messages.length === 0 ? /* @__PURE__ */ import_react18.default.createElement(import_material14.Box, { sx: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ import_react18.default.createElement(import_material14.Typography, { color: "text.secondary" }, "Start a conversation\u2026")) : /* @__PURE__ */ import_react18.default.createElement(
              MessageList,
              {
                messages,
                streamingMessageIds: chat.streamingMessageIds,
                onFeedback: chat.submitFeedback,
                onRegenerate: chat.regenerateFrom,
                onEditAndResend: chat.editAndResend
              }
            ),
            /* @__PURE__ */ import_react18.default.createElement("div", { ref: messagesEndRef })
          ),
          (urlPreviewLoading || urlPreview || urlPreviewError) && /* @__PURE__ */ import_react18.default.createElement(import_material14.Box, { sx: { px: 2, pt: 1 } }, urlPreviewChip),
          (stagedFiles.length > 0 || attachError) && /* @__PURE__ */ import_react18.default.createElement(import_material14.Box, { sx: { px: 2, pt: 1, display: "flex", gap: 0.5, flexWrap: "wrap" } }, stagedFiles.map((f, i) => /* @__PURE__ */ import_react18.default.createElement(
            import_material14.Chip,
            {
              key: i,
              size: "small",
              icon: /* @__PURE__ */ import_react18.default.createElement(import_AttachFile.default, { fontSize: "small" }),
              label: f.filename ?? f.mediaType,
              variant: "outlined",
              onDelete: () => removeStagedFile(i),
              deleteIcon: /* @__PURE__ */ import_react18.default.createElement(import_Close.default, { fontSize: "small" })
            }
          )), attachError && /* @__PURE__ */ import_react18.default.createElement(
            import_material14.Chip,
            {
              size: "small",
              color: "error",
              label: attachError,
              variant: "outlined",
              onDelete: () => setAttachError(null),
              deleteIcon: /* @__PURE__ */ import_react18.default.createElement(import_Close.default, { fontSize: "small" })
            }
          )),
          /* @__PURE__ */ import_react18.default.createElement(
            import_material14.Box,
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
            /* @__PURE__ */ import_react18.default.createElement(import_material14.Tooltip, { title: "Attach image" }, /* @__PURE__ */ import_react18.default.createElement(import_material14.IconButton, { size: "small", onClick: () => attachInputRef.current?.click() }, /* @__PURE__ */ import_react18.default.createElement(import_AttachFile.default, { fontSize: "small" }))),
            /* @__PURE__ */ import_react18.default.createElement(
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
            /* @__PURE__ */ import_react18.default.createElement(
              import_material14.InputBase,
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
            isStreaming ? /* @__PURE__ */ import_react18.default.createElement(import_material14.Tooltip, { title: "Stop" }, /* @__PURE__ */ import_react18.default.createElement(import_material14.IconButton, { color: "error", onClick: chat.stopGeneration }, /* @__PURE__ */ import_react18.default.createElement(import_Stop.default, null))) : /* @__PURE__ */ import_react18.default.createElement(import_material14.Tooltip, { title: "Send" }, /* @__PURE__ */ import_react18.default.createElement(
              import_material14.IconButton,
              {
                color: "primary",
                onClick: handleSend,
                disabled: !input.trim()
              },
              /* @__PURE__ */ import_react18.default.createElement(import_Send.default, null)
            ))
          ),
          statusParts.length > 0 && /* @__PURE__ */ import_react18.default.createElement(import_material14.Box, { sx: { px: 2, pb: 1 } }, /* @__PURE__ */ import_react18.default.createElement(import_material14.Typography, { variant: "caption", color: "text.secondary" }, statusParts.join(" \xB7 ")))
        )
      ), !rightPanelCollapsed && /* @__PURE__ */ import_react18.default.createElement(
        import_material14.Box,
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
        /* @__PURE__ */ import_react18.default.createElement(SourcesPanel, { citations: chat.citations }),
        /* @__PURE__ */ import_react18.default.createElement(import_material14.Divider, null),
        /* @__PURE__ */ import_react18.default.createElement(
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
var import_react19, import_material15, BarList;
var init_BarList = __esm({
  "src/components/BarList.tsx"() {
    "use strict";
    import_react19 = __toESM(require("react"));
    import_material15 = require("@mui/material");
    BarList = ({ rows, emptyLabel = "No data yet." }) => {
      if (rows.length === 0) {
        return /* @__PURE__ */ import_react19.default.createElement(import_material15.Typography, { variant: "body2", color: "text.secondary" }, emptyLabel);
      }
      const max = Math.max(...rows.map((r) => r.count), 1);
      return /* @__PURE__ */ import_react19.default.createElement(import_material15.Box, { sx: { display: "flex", flexDirection: "column", gap: 1 } }, rows.map((row) => /* @__PURE__ */ import_react19.default.createElement(import_material15.Box, { key: row.key, sx: { display: "flex", alignItems: "center", gap: 1 } }, /* @__PURE__ */ import_react19.default.createElement(import_material15.Typography, { variant: "body2", sx: { width: 180, flexShrink: 0 }, noWrap: true, title: row.key }, row.key), /* @__PURE__ */ import_react19.default.createElement(import_material15.Box, { sx: { flex: 1, bgcolor: "action.hover", borderRadius: 1, overflow: "hidden", height: 18 } }, /* @__PURE__ */ import_react19.default.createElement(
        import_material15.Box,
        {
          sx: {
            width: `${row.count / max * 100}%`,
            height: "100%",
            bgcolor: "primary.main",
            borderRadius: 1
          }
        }
      )), /* @__PURE__ */ import_react19.default.createElement(import_material15.Typography, { variant: "body2", sx: { width: 40, textAlign: "right", flexShrink: 0 } }, row.count))));
    };
  }
});

// src/components/AnalyticsPage.tsx
var AnalyticsPage_exports = {};
__export(AnalyticsPage_exports, {
  AnalyticsPage: () => AnalyticsPage
});
var import_react20, import_material16, import_core_plugin_api7, RANGES, AnalyticsPage;
var init_AnalyticsPage = __esm({
  "src/components/AnalyticsPage.tsx"() {
    "use strict";
    import_react20 = __toESM(require("react"));
    import_material16 = require("@mui/material");
    import_core_plugin_api7 = require("@backstage/core-plugin-api");
    init_api();
    init_BarList();
    RANGES = [
      { value: "24h", label: "Last 24 hours" },
      { value: "7d", label: "Last 7 days" },
      { value: "30d", label: "Last 30 days" },
      { value: "all", label: "All time" }
    ];
    AnalyticsPage = () => {
      const chatApi = (0, import_core_plugin_api7.useApi)(aiConversationApiRef);
      const [range, setRange] = (0, import_react20.useState)("30d");
      const [bySkill, setBySkill] = (0, import_react20.useState)([]);
      const [byModel, setByModel] = (0, import_react20.useState)([]);
      const [feedback, setFeedback] = (0, import_react20.useState)(null);
      const [error, setError] = (0, import_react20.useState)(null);
      const [loading, setLoading] = (0, import_react20.useState)(true);
      (0, import_react20.useEffect)(() => {
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
      return /* @__PURE__ */ import_react20.default.createElement(import_material16.Box, { sx: { p: 3, maxWidth: 900, mx: "auto" } }, /* @__PURE__ */ import_react20.default.createElement(import_material16.Box, { sx: { display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 } }, /* @__PURE__ */ import_react20.default.createElement(import_material16.Typography, { variant: "h5" }, "AI Chat analytics"), /* @__PURE__ */ import_react20.default.createElement(import_material16.Select, { size: "small", value: range, onChange: (e) => setRange(e.target.value) }, RANGES.map((r) => /* @__PURE__ */ import_react20.default.createElement(import_material16.MenuItem, { key: r.value, value: r.value }, r.label)))), error && /* @__PURE__ */ import_react20.default.createElement(import_material16.Alert, { severity: "error", sx: { mb: 2 } }, error), /* @__PURE__ */ import_react20.default.createElement(import_material16.Box, { sx: { display: "flex", flexDirection: "column", gap: 2 } }, /* @__PURE__ */ import_react20.default.createElement(import_material16.Paper, { variant: "outlined", sx: { p: 2 } }, /* @__PURE__ */ import_react20.default.createElement(import_material16.Typography, { variant: "subtitle1", sx: { mb: 1.5 } }, "Turns by skill"), /* @__PURE__ */ import_react20.default.createElement(BarList, { rows: bySkill, emptyLabel: loading ? "Loading\u2026" : "No chat turns in this range." })), /* @__PURE__ */ import_react20.default.createElement(import_material16.Paper, { variant: "outlined", sx: { p: 2 } }, /* @__PURE__ */ import_react20.default.createElement(import_material16.Typography, { variant: "subtitle1", sx: { mb: 1.5 } }, "Turns by model"), /* @__PURE__ */ import_react20.default.createElement(BarList, { rows: byModel, emptyLabel: loading ? "Loading\u2026" : "No chat turns in this range." })), /* @__PURE__ */ import_react20.default.createElement(import_material16.Paper, { variant: "outlined", sx: { p: 2 } }, /* @__PURE__ */ import_react20.default.createElement(import_material16.Typography, { variant: "subtitle1", sx: { mb: 1.5 } }, "Feedback (all time)"), /* @__PURE__ */ import_react20.default.createElement(BarList, { rows: feedbackRows, emptyLabel: loading ? "Loading\u2026" : "No feedback recorded yet." }))));
    };
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AiConversationApi: () => AiConversationApi,
  AnalyticsPage: () => AnalyticsPage,
  ChatPage: () => ChatPage,
  aiConversationApiRef: () => aiConversationApiRef,
  aiConversationPlugin: () => aiConversationPlugin
});
module.exports = __toCommonJS(index_exports);

// src/plugin.tsx
var import_react21 = __toESM(require("react"));
var import_icons_material = require("@mui/icons-material");
var import_frontend_plugin_api = require("@backstage/frontend-plugin-api");
init_api();
var liteLlmChatApi = import_frontend_plugin_api.ApiBlueprint.make({
  params: (defineParams) => defineParams({
    api: aiConversationApiRef,
    deps: { fetchApi: import_frontend_plugin_api.fetchApiRef },
    factory: ({ fetchApi }) => new AiConversationApi(fetchApi)
  })
});
var chatPage = import_frontend_plugin_api.PageBlueprint.make({
  params: {
    path: "/ai-conversation",
    title: "AI Chat",
    icon: /* @__PURE__ */ import_react21.default.createElement(import_icons_material.Chat, null),
    loader: async () => {
      const { ChatPage: ChatPage2 } = await Promise.resolve().then(() => (init_ChatPage(), ChatPage_exports));
      return /* @__PURE__ */ import_react21.default.createElement(ChatPage2, null);
    }
  }
});
var analyticsPage = import_frontend_plugin_api.PageBlueprint.make({
  name: "analytics",
  params: {
    path: "/ai-conversation/analytics",
    title: "AI Chat Analytics",
    icon: /* @__PURE__ */ import_react21.default.createElement(import_icons_material.BarChart, null),
    loader: async () => {
      const { AnalyticsPage: AnalyticsPage2 } = await Promise.resolve().then(() => (init_AnalyticsPage(), AnalyticsPage_exports));
      return /* @__PURE__ */ import_react21.default.createElement(AnalyticsPage2, null);
    }
  }
});
var aiConversationPlugin = (0, import_frontend_plugin_api.createFrontendPlugin)({
  pluginId: "ai-conversation",
  extensions: [liteLlmChatApi, chatPage, analyticsPage]
});

// src/index.ts
init_ChatPage();
init_AnalyticsPage();
init_api();
//# sourceMappingURL=index.cjs.js.map
