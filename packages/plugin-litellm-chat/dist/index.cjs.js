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

// src/hooks/threadPersistence.ts
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
    messages: Array.isArray(raw.messages) ? raw.messages : [],
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
  }
});

// src/api.ts
function normalizeChunk(raw) {
  if (raw && typeof raw === "object" && ("error" in raw || "delta" in raw)) {
    return raw;
  }
  const chunk = {};
  const delta = raw?.choices?.[0]?.delta;
  const content = delta?.content ?? delta?.reasoning_content;
  if (typeof content === "string") chunk.delta = content;
  if (Array.isArray(raw?.search_results)) {
    chunk.search_results = raw.search_results.map((r) => ({
      filename: r.filename ?? r.file_name ?? r.title ?? r.source ?? r.name ?? "",
      score: typeof r.score === "number" ? r.score : 0,
      text: r.text ?? r.snippet ?? r.content ?? "",
      // LiteLLM doesn't tag result origin explicitly — a `url` field is the
      // best available signal that this came from web search, not the KB.
      source: r.url ? "web" : "kb",
      url: r.url
    }));
  }
  if (raw?.usage && typeof raw.usage === "object") {
    chunk.usage = {
      prompt_tokens: raw.usage.prompt_tokens ?? 0,
      completion_tokens: raw.usage.completion_tokens ?? 0,
      total_tokens: raw.usage.total_tokens ?? 0
    };
  }
  if (raw?.error) chunk.error = String(raw.error);
  return chunk;
}
var import_core_plugin_api, liteLlmChatApiRef, BASE_PATH, LiteLlmChatApi;
var init_api = __esm({
  "src/api.ts"() {
    "use strict";
    import_core_plugin_api = require("@backstage/core-plugin-api");
    init_threadPersistence();
    liteLlmChatApiRef = (0, import_core_plugin_api.createApiRef)({
      id: "plugin.litellm-chat.api"
    });
    BASE_PATH = "/api/litellm-chat";
    LiteLlmChatApi = class {
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
      chatStream(req, onToken, onDone, onError) {
        const controller = new AbortController();
        (async () => {
          try {
            const res = await this.fetchApi.fetch(`${BASE_PATH}/chat/stream`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(req),
              signal: controller.signal
            });
            if (!res.ok || !res.body) {
              const text = await res.text().catch(() => "");
              onError(new Error(`${res.status}: ${text || res.statusText}`));
              return;
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            for (; ; ) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;
                const payload = trimmed.slice(5).trim();
                if (payload === "[DONE]") {
                  onDone();
                  return;
                }
                try {
                  const raw = JSON.parse(payload);
                  const chunk = normalizeChunk(raw);
                  if (chunk.delta || chunk.error || chunk.search_results || chunk.usage) {
                    onToken(chunk);
                  }
                } catch {
                }
              }
            }
            onDone();
          } catch (err) {
            if (err.name === "AbortError") return;
            onError(err);
          }
        })();
        return controller;
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
    return { baseMessages: messages.slice(0, idx), text: target.content, isCompareEligible: true };
  }
  const turnId = target.turnId;
  let userIdx = idx - 1;
  while (userIdx >= 0 && !(messages[userIdx].role === "user" && (!turnId || messages[userIdx].turnId === turnId))) {
    userIdx -= 1;
  }
  if (userIdx < 0) return null;
  return {
    baseMessages: messages.slice(0, userIdx),
    text: messages[userIdx].content,
    isCompareEligible: !!target.compareModel
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
  }
});

// src/hooks/useChat.ts
function loadThreads(userId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${userId}`);
    return raw ? JSON.parse(raw) : [];
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
function useChat(opts) {
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
  const api = (0, import_core_plugin_api2.useApi)(liteLlmChatApiRef);
  const [threads, setThreads] = (0, import_react.useState)(() => loadThreads(userId));
  const [activeId, setActiveId] = (0, import_react.useState)(
    () => threads[0]?.id ?? null
  );
  const [streamingIds, setStreamingIds] = (0, import_react.useState)(/* @__PURE__ */ new Set());
  const [error, setError] = (0, import_react.useState)(null);
  const [citations, setCitations] = (0, import_react.useState)([]);
  const [keySpend, setKeySpend] = (0, import_react.useState)(null);
  const isStreaming = streamingIds.size > 0;
  const abortMapRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
  const threadsRef = (0, import_react.useRef)(threads);
  threadsRef.current = threads;
  const activeIdRef = (0, import_react.useRef)(activeId);
  activeIdRef.current = activeId;
  const saveTimeoutRef = (0, import_react.useRef)(null);
  const syncActiveThreadToBackend = (0, import_react.useCallback)(() => {
    if (!persistenceEnabled) return;
    const active = threadsRef.current.find((t) => t.id === activeIdRef.current);
    if (active) api.saveThread(active).catch(() => {
    });
  }, [persistenceEnabled, api]);
  (0, import_react.useEffect)(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveThreads(userId, threadsRef.current);
      syncActiveThreadToBackend();
    }, SAVE_DEBOUNCE_MS);
  }, [userId, threads, syncActiveThreadToBackend]);
  (0, import_react.useEffect)(() => {
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
  (0, import_react.useEffect)(() => {
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
  const activeThread = threads.find((t) => t.id === activeId) ?? null;
  (0, import_react.useEffect)(() => {
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
  const newThread = (0, import_react.useCallback)(() => {
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
  }, [
    model,
    vectorStoreIds,
    personaId,
    customSystemPrompt,
    keyAlias,
    keyToken
  ]);
  const selectThread = (0, import_react.useCallback)((id) => {
    setActiveId(id);
    setError(null);
    setCitations([]);
    setKeySpend(null);
  }, []);
  const deleteThread = (0, import_react.useCallback)(
    (id) => {
      const thread = threads.find((t) => t.id === id);
      const remaining = threads.filter((t) => t.id !== id);
      setThreads(remaining);
      if (activeId === id) {
        setActiveId(remaining[0]?.id ?? null);
      }
      if (thread?.keyToken) {
        api.deleteChatKey(thread.keyToken).catch(() => {
        });
      }
      if (persistenceEnabled) api.deleteThread(id).catch(() => {
      });
    },
    [activeId, threads, api, persistenceEnabled]
  );
  const stopGeneration = (0, import_react.useCallback)(() => {
    abortMapRef.current.forEach((controller) => controller.abort());
    abortMapRef.current.clear();
    setStreamingIds(/* @__PURE__ */ new Set());
  }, []);
  const startStream = (0, import_react.useCallback)(
    (threadId, assistantMsgId, reqMessages, reqModel, attachedUrl, onSettled) => {
      setStreamingIds((prev) => new Set(prev).add(assistantMsgId));
      const controller = api.chatStream(
        {
          model: reqModel,
          messages: reqMessages,
          thread_id: threadId,
          vector_store_ids: vectorStoreIds.length ? vectorStoreIds : void 0,
          persona_id: personaId || void 0,
          custom_system_prompt: customSystemPrompt || void 0,
          tone_id: toneId || void 0,
          focus_id: focusId || void 0,
          verbosity_id: verbosityId || void 0,
          reasoning_effort: reasoningEffort || void 0,
          context_url: attachedUrl?.url,
          web_search: webSearch || void 0,
          top_k: topK,
          user_key: keyToken
        },
        (chunk) => {
          if (chunk.error) {
            setError(chunk.error);
            return;
          }
          if (chunk.search_results) {
            setCitations(
              chunk.search_results.map((r) => ({
                filename: r.filename,
                score: r.score,
                snippet: r.text,
                source: r.source,
                url: r.url
              }))
            );
          }
          if (chunk.usage) {
            const usage = chunk.usage;
            setThreads(
              (prev) => prev.map(
                (t) => t.id === threadId ? {
                  ...t,
                  lastTurnUsage: usage,
                  totalTokens: t.totalTokens + usage.total_tokens
                } : t
              )
            );
          }
          if (chunk.delta) {
            setThreads(
              (prev) => prev.map((t) => {
                if (t.id !== threadId) return t;
                const msgs = t.messages.map(
                  (m) => m.id === assistantMsgId ? { ...m, content: m.content + chunk.delta } : m
                );
                return { ...t, messages: msgs, updatedAt: Date.now() };
              })
            );
          }
        },
        () => {
          abortMapRef.current.delete(assistantMsgId);
          setStreamingIds((prev) => {
            const next = new Set(prev);
            next.delete(assistantMsgId);
            return next;
          });
          onSettled();
        },
        (err) => {
          setError(err.message);
          abortMapRef.current.delete(assistantMsgId);
          setStreamingIds((prev) => {
            const next = new Set(prev);
            next.delete(assistantMsgId);
            return next;
          });
          onSettled();
        }
      );
      abortMapRef.current.set(assistantMsgId, controller);
    },
    [
      api,
      vectorStoreIds,
      personaId,
      customSystemPrompt,
      toneId,
      focusId,
      verbosityId,
      reasoningEffort,
      topK,
      keyToken,
      webSearch
    ]
  );
  const runSend = (0, import_react.useCallback)(
    (text, baseMessages, attachedUrl) => {
      if (!text.trim() || !activeThread || !keyToken) return;
      stopGeneration();
      setError(null);
      setCitations([]);
      const turnId = genId();
      const userMsg = { id: genId(), role: "user", content: text, attachedUrl, turnId };
      const assistantMsg = { id: genId(), role: "assistant", content: "", turnId };
      const threadId = activeThread.id;
      const updatedMessages = [...baseMessages, userMsg, assistantMsg];
      const currentKeyAlias = keyAlias;
      setThreads(
        (prev) => prev.map(
          (t) => t.id === threadId ? {
            ...t,
            messages: updatedMessages,
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
      const reqMessages = updatedMessages.slice(0, -1);
      startStream(threadId, assistantMsg.id, reqMessages, model, attachedUrl, () => {
        if (currentKeyAlias) {
          api.getKeySpend(currentKeyAlias).then(setKeySpend).catch(() => {
          });
        }
      });
    },
    [
      activeThread,
      api,
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
      startStream,
      stopGeneration
    ]
  );
  const runCompareSend = (0, import_react.useCallback)(
    (text, baseMessages, models, attachedUrl) => {
      if (!text.trim() || !activeThread || !keyToken || models.length === 0) return;
      stopGeneration();
      setError(null);
      setCitations([]);
      const turnId = genId();
      const userMsg = { id: genId(), role: "user", content: text, attachedUrl, turnId };
      const assistantMsgs = models.map((m) => ({
        id: genId(),
        role: "assistant",
        content: "",
        turnId,
        compareModel: m
      }));
      const threadId = activeThread.id;
      const updatedMessages = [...baseMessages, userMsg, ...assistantMsgs];
      const currentKeyAlias = keyAlias;
      const reqMessagesBase = [...baseMessages, userMsg];
      setThreads(
        (prev) => prev.map(
          (t) => t.id === threadId ? {
            ...t,
            messages: updatedMessages,
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
      assistantMsgs.forEach((am) => {
        startStream(threadId, am.id, reqMessagesBase, am.compareModel, attachedUrl, () => {
          if (currentKeyAlias) {
            api.getKeySpend(currentKeyAlias).then(setKeySpend).catch(() => {
            });
          }
        });
      });
    },
    [
      activeThread,
      api,
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
      startStream,
      stopGeneration
    ]
  );
  const sendMessage = (0, import_react.useCallback)(
    (text, attachedUrl, compareModelsOverride) => {
      if (!activeThread) return;
      const models = compareModelsOverride ?? (activeThread.mode === "compare" ? activeThread.compareModels : void 0);
      if (models?.length) {
        runCompareSend(text, activeThread.messages, models, attachedUrl);
      } else {
        runSend(text, activeThread.messages, attachedUrl);
      }
    },
    [activeThread, runSend, runCompareSend]
  );
  const regenerateFrom = (0, import_react.useCallback)(
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
  const editAndResend = (0, import_react.useCallback)(
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
  const setCompareMode = (0, import_react.useCallback)(
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
  const togglePin = (0, import_react.useCallback)(
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
  const exportThread = (0, import_react.useCallback)(
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
  const importThread = (0, import_react.useCallback)(async (file) => {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Not valid JSON");
    }
    const payload = parsed;
    if (payload?.version !== THREAD_EXPORT_VERSION || !payload.thread || typeof payload.thread.id !== "string" || !Array.isArray(payload.thread.messages)) {
      throw new Error("Unrecognized thread export format");
    }
    const src = payload.thread;
    const imported = {
      id: genId(),
      title: typeof src.title === "string" ? src.title : "Imported chat",
      messages: src.messages,
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
  const submitFeedback = (0, import_react.useCallback)(
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
              (m) => m.id === messageId ? { ...m, feedback: vote } : m
            )
          }
        )
      );
      api.sendFeedback({
        threadId,
        messageId,
        vote,
        question: question?.content ?? "",
        answer: message.content,
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
  const clearError = (0, import_react.useCallback)(() => setError(null), []);
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
    streamingMessageIds: streamingIds,
    error,
    clearError,
    citations,
    keySpend
  };
}
var import_react, import_core_plugin_api2, THREAD_EXPORT_VERSION, STORAGE_PREFIX, SAVE_DEBOUNCE_MS;
var init_useChat = __esm({
  "src/hooks/useChat.ts"() {
    "use strict";
    import_react = require("react");
    import_core_plugin_api2 = require("@backstage/core-plugin-api");
    init_api();
    init_chatTruncation();
    init_threadPersistence();
    THREAD_EXPORT_VERSION = 1;
    STORAGE_PREFIX = "litellm-chat:threads";
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
  injectStylesheetOnce("litellm-chat-jetbrains-mono", JETBRAINS_MONO_URL);
  injectStylesheetOnce("litellm-chat-katex-css", KATEX_CSS_URL);
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
var import_react2, import_material, import_core_plugin_api3, import_backstage_plugin_litellm, ModelPicker;
var init_ModelPicker = __esm({
  "src/components/ModelPicker.tsx"() {
    "use strict";
    import_react2 = __toESM(require("react"));
    import_material = require("@mui/material");
    import_core_plugin_api3 = require("@backstage/core-plugin-api");
    import_backstage_plugin_litellm = require("@acarmisc/backstage-plugin-litellm");
    ModelPicker = ({
      value,
      onChange,
      defaultModel
    }) => {
      const liteLlmApi = (0, import_core_plugin_api3.useApi)(import_backstage_plugin_litellm.liteLlmApiRef);
      const [models, setModels] = (0, import_react2.useState)([]);
      const [loading, setLoading] = (0, import_react2.useState)(true);
      const [error, setError] = (0, import_react2.useState)(null);
      (0, import_react2.useEffect)(() => {
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
      return /* @__PURE__ */ import_react2.default.createElement(import_material.FormControl, { size: "small", error: !!error, sx: { minWidth: 200 } }, /* @__PURE__ */ import_react2.default.createElement(import_material.InputLabel, null, "Model"), /* @__PURE__ */ import_react2.default.createElement(
        import_material.Select,
        {
          value,
          label: "Model",
          onChange: (e) => onChange(e.target.value),
          disabled: loading
        },
        models.map((m) => /* @__PURE__ */ import_react2.default.createElement(import_material.MenuItem, { key: m.model_name, value: m.model_name }, m.model_name))
      ), error && /* @__PURE__ */ import_react2.default.createElement(import_material.Typography, { variant: "caption", color: "error", sx: { mt: 0.5 } }, error));
    };
  }
});

// src/components/CompareModelPicker.tsx
var import_react3, import_material2, import_CheckBoxOutlineBlank, import_CheckBox, import_core_plugin_api4, import_backstage_plugin_litellm2, CompareModelPicker;
var init_CompareModelPicker = __esm({
  "src/components/CompareModelPicker.tsx"() {
    "use strict";
    import_react3 = __toESM(require("react"));
    import_material2 = require("@mui/material");
    import_CheckBoxOutlineBlank = __toESM(require("@mui/icons-material/CheckBoxOutlineBlank"));
    import_CheckBox = __toESM(require("@mui/icons-material/CheckBox"));
    import_core_plugin_api4 = require("@backstage/core-plugin-api");
    import_backstage_plugin_litellm2 = require("@acarmisc/backstage-plugin-litellm");
    CompareModelPicker = ({ value, onChange }) => {
      const liteLlmApi = (0, import_core_plugin_api4.useApi)(import_backstage_plugin_litellm2.liteLlmApiRef);
      const [models, setModels] = (0, import_react3.useState)([]);
      const [loading, setLoading] = (0, import_react3.useState)(true);
      const [error, setError] = (0, import_react3.useState)(null);
      (0, import_react3.useEffect)(() => {
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
      return /* @__PURE__ */ import_react3.default.createElement(import_material2.Box, null, /* @__PURE__ */ import_react3.default.createElement(
        import_material2.Autocomplete,
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
          renderOption: (props, option, { selected: isSelected }) => /* @__PURE__ */ import_react3.default.createElement("li", { ...props, key: option.model_name }, /* @__PURE__ */ import_react3.default.createElement(
            import_material2.Checkbox,
            {
              icon: /* @__PURE__ */ import_react3.default.createElement(import_CheckBoxOutlineBlank.default, { fontSize: "small" }),
              checkedIcon: /* @__PURE__ */ import_react3.default.createElement(import_CheckBox.default, { fontSize: "small" }),
              checked: isSelected,
              size: "small",
              sx: { mr: 1, p: 0 }
            }
          ), option.model_name),
          renderTags: (tagValue, getTagProps) => tagValue.map((option, index) => /* @__PURE__ */ import_react3.default.createElement(import_material2.Chip, { ...getTagProps({ index }), key: option.model_name, size: "small", label: option.model_name })),
          renderInput: (params) => /* @__PURE__ */ import_react3.default.createElement(
            import_material2.TextField,
            {
              ...params,
              label: "Compare models",
              placeholder: value.length ? void 0 : "Pick 2+ models\u2026",
              error: !!error
            }
          ),
          sx: { minWidth: 200 }
        }
      ), error && /* @__PURE__ */ import_react3.default.createElement(import_material2.Typography, { variant: "caption", color: "error", sx: { display: "block", mt: 0.5 } }, error));
    };
  }
});

// src/components/VectorStorePicker.tsx
var import_react4, import_material3, import_CheckBoxOutlineBlank2, import_CheckBox2, import_core_plugin_api5, VectorStorePicker;
var init_VectorStorePicker = __esm({
  "src/components/VectorStorePicker.tsx"() {
    "use strict";
    import_react4 = __toESM(require("react"));
    import_material3 = require("@mui/material");
    import_CheckBoxOutlineBlank2 = __toESM(require("@mui/icons-material/CheckBoxOutlineBlank"));
    import_CheckBox2 = __toESM(require("@mui/icons-material/CheckBox"));
    import_core_plugin_api5 = require("@backstage/core-plugin-api");
    init_api();
    VectorStorePicker = ({
      value,
      onChange,
      defaultVectorStoreIds
    }) => {
      const chatApi = (0, import_core_plugin_api5.useApi)(liteLlmChatApiRef);
      const [stores, setStores] = (0, import_react4.useState)([]);
      const [loading, setLoading] = (0, import_react4.useState)(true);
      const [error, setError] = (0, import_react4.useState)(null);
      (0, import_react4.useEffect)(() => {
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
      return /* @__PURE__ */ import_react4.default.createElement(import_material3.Box, null, /* @__PURE__ */ import_react4.default.createElement(
        import_material3.Autocomplete,
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
          renderOption: (props, option, { selected: isSelected }) => /* @__PURE__ */ import_react4.default.createElement("li", { ...props, key: option.id }, /* @__PURE__ */ import_react4.default.createElement(
            import_material3.Checkbox,
            {
              icon: /* @__PURE__ */ import_react4.default.createElement(import_CheckBoxOutlineBlank2.default, { fontSize: "small" }),
              checkedIcon: /* @__PURE__ */ import_react4.default.createElement(import_CheckBox2.default, { fontSize: "small" }),
              checked: isSelected,
              size: "small",
              sx: { mr: 1, p: 0 }
            }
          ), option.name, " ", option.file_count != null ? `(${option.file_count})` : ""),
          renderTags: (tagValue, getTagProps) => tagValue.map((option, index) => /* @__PURE__ */ import_react4.default.createElement(
            import_material3.Chip,
            {
              ...getTagProps({ index }),
              key: option.id,
              size: "small",
              label: option.name
            }
          )),
          renderInput: (params) => /* @__PURE__ */ import_react4.default.createElement(
            import_material3.TextField,
            {
              ...params,
              label: "Knowledge bases",
              placeholder: value.length ? void 0 : "None (no grounding)",
              error: !!error
            }
          ),
          sx: { minWidth: 200 }
        }
      ), error && /* @__PURE__ */ import_react4.default.createElement(import_material3.Typography, { variant: "caption", color: "error", sx: { display: "block", mt: 0.5 } }, error));
    };
  }
});

// src/components/PersonaPicker.tsx
var import_react5, import_material4, PersonaPicker;
var init_PersonaPicker = __esm({
  "src/components/PersonaPicker.tsx"() {
    "use strict";
    import_react5 = __toESM(require("react"));
    import_material4 = require("@mui/material");
    PersonaPicker = ({
      value,
      personas,
      loading,
      error,
      onChange
    }) => {
      return /* @__PURE__ */ import_react5.default.createElement(import_material4.FormControl, { size: "small", error: !!error, sx: { minWidth: 200 } }, /* @__PURE__ */ import_react5.default.createElement(import_material4.InputLabel, { shrink: true }, "Persona"), /* @__PURE__ */ import_react5.default.createElement(
        import_material4.Select,
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
        /* @__PURE__ */ import_react5.default.createElement(import_material4.MenuItem, { value: "" }, /* @__PURE__ */ import_react5.default.createElement("em", null, "None")),
        personas.map((p) => /* @__PURE__ */ import_react5.default.createElement(import_material4.MenuItem, { key: p.id, value: p.id }, p.title))
      ), error && /* @__PURE__ */ import_react5.default.createElement(import_material4.Typography, { variant: "caption", color: "error", sx: { mt: 0.5 } }, error));
    };
  }
});

// src/components/PersonaHomepage.tsx
var import_react6, import_material5, import_Person, PersonaHomepage;
var init_PersonaHomepage = __esm({
  "src/components/PersonaHomepage.tsx"() {
    "use strict";
    import_react6 = __toESM(require("react"));
    import_material5 = require("@mui/material");
    import_Person = __toESM(require("@mui/icons-material/Person"));
    PersonaHomepage = ({
      personas,
      loading,
      error,
      selectedId,
      onSelect
    }) => {
      if (loading) {
        return /* @__PURE__ */ import_react6.default.createElement(import_material5.Box, { sx: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ import_react6.default.createElement(import_material5.CircularProgress, { size: 24 }));
      }
      if (error || personas.length === 0) {
        return /* @__PURE__ */ import_react6.default.createElement(import_material5.Box, { sx: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ import_react6.default.createElement(import_material5.Typography, { color: "text.secondary" }, error ? `Couldn't load personas: ${error}` : "Start a conversation\u2026"));
      }
      return /* @__PURE__ */ import_react6.default.createElement(
        import_material5.Box,
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
        /* @__PURE__ */ import_react6.default.createElement(import_material5.Typography, { variant: "subtitle1", align: "center", color: "text.secondary" }, "Pick a persona to get started, or just start typing"),
        /* @__PURE__ */ import_react6.default.createElement(
          import_material5.Box,
          {
            sx: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 1.5
            }
          },
          personas.map((p) => {
            const selected = p.id === selectedId;
            return /* @__PURE__ */ import_react6.default.createElement(
              import_material5.Box,
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
              /* @__PURE__ */ import_react6.default.createElement(import_material5.Box, { sx: { display: "flex", alignItems: "center", gap: 0.75 } }, /* @__PURE__ */ import_react6.default.createElement(import_Person.default, { fontSize: "small", color: selected ? "primary" : "action" }), /* @__PURE__ */ import_react6.default.createElement(import_material5.Typography, { variant: "body2", sx: { fontWeight: 600 }, noWrap: true }, p.title)),
              p.description && /* @__PURE__ */ import_react6.default.createElement(
                import_material5.Typography,
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
              p.tags && p.tags.length > 0 && /* @__PURE__ */ import_react6.default.createElement(import_material5.Box, { sx: { display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 } }, p.tags.map((tag) => /* @__PURE__ */ import_react6.default.createElement(import_material5.Chip, { key: tag, label: tag, size: "small", variant: "outlined" })))
            );
          })
        )
      );
    };
  }
});

// src/components/KeyPicker.tsx
var import_react7, import_material6, import_VpnKey, import_Delete, import_core_plugin_api6, KeyPicker;
var init_KeyPicker = __esm({
  "src/components/KeyPicker.tsx"() {
    "use strict";
    import_react7 = __toESM(require("react"));
    import_material6 = require("@mui/material");
    import_VpnKey = __toESM(require("@mui/icons-material/VpnKey"));
    import_Delete = __toESM(require("@mui/icons-material/Delete"));
    import_core_plugin_api6 = require("@backstage/core-plugin-api");
    init_api();
    KeyPicker = ({ value, onChange, onDelete }) => {
      const chatApi = (0, import_core_plugin_api6.useApi)(liteLlmChatApiRef);
      const [loading, setLoading] = (0, import_react7.useState)(false);
      const [error, setError] = (0, import_react7.useState)(null);
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
        return /* @__PURE__ */ import_react7.default.createElement(import_material6.Box, { sx: { display: "flex", alignItems: "center", gap: 1, minWidth: 200 } }, /* @__PURE__ */ import_react7.default.createElement(import_VpnKey.default, { fontSize: "small", color: "success" }), /* @__PURE__ */ import_react7.default.createElement(import_material6.Typography, { variant: "body2", sx: { flex: 1, overflow: "hidden", textOverflow: "ellipsis" } }, value.alias || "chat key"), /* @__PURE__ */ import_react7.default.createElement(import_material6.Tooltip, { title: "Delete chat key" }, /* @__PURE__ */ import_react7.default.createElement(import_material6.IconButton, { edge: "end", size: "small", onClick: handleDelete }, /* @__PURE__ */ import_react7.default.createElement(import_Delete.default, { fontSize: "small" }))));
      }
      return /* @__PURE__ */ import_react7.default.createElement(import_material6.Box, { sx: { minWidth: 200 } }, /* @__PURE__ */ import_react7.default.createElement(
        import_material6.Button,
        {
          size: "small",
          variant: "outlined",
          startIcon: loading ? /* @__PURE__ */ import_react7.default.createElement(import_material6.CircularProgress, { size: 16 }) : /* @__PURE__ */ import_react7.default.createElement(import_VpnKey.default, null),
          onClick: handleGenerate,
          disabled: loading
        },
        loading ? "Minting\u2026" : "Generate chat key"
      ), error && /* @__PURE__ */ import_react7.default.createElement(import_material6.Typography, { variant: "caption", color: "error", sx: { display: "block", mt: 0.5 } }, error));
    };
  }
});

// src/components/OptionPicker.tsx
var import_react8, import_material7, OptionPicker;
var init_OptionPicker = __esm({
  "src/components/OptionPicker.tsx"() {
    "use strict";
    import_react8 = __toESM(require("react"));
    import_material7 = require("@mui/material");
    OptionPicker = ({
      label,
      value,
      options,
      onChange,
      loading,
      noneLabel = "Default"
    }) => {
      return /* @__PURE__ */ import_react8.default.createElement(import_material7.FormControl, { size: "small", sx: { minWidth: 160 } }, /* @__PURE__ */ import_react8.default.createElement(import_material7.InputLabel, { shrink: true }, label), /* @__PURE__ */ import_react8.default.createElement(
        import_material7.Select,
        {
          value,
          label,
          displayEmpty: true,
          onChange: (e) => onChange(e.target.value),
          disabled: loading
        },
        /* @__PURE__ */ import_react8.default.createElement(import_material7.MenuItem, { value: "" }, /* @__PURE__ */ import_react8.default.createElement("em", null, noneLabel)),
        options.map((o) => /* @__PURE__ */ import_react8.default.createElement(import_material7.MenuItem, { key: o.id, value: o.id }, o.label))
      ));
    };
  }
});

// src/components/PersonaAvatar.tsx
var import_react9, import_material8, PersonaAvatar;
var init_PersonaAvatar = __esm({
  "src/components/PersonaAvatar.tsx"() {
    "use strict";
    import_react9 = __toESM(require("react"));
    import_material8 = require("@mui/material");
    init_theme();
    PersonaAvatar = ({
      label,
      isStreaming = false,
      size = 32
    }) => {
      const ringSize = size + 4;
      return /* @__PURE__ */ import_react9.default.createElement(import_material8.Box, { sx: { position: "relative", width: ringSize, height: ringSize, flexShrink: 0 } }, /* @__PURE__ */ import_react9.default.createElement(
        import_material8.Box,
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
      ), /* @__PURE__ */ import_react9.default.createElement(
        import_material8.Avatar,
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
function extractText(node) {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (import_react10.default.isValidElement(node)) {
    return extractText(node.props.children);
  }
  return "";
}
var import_react10, import_material9, import_ContentCopy, import_Check, CodeBlock;
var init_CodeBlock = __esm({
  "src/components/CodeBlock.tsx"() {
    "use strict";
    import_react10 = __toESM(require("react"));
    import_material9 = require("@mui/material");
    import_ContentCopy = __toESM(require("@mui/icons-material/ContentCopy"));
    import_Check = __toESM(require("@mui/icons-material/Check"));
    init_theme();
    CodeBlock = ({
      className,
      children,
      ...props
    }) => {
      const [copied, setCopied] = (0, import_react10.useState)(false);
      const isBlock = /language-/.test(className ?? "");
      if (!isBlock) {
        return /* @__PURE__ */ import_react10.default.createElement("code", { className, style: { fontFamily: MONO_FONT_STACK }, ...props }, children);
      }
      const handleCopy = () => {
        const text = extractText(children).replace(/\n$/, "");
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      };
      return /* @__PURE__ */ import_react10.default.createElement(import_material9.Box, { sx: { position: "relative", "&:hover .litellm-copy-btn": { opacity: 1 } } }, /* @__PURE__ */ import_react10.default.createElement(import_material9.Tooltip, { title: copied ? "Copied" : "Copy code" }, /* @__PURE__ */ import_react10.default.createElement(
        import_material9.IconButton,
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
        copied ? /* @__PURE__ */ import_react10.default.createElement(import_Check.default, { fontSize: "inherit" }) : /* @__PURE__ */ import_react10.default.createElement(import_ContentCopy.default, { fontSize: "inherit" })
      )), /* @__PURE__ */ import_react10.default.createElement("code", { className, style: { fontFamily: MONO_FONT_STACK }, ...props }, children));
    };
  }
});

// src/components/AssistantMessage.tsx
var import_react11, import_material10, import_ThumbUp, import_ThumbUpOutlined, import_ThumbDown, import_ThumbDownOutlined, import_ContentCopy2, import_Check2, import_Replay, import_react_markdown, import_remark_gfm, import_remark_math, import_rehype_katex, blink, AssistantMessage;
var init_AssistantMessage = __esm({
  "src/components/AssistantMessage.tsx"() {
    "use strict";
    import_react11 = __toESM(require("react"));
    import_material10 = require("@mui/material");
    import_ThumbUp = __toESM(require("@mui/icons-material/ThumbUp"));
    import_ThumbUpOutlined = __toESM(require("@mui/icons-material/ThumbUpOutlined"));
    import_ThumbDown = __toESM(require("@mui/icons-material/ThumbDown"));
    import_ThumbDownOutlined = __toESM(require("@mui/icons-material/ThumbDownOutlined"));
    import_ContentCopy2 = __toESM(require("@mui/icons-material/ContentCopy"));
    import_Check2 = __toESM(require("@mui/icons-material/Check"));
    import_Replay = __toESM(require("@mui/icons-material/Replay"));
    import_react_markdown = __toESM(require("react-markdown"));
    import_remark_gfm = __toESM(require("remark-gfm"));
    import_remark_math = __toESM(require("remark-math"));
    import_rehype_katex = __toESM(require("rehype-katex"));
    init_PersonaAvatar();
    init_CodeBlock();
    blink = {
      "@keyframes blink": {
        "0%, 50%": { opacity: 1 },
        "51%, 100%": { opacity: 0 }
      }
    };
    AssistantMessage = ({
      message,
      isStreaming,
      avatarLabel = "AI",
      onFeedback,
      onRegenerate
    }) => {
      const [copied, setCopied] = (0, import_react11.useState)(false);
      const showActions = !!message.content && !isStreaming;
      const handleCopy = () => {
        navigator.clipboard?.writeText(message.content).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      };
      let body;
      if (message.content) {
        body = /* @__PURE__ */ import_react11.default.createElement(
          import_react_markdown.default,
          {
            remarkPlugins: [import_remark_gfm.default, import_remark_math.default],
            rehypePlugins: [import_rehype_katex.default],
            components: { code: CodeBlock }
          },
          message.content
        );
      } else if (isStreaming) {
        body = /* @__PURE__ */ import_react11.default.createElement(
          import_material10.Box,
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
      } else {
        body = null;
      }
      return /* @__PURE__ */ import_react11.default.createElement(
        import_material10.Box,
        {
          sx: {
            display: "flex",
            gap: 1,
            alignSelf: "flex-start",
            maxWidth: "85%",
            "&:hover .litellm-actions": { opacity: 1 }
          }
        },
        /* @__PURE__ */ import_react11.default.createElement(PersonaAvatar, { label: avatarLabel.slice(0, 2).toUpperCase(), isStreaming, size: 28 }),
        /* @__PURE__ */ import_react11.default.createElement(import_material10.Box, { sx: { minWidth: 0, flex: 1 } }, /* @__PURE__ */ import_react11.default.createElement(
          import_material10.Box,
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
        ), showActions && /* @__PURE__ */ import_react11.default.createElement(
          import_material10.Box,
          {
            className: "litellm-actions",
            sx: { display: "flex", gap: 0.25, mt: 0.25, opacity: 0, transition: "opacity 0.15s" }
          },
          onFeedback && /* @__PURE__ */ import_react11.default.createElement(import_react11.default.Fragment, null, /* @__PURE__ */ import_react11.default.createElement(
            import_material10.IconButton,
            {
              size: "small",
              "aria-label": "Good response",
              color: message.feedback === "up" ? "primary" : "default",
              onClick: () => onFeedback(message.id, "up")
            },
            message.feedback === "up" ? /* @__PURE__ */ import_react11.default.createElement(import_ThumbUp.default, { fontSize: "small" }) : /* @__PURE__ */ import_react11.default.createElement(import_ThumbUpOutlined.default, { fontSize: "small" })
          ), /* @__PURE__ */ import_react11.default.createElement(
            import_material10.IconButton,
            {
              size: "small",
              "aria-label": "Bad response",
              color: message.feedback === "down" ? "primary" : "default",
              onClick: () => onFeedback(message.id, "down")
            },
            message.feedback === "down" ? /* @__PURE__ */ import_react11.default.createElement(import_ThumbDown.default, { fontSize: "small" }) : /* @__PURE__ */ import_react11.default.createElement(import_ThumbDownOutlined.default, { fontSize: "small" })
          )),
          onRegenerate && /* @__PURE__ */ import_react11.default.createElement(import_material10.Tooltip, { title: "Regenerate" }, /* @__PURE__ */ import_react11.default.createElement(import_material10.IconButton, { size: "small", "aria-label": "Regenerate", onClick: () => onRegenerate(message.id) }, /* @__PURE__ */ import_react11.default.createElement(import_Replay.default, { fontSize: "small" }))),
          /* @__PURE__ */ import_react11.default.createElement(import_material10.Tooltip, { title: copied ? "Copied" : "Copy" }, /* @__PURE__ */ import_react11.default.createElement(import_material10.IconButton, { size: "small", "aria-label": "Copy", onClick: handleCopy }, copied ? /* @__PURE__ */ import_react11.default.createElement(import_Check2.default, { fontSize: "small" }) : /* @__PURE__ */ import_react11.default.createElement(import_ContentCopy2.default, { fontSize: "small" })))
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
var import_react12, import_material11, import_ContentCopy3, import_Check3, import_Edit, import_Link, UserMessage;
var init_UserMessage = __esm({
  "src/components/UserMessage.tsx"() {
    "use strict";
    import_react12 = __toESM(require("react"));
    import_material11 = require("@mui/material");
    import_ContentCopy3 = __toESM(require("@mui/icons-material/ContentCopy"));
    import_Check3 = __toESM(require("@mui/icons-material/Check"));
    import_Edit = __toESM(require("@mui/icons-material/Edit"));
    import_Link = __toESM(require("@mui/icons-material/Link"));
    init_safeUrl();
    UserMessage = ({ message, onEditAndResend }) => {
      const [editing, setEditing] = (0, import_react12.useState)(false);
      const [draft, setDraft] = (0, import_react12.useState)(message.content);
      const [copied, setCopied] = (0, import_react12.useState)(false);
      const handleCopy = () => {
        navigator.clipboard?.writeText(message.content).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      };
      const startEdit = () => {
        setDraft(message.content);
        setEditing(true);
      };
      const saveEdit = () => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== message.content) {
          onEditAndResend?.(message.id, trimmed);
        }
        setEditing(false);
      };
      if (editing) {
        return /* @__PURE__ */ import_react12.default.createElement(import_material11.Box, { sx: { alignSelf: "flex-end", maxWidth: "80%", width: "100%", display: "flex", flexDirection: "column", gap: 0.5 } }, /* @__PURE__ */ import_react12.default.createElement(
          import_material11.TextField,
          {
            value: draft,
            onChange: (e) => setDraft(e.target.value),
            multiline: true,
            minRows: 1,
            maxRows: 8,
            size: "small",
            fullWidth: true
          }
        ), /* @__PURE__ */ import_react12.default.createElement(import_material11.Box, { sx: { display: "flex", gap: 1, justifyContent: "flex-end" } }, /* @__PURE__ */ import_react12.default.createElement(import_material11.Button, { size: "small", onClick: () => setEditing(false) }, "Cancel"), /* @__PURE__ */ import_react12.default.createElement(import_material11.Button, { size: "small", variant: "contained", onClick: saveEdit, disabled: !draft.trim() }, "Save & resend")));
      }
      return /* @__PURE__ */ import_react12.default.createElement(
        import_material11.Box,
        {
          sx: {
            alignSelf: "flex-end",
            maxWidth: "80%",
            "&:hover .litellm-actions": { opacity: 1 }
          }
        },
        message.attachedUrl && /* @__PURE__ */ import_react12.default.createElement(import_material11.Box, { sx: { display: "flex", justifyContent: "flex-end", mb: 0.5 } }, /* @__PURE__ */ import_react12.default.createElement(import_material11.Tooltip, { title: message.attachedUrl.url }, /* @__PURE__ */ import_react12.default.createElement(
          import_material11.Chip,
          {
            size: "small",
            icon: /* @__PURE__ */ import_react12.default.createElement(import_Link.default, { fontSize: "small" }),
            label: message.attachedUrl.title,
            variant: "outlined",
            ...safeHref(message.attachedUrl.url) ? {
              component: "a",
              href: safeHref(message.attachedUrl.url),
              target: "_blank",
              rel: "noopener noreferrer",
              clickable: true
            } : {}
          }
        ))),
        /* @__PURE__ */ import_react12.default.createElement(
          import_material11.Box,
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
          message.content
        ),
        /* @__PURE__ */ import_react12.default.createElement(
          import_material11.Box,
          {
            className: "litellm-actions",
            sx: { display: "flex", gap: 0.25, mt: 0.25, justifyContent: "flex-end", opacity: 0, transition: "opacity 0.15s" }
          },
          onEditAndResend && /* @__PURE__ */ import_react12.default.createElement(import_material11.Tooltip, { title: "Edit & resend" }, /* @__PURE__ */ import_react12.default.createElement(import_material11.IconButton, { size: "small", "aria-label": "Edit and resend", onClick: startEdit }, /* @__PURE__ */ import_react12.default.createElement(import_Edit.default, { fontSize: "small" }))),
          /* @__PURE__ */ import_react12.default.createElement(import_material11.Tooltip, { title: copied ? "Copied" : "Copy" }, /* @__PURE__ */ import_react12.default.createElement(import_material11.IconButton, { size: "small", "aria-label": "Copy", onClick: handleCopy }, copied ? /* @__PURE__ */ import_react12.default.createElement(import_Check3.default, { fontSize: "small" }) : /* @__PURE__ */ import_react12.default.createElement(import_ContentCopy3.default, { fontSize: "small" })))
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
var import_react13, import_material12, MessageList;
var init_MessageList = __esm({
  "src/components/MessageList.tsx"() {
    "use strict";
    import_react13 = __toESM(require("react"));
    import_material12 = require("@mui/material");
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
      return /* @__PURE__ */ import_react13.default.createElement(
        import_material12.Box,
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
        groups.map((group, gi) => /* @__PURE__ */ import_react13.default.createElement(import_react13.default.Fragment, { key: group.user?.id ?? `g${gi}` }, group.user && /* @__PURE__ */ import_react13.default.createElement(UserMessage, { message: group.user, onEditAndResend }), group.assistants.length > 1 ? /* @__PURE__ */ import_react13.default.createElement(import_material12.Box, { sx: { display: "flex", gap: 1.5, overflowX: "auto", width: "100%" } }, group.assistants.map((msg) => /* @__PURE__ */ import_react13.default.createElement(import_material12.Box, { key: msg.id, sx: { flex: "1 1 320px", minWidth: 280, maxWidth: "none" } }, msg.compareModel && /* @__PURE__ */ import_react13.default.createElement(import_material12.Typography, { variant: "caption", color: "text.secondary", sx: { display: "block", mb: 0.25 } }, msg.compareModel), /* @__PURE__ */ import_react13.default.createElement(
          AssistantMessage,
          {
            message: msg,
            isStreaming: streamingMessageIds.has(msg.id),
            avatarLabel: msg.compareModel ?? avatarLabel,
            onFeedback,
            onRegenerate
          }
        )))) : group.assistants.map((msg) => /* @__PURE__ */ import_react13.default.createElement(
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
var import_react14, import_material13, ErrorBanner;
var init_ErrorBanner = __esm({
  "src/components/ErrorBanner.tsx"() {
    "use strict";
    import_react14 = __toESM(require("react"));
    import_material13 = require("@mui/material");
    ErrorBanner = ({ error, onDismiss }) => {
      if (!error) return null;
      return /* @__PURE__ */ import_react14.default.createElement(import_material13.Alert, { severity: "error", onClose: onDismiss, sx: { mb: 1 } }, /* @__PURE__ */ import_react14.default.createElement(import_material13.AlertTitle, null, "Chat error"), error);
    };
  }
});

// src/components/SourcesPanel.tsx
var import_react15, import_material14, SourcesPanel;
var init_SourcesPanel = __esm({
  "src/components/SourcesPanel.tsx"() {
    "use strict";
    import_react15 = __toESM(require("react"));
    import_material14 = require("@mui/material");
    init_safeUrl();
    SourcesPanel = ({ citations }) => {
      return /* @__PURE__ */ import_react15.default.createElement(import_material14.Box, { sx: { p: 1.5 } }, /* @__PURE__ */ import_react15.default.createElement(import_material14.Typography, { variant: "overline", color: "text.secondary" }, "Sources"), citations.length === 0 ? /* @__PURE__ */ import_react15.default.createElement(import_material14.Typography, { variant: "body2", color: "text.secondary", sx: { mt: 0.5 } }, "No sources for the latest reply yet.") : citations.map((c, i) => /* @__PURE__ */ import_react15.default.createElement(import_material14.Box, { key: i, sx: { mt: 1.5 } }, /* @__PURE__ */ import_react15.default.createElement(import_material14.Box, { sx: { display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ import_react15.default.createElement(import_material14.Typography, { variant: "body2", fontWeight: 500 }, safeHref(c.url) ? /* @__PURE__ */ import_react15.default.createElement("a", { href: safeHref(c.url), target: "_blank", rel: "noopener noreferrer" }, c.filename) : c.filename), c.source && /* @__PURE__ */ import_react15.default.createElement(
        import_material14.Chip,
        {
          size: "small",
          label: c.source === "web" ? "Web" : "Knowledge base",
          variant: "outlined",
          color: c.source === "web" ? "secondary" : "default"
        }
      ), /* @__PURE__ */ import_react15.default.createElement(import_material14.Chip, { size: "small", label: c.score.toFixed(3), color: "primary", variant: "outlined" })), /* @__PURE__ */ import_react15.default.createElement(
        import_material14.Typography,
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
function formatUsd(n) {
  return `$${n.toFixed(4)}`;
}
var import_react16, import_material15, Stat, UsagePanel;
var init_UsagePanel = __esm({
  "src/components/UsagePanel.tsx"() {
    "use strict";
    import_react16 = __toESM(require("react"));
    import_material15 = require("@mui/material");
    Stat = ({ label, value }) => /* @__PURE__ */ import_react16.default.createElement(import_material15.Box, { sx: { display: "flex", justifyContent: "space-between", py: 0.25 } }, /* @__PURE__ */ import_react16.default.createElement(import_material15.Typography, { variant: "body2", color: "text.secondary" }, label), /* @__PURE__ */ import_react16.default.createElement(import_material15.Typography, { variant: "body2", fontWeight: 500 }, value));
    UsagePanel = ({
      lastTurnUsage,
      totalTokens,
      keySpend
    }) => {
      const budgetPct = keySpend?.max_budget && keySpend.max_budget > 0 ? Math.min(100, keySpend.spend / keySpend.max_budget * 100) : null;
      return /* @__PURE__ */ import_react16.default.createElement(import_material15.Box, { sx: { p: 1.5 } }, /* @__PURE__ */ import_react16.default.createElement(import_material15.Typography, { variant: "overline", color: "text.secondary" }, "Usage"), !lastTurnUsage && !keySpend ? /* @__PURE__ */ import_react16.default.createElement(import_material15.Typography, { variant: "body2", color: "text.secondary", sx: { mt: 0.5 } }, "Send a message to see token and budget usage.") : /* @__PURE__ */ import_react16.default.createElement(import_material15.Box, { sx: { mt: 0.5 } }, lastTurnUsage && /* @__PURE__ */ import_react16.default.createElement(import_react16.default.Fragment, null, /* @__PURE__ */ import_react16.default.createElement(Stat, { label: "This turn", value: `${lastTurnUsage.total_tokens.toLocaleString()} tokens` }), /* @__PURE__ */ import_react16.default.createElement(Stat, { label: "Prompt / completion", value: `${lastTurnUsage.prompt_tokens.toLocaleString()} / ${lastTurnUsage.completion_tokens.toLocaleString()}` }), /* @__PURE__ */ import_react16.default.createElement(Stat, { label: "Session total", value: `${totalTokens.toLocaleString()} tokens` })), keySpend && /* @__PURE__ */ import_react16.default.createElement(import_react16.default.Fragment, null, /* @__PURE__ */ import_react16.default.createElement(import_material15.Divider, { sx: { my: 1 } }), /* @__PURE__ */ import_react16.default.createElement(Stat, { label: "Spent", value: formatUsd(keySpend.spend) }), keySpend.max_budget != null && /* @__PURE__ */ import_react16.default.createElement(import_react16.default.Fragment, null, /* @__PURE__ */ import_react16.default.createElement(Stat, { label: "Budget", value: `${formatUsd(keySpend.spend)} / ${formatUsd(keySpend.max_budget)}` }), /* @__PURE__ */ import_react16.default.createElement(
        import_material15.LinearProgress,
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
  return thread.messages.some((m) => m.content.toLowerCase().includes(q));
}
function sortThreads(threads) {
  return [...threads].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}
var import_react17, import_material16, import_Add, import_Delete2, import_Settings, import_ExpandMore, import_Chat, import_Send, import_Stop, import_Search, import_MoreVert, import_PushPin, import_PushPinOutlined, import_FileDownload, import_FileUpload, import_ChevronLeft, import_ChevronRight, import_Link2, import_Close, import_core_plugin_api7, SIDEBAR_WIDTH, SIDEBAR_RAIL_WIDTH, RIGHT_RAIL_WIDTH, CHAT_MAX_WIDTH, URL_TOKEN_RE, URL_PREVIEW_DEBOUNCE_MS, REASONING_EFFORT_OPTIONS, ChatPage;
var init_ChatPage = __esm({
  "src/components/ChatPage.tsx"() {
    "use strict";
    import_react17 = __toESM(require("react"));
    import_material16 = require("@mui/material");
    import_Add = __toESM(require("@mui/icons-material/Add"));
    import_Delete2 = __toESM(require("@mui/icons-material/Delete"));
    import_Settings = __toESM(require("@mui/icons-material/Settings"));
    import_ExpandMore = __toESM(require("@mui/icons-material/ExpandMore"));
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
    import_core_plugin_api7 = require("@backstage/core-plugin-api");
    init_api();
    init_useChat();
    init_theme();
    init_ModelPicker();
    init_CompareModelPicker();
    init_VectorStorePicker();
    init_PersonaPicker();
    init_PersonaHomepage();
    init_KeyPicker();
    init_OptionPicker();
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
    REASONING_EFFORT_OPTIONS = [
      { id: "low", label: "Low" },
      { id: "medium", label: "Medium" },
      { id: "high", label: "High" }
    ];
    ChatPage = () => {
      const chatApi = (0, import_core_plugin_api7.useApi)(liteLlmChatApiRef);
      const identityApi = (0, import_core_plugin_api7.useApi)(import_core_plugin_api7.identityApiRef);
      const [userId, setUserId] = (0, import_react17.useState)("default");
      const [config, setConfig] = (0, import_react17.useState)({
        defaultModel: null,
        defaultVectorStoreIds: null,
        maxRequestBudget: null,
        persistence: { enabled: false, ttlDays: 30 }
      });
      const [model, setModel] = (0, import_react17.useState)("");
      const [compareMode, setCompareModeUi] = (0, import_react17.useState)(false);
      const [compareModelsSel, setCompareModelsSel] = (0, import_react17.useState)([]);
      const [vectorStoreIds, setVectorStoreIds] = (0, import_react17.useState)([]);
      const [webSearch, setWebSearch] = (0, import_react17.useState)(false);
      const [personaId, setPersonaId] = (0, import_react17.useState)("");
      const [customSystemPrompt, setCustomSystemPrompt] = (0, import_react17.useState)("");
      const [toneId, setToneId] = (0, import_react17.useState)("");
      const [focusId, setFocusId] = (0, import_react17.useState)("");
      const [verbosityId, setVerbosityId] = (0, import_react17.useState)("");
      const [reasoningEffort, setReasoningEffort] = (0, import_react17.useState)("");
      const [keyVal, setKeyVal] = (0, import_react17.useState)({
        alias: "",
        token: ""
      });
      const [showSettings, setShowSettings] = (0, import_react17.useState)(true);
      const [input, setInput] = (0, import_react17.useState)("");
      const [configError, setConfigError] = (0, import_react17.useState)(null);
      const [personas, setPersonas] = (0, import_react17.useState)([]);
      const [personasLoading, setPersonasLoading] = (0, import_react17.useState)(true);
      const [personasError, setPersonasError] = (0, import_react17.useState)(null);
      const [searchQuery, setSearchQuery] = (0, import_react17.useState)("");
      const [sidebarCollapsed, setSidebarCollapsed] = (0, import_react17.useState)(false);
      const [rightPanelCollapsed, setRightPanelCollapsed] = (0, import_react17.useState)(false);
      const [threadMenuAnchor, setThreadMenuAnchor] = (0, import_react17.useState)(null);
      const [threadMenuTarget, setThreadMenuTarget] = (0, import_react17.useState)(null);
      const [importError, setImportError] = (0, import_react17.useState)(null);
      const [urlPreview, setUrlPreview] = (0, import_react17.useState)(null);
      const [urlPreviewLoading, setUrlPreviewLoading] = (0, import_react17.useState)(false);
      const [urlPreviewError, setUrlPreviewError] = (0, import_react17.useState)(null);
      const [dismissedUrl, setDismissedUrl] = (0, import_react17.useState)(null);
      const [traits, setTraits] = (0, import_react17.useState)({ tones: [], focuses: [], verbosities: [] });
      const [traitsLoading, setTraitsLoading] = (0, import_react17.useState)(true);
      const messagesEndRef = (0, import_react17.useRef)(null);
      const messagesContainerRef = (0, import_react17.useRef)(null);
      const importInputRef = (0, import_react17.useRef)(null);
      (0, import_react17.useEffect)(() => {
        injectDesignSystemAssets();
        chatApi.getChatConfig().then(setConfig).catch((err) => setConfigError(err.message ?? "Failed to reach the chat backend"));
        chatApi.listPersonas().then(setPersonas).catch((err) => setPersonasError(err.message ?? "Failed to load personas")).finally(() => setPersonasLoading(false));
        chatApi.getChatTraits().then(setTraits).catch(() => {
        }).finally(() => setTraitsLoading(false));
        identityApi.getCredentials().then((c) => setUserId(c.token ? "oidc" : "default")).catch(() => {
        });
      }, [chatApi, identityApi]);
      const chat = useChat({
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
      (0, import_react17.useEffect)(() => {
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
      const messages = (0, import_react17.useMemo)(() => chat.activeThread?.messages ?? [], [
        chat.activeThread
      ]);
      const isStreaming = chat.isStreaming;
      (0, import_react17.useEffect)(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [messages, isStreaming]);
      (0, import_react17.useEffect)(() => {
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
      const visibleThreads = (0, import_react17.useMemo)(
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
        urlPreviewChip = /* @__PURE__ */ import_react17.default.createElement(import_material16.Chip, { size: "small", icon: /* @__PURE__ */ import_react17.default.createElement(import_Link2.default, { fontSize: "small" }), label: "Fetching page\u2026", variant: "outlined" });
      } else if (urlPreviewError) {
        urlPreviewChip = /* @__PURE__ */ import_react17.default.createElement(
          import_material16.Chip,
          {
            size: "small",
            color: "error",
            icon: /* @__PURE__ */ import_react17.default.createElement(import_Link2.default, { fontSize: "small" }),
            label: urlPreviewError,
            variant: "outlined",
            onDelete: dismissUrlPreview,
            deleteIcon: /* @__PURE__ */ import_react17.default.createElement(import_Close.default, { fontSize: "small" })
          }
        );
      } else if (urlPreview) {
        urlPreviewChip = /* @__PURE__ */ import_react17.default.createElement(import_material16.Tooltip, { title: urlPreview.url }, /* @__PURE__ */ import_react17.default.createElement(
          import_material16.Chip,
          {
            size: "small",
            icon: /* @__PURE__ */ import_react17.default.createElement(import_Link2.default, { fontSize: "small" }),
            label: `Page attached: ${urlPreview.title}`,
            variant: "outlined",
            onDelete: dismissUrlPreview,
            deleteIcon: /* @__PURE__ */ import_react17.default.createElement(import_Close.default, { fontSize: "small" })
          }
        ));
      }
      return /* @__PURE__ */ import_react17.default.createElement(import_material16.Box, { sx: { display: "flex", height: "100dvh", overflow: "hidden" } }, /* @__PURE__ */ import_react17.default.createElement(
        import_material16.Box,
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
        /* @__PURE__ */ import_react17.default.createElement(import_material16.Box, { sx: { display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "flex-end", px: 0.5, py: 0.5 } }, /* @__PURE__ */ import_react17.default.createElement(import_material16.Tooltip, { title: sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar" }, /* @__PURE__ */ import_react17.default.createElement(import_material16.IconButton, { size: "small", onClick: () => setSidebarCollapsed((v) => !v) }, sidebarCollapsed ? /* @__PURE__ */ import_react17.default.createElement(import_ChevronRight.default, { fontSize: "small" }) : /* @__PURE__ */ import_react17.default.createElement(import_ChevronLeft.default, { fontSize: "small" })))),
        sidebarCollapsed ? /* @__PURE__ */ import_react17.default.createElement(import_material16.Box, { sx: { display: "flex", flexDirection: "column", alignItems: "center", gap: 1, pt: 1 } }, /* @__PURE__ */ import_react17.default.createElement(import_material16.Tooltip, { title: "New chat", placement: "right" }, /* @__PURE__ */ import_react17.default.createElement(import_material16.IconButton, { onClick: chat.newThread }, /* @__PURE__ */ import_react17.default.createElement(import_Add.default, null))), /* @__PURE__ */ import_react17.default.createElement(import_material16.Tooltip, { title: "Settings", placement: "right" }, /* @__PURE__ */ import_react17.default.createElement(import_material16.IconButton, { onClick: () => setSidebarCollapsed(false) }, /* @__PURE__ */ import_react17.default.createElement(import_Settings.default, null)))) : /* @__PURE__ */ import_react17.default.createElement(import_react17.default.Fragment, null, /* @__PURE__ */ import_react17.default.createElement(import_material16.Box, { sx: { flexShrink: 0 } }, /* @__PURE__ */ import_react17.default.createElement(
          import_material16.Box,
          {
            sx: {
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              px: 1.5,
              py: 1,
              bgcolor: "action.hover"
            },
            onClick: () => setShowSettings((v) => !v)
          },
          /* @__PURE__ */ import_react17.default.createElement(import_Settings.default, { fontSize: "small", sx: { mr: 1 } }),
          /* @__PURE__ */ import_react17.default.createElement(import_material16.Typography, { variant: "overline", sx: { flex: 1 } }, "Settings"),
          /* @__PURE__ */ import_react17.default.createElement(
            import_ExpandMore.default,
            {
              fontSize: "small",
              sx: {
                transform: showSettings ? "rotate(180deg)" : "none",
                transition: "transform 0.2s"
              }
            }
          )
        ), /* @__PURE__ */ import_react17.default.createElement(import_material16.Collapse, { in: showSettings }, /* @__PURE__ */ import_react17.default.createElement(import_material16.Box, { sx: { p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 } }, configError && /* @__PURE__ */ import_react17.default.createElement(import_material16.Typography, { variant: "caption", color: "error" }, "Couldn't load chat defaults: ", configError), /* @__PURE__ */ import_react17.default.createElement(
          PersonaPicker,
          {
            value: personaId,
            personas,
            loading: personasLoading,
            error: personasError,
            onChange: handlePersonaChange
          }
        ), /* @__PURE__ */ import_react17.default.createElement(import_material16.Box, { sx: { display: "flex", gap: 1.5, flexWrap: "wrap" } }, /* @__PURE__ */ import_react17.default.createElement(
          OptionPicker,
          {
            label: "Tone",
            value: toneId,
            options: traits.tones,
            onChange: setToneId,
            loading: traitsLoading
          }
        ), /* @__PURE__ */ import_react17.default.createElement(
          OptionPicker,
          {
            label: "Focus",
            value: focusId,
            options: traits.focuses,
            onChange: setFocusId,
            loading: traitsLoading
          }
        )), /* @__PURE__ */ import_react17.default.createElement(
          import_material16.TextField,
          {
            label: "Custom system prompt",
            placeholder: personaId ? "Appended after the persona system prompt\u2026" : "Used as the system prompt (no persona selected)\u2026",
            value: customSystemPrompt,
            onChange: (e) => setCustomSystemPrompt(e.target.value),
            multiline: true,
            minRows: 2,
            maxRows: 6,
            size: "small",
            fullWidth: true
          }
        ), /* @__PURE__ */ import_react17.default.createElement(
          import_material16.FormControlLabel,
          {
            control: /* @__PURE__ */ import_react17.default.createElement(
              import_material16.Switch,
              {
                size: "small",
                checked: compareMode,
                onChange: (e) => setCompareModeUi(e.target.checked)
              }
            ),
            label: /* @__PURE__ */ import_react17.default.createElement(import_material16.Typography, { variant: "body2" }, "Compare models side-by-side")
          }
        ), compareMode ? /* @__PURE__ */ import_react17.default.createElement(CompareModelPicker, { value: compareModelsSel, onChange: setCompareModelsSel }) : /* @__PURE__ */ import_react17.default.createElement(ModelPicker, { value: model, onChange: setModel, defaultModel: config.defaultModel }), /* @__PURE__ */ import_react17.default.createElement(
          import_material16.Accordion,
          {
            disableGutters: true,
            variant: "outlined",
            sx: { "&:before": { display: "none" } }
          },
          /* @__PURE__ */ import_react17.default.createElement(import_material16.AccordionSummary, { expandIcon: /* @__PURE__ */ import_react17.default.createElement(import_ExpandMore.default, { fontSize: "small" }) }, /* @__PURE__ */ import_react17.default.createElement(import_material16.Typography, { variant: "body2", sx: { fontWeight: 500 } }, "Advanced")),
          /* @__PURE__ */ import_react17.default.createElement(import_material16.AccordionDetails, { sx: { display: "flex", flexDirection: "column", gap: 1.5 } }, /* @__PURE__ */ import_react17.default.createElement(
            VectorStorePicker,
            {
              value: vectorStoreIds,
              onChange: setVectorStoreIds,
              defaultVectorStoreIds: config.defaultVectorStoreIds
            }
          ), /* @__PURE__ */ import_react17.default.createElement(
            import_material16.FormControlLabel,
            {
              control: /* @__PURE__ */ import_react17.default.createElement(
                import_material16.Switch,
                {
                  size: "small",
                  checked: webSearch,
                  onChange: (e) => setWebSearch(e.target.checked)
                }
              ),
              label: /* @__PURE__ */ import_react17.default.createElement(import_material16.Typography, { variant: "body2" }, "Include web search")
            }
          ), /* @__PURE__ */ import_react17.default.createElement(import_material16.Box, { sx: { display: "flex", gap: 1.5, flexWrap: "wrap" } }, /* @__PURE__ */ import_react17.default.createElement(
            OptionPicker,
            {
              label: "Verbosity",
              value: verbosityId,
              options: traits.verbosities,
              onChange: setVerbosityId,
              loading: traitsLoading
            }
          ), /* @__PURE__ */ import_react17.default.createElement(
            OptionPicker,
            {
              label: "Reasoning effort",
              value: reasoningEffort,
              options: REASONING_EFFORT_OPTIONS,
              onChange: (id) => setReasoningEffort(id),
              noneLabel: "Model default"
            }
          )), /* @__PURE__ */ import_react17.default.createElement(
            KeyPicker,
            {
              value: keyVal,
              onChange: setKeyVal,
              onDelete: () => {
                if (chat.activeThread?.keyToken) {
                  chatApi.deleteChatKey(chat.activeThread.keyToken).catch(() => {
                  });
                }
              }
            }
          ))
        )))), /* @__PURE__ */ import_react17.default.createElement(import_material16.Divider, null), /* @__PURE__ */ import_react17.default.createElement(import_material16.Box, { sx: { p: 1.5, display: "flex", gap: 1 } }, /* @__PURE__ */ import_react17.default.createElement(
          import_material16.Button,
          {
            fullWidth: true,
            variant: "outlined",
            startIcon: /* @__PURE__ */ import_react17.default.createElement(import_Add.default, null),
            onClick: chat.newThread,
            size: "small"
          },
          "New chat"
        ), /* @__PURE__ */ import_react17.default.createElement(import_material16.Tooltip, { title: "Import thread" }, /* @__PURE__ */ import_react17.default.createElement(import_material16.IconButton, { size: "small", onClick: () => importInputRef.current?.click() }, /* @__PURE__ */ import_react17.default.createElement(import_FileUpload.default, { fontSize: "small" }))), /* @__PURE__ */ import_react17.default.createElement(
          "input",
          {
            ref: importInputRef,
            type: "file",
            accept: "application/json",
            hidden: true,
            onChange: handleImportFile
          }
        )), importError && /* @__PURE__ */ import_react17.default.createElement(import_material16.Box, { sx: { px: 1.5, pb: 1 } }, /* @__PURE__ */ import_react17.default.createElement(import_material16.Typography, { variant: "caption", color: "error" }, importError)), /* @__PURE__ */ import_react17.default.createElement(import_material16.Box, { sx: { px: 1.5, pb: 1 } }, /* @__PURE__ */ import_react17.default.createElement(import_material16.Tooltip, { title: persistenceTooltip }, /* @__PURE__ */ import_react17.default.createElement(import_material16.Typography, { variant: "caption", color: "text.secondary" }, config.persistence.enabled ? `History saved to your account${config.persistence.ttlDays > 0 ? ` \xB7 ${config.persistence.ttlDays}d retention` : ""}` : "History stored only in this browser"))), /* @__PURE__ */ import_react17.default.createElement(import_material16.Box, { sx: { px: 1.5, pb: 1 } }, /* @__PURE__ */ import_react17.default.createElement(
          import_material16.InputBase,
          {
            fullWidth: true,
            placeholder: "Search threads\u2026",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            startAdornment: /* @__PURE__ */ import_react17.default.createElement(import_Search.default, { fontSize: "small", sx: { mr: 0.75, color: "text.secondary" } }),
            sx: {
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              px: 1,
              py: 0.5,
              fontSize: "0.85rem"
            }
          }
        )), /* @__PURE__ */ import_react17.default.createElement(import_material16.Box, { sx: { flex: 1, overflowY: "auto", minHeight: 0 } }, /* @__PURE__ */ import_react17.default.createElement(import_material16.List, { dense: true }, visibleThreads.map((t) => /* @__PURE__ */ import_react17.default.createElement(
          import_material16.ListItem,
          {
            key: t.id,
            disablePadding: true,
            secondaryAction: /* @__PURE__ */ import_react17.default.createElement(import_material16.IconButton, { edge: "end", size: "small", onClick: (e) => openThreadMenu(e, t.id) }, /* @__PURE__ */ import_react17.default.createElement(import_MoreVert.default, { fontSize: "small" }))
          },
          /* @__PURE__ */ import_react17.default.createElement(
            import_material16.ListItemButton,
            {
              selected: chat.activeThread?.id === t.id,
              onClick: () => chat.selectThread(t.id),
              sx: { pr: 6 }
            },
            t.pinned && /* @__PURE__ */ import_react17.default.createElement(import_PushPin.default, { fontSize: "small", sx: { mr: 0.75, color: "text.secondary" } }),
            /* @__PURE__ */ import_react17.default.createElement(
              import_material16.ListItemText,
              {
                primary: t.title,
                primaryTypographyProps: { noWrap: true, variant: "body2" },
                secondaryTypographyProps: { noWrap: true, variant: "caption" }
              }
            )
          )
        )), visibleThreads.length === 0 && /* @__PURE__ */ import_react17.default.createElement(import_material16.Typography, { variant: "caption", color: "text.secondary", sx: { px: 2, py: 1, display: "block" } }, searchQuery ? "No threads match your search." : "No threads yet."))), /* @__PURE__ */ import_react17.default.createElement(import_material16.Menu, { anchorEl: threadMenuAnchor, open: !!threadMenuAnchor, onClose: closeThreadMenu }, /* @__PURE__ */ import_react17.default.createElement(
          import_material16.MenuItem,
          {
            onClick: () => {
              if (threadMenuTarget) chat.togglePin(threadMenuTarget);
              closeThreadMenu();
            }
          },
          /* @__PURE__ */ import_react17.default.createElement(import_material16.ListItemIcon, null, menuTargetThread?.pinned ? /* @__PURE__ */ import_react17.default.createElement(import_PushPin.default, { fontSize: "small" }) : /* @__PURE__ */ import_react17.default.createElement(import_PushPinOutlined.default, { fontSize: "small" })),
          menuTargetThread?.pinned ? "Unpin" : "Pin"
        ), /* @__PURE__ */ import_react17.default.createElement(
          import_material16.MenuItem,
          {
            onClick: () => {
              if (threadMenuTarget) chat.exportThread(threadMenuTarget);
              closeThreadMenu();
            }
          },
          /* @__PURE__ */ import_react17.default.createElement(import_material16.ListItemIcon, null, /* @__PURE__ */ import_react17.default.createElement(import_FileDownload.default, { fontSize: "small" })),
          "Export"
        ), /* @__PURE__ */ import_react17.default.createElement(
          import_material16.MenuItem,
          {
            onClick: () => {
              if (threadMenuTarget) chat.deleteThread(threadMenuTarget);
              closeThreadMenu();
            }
          },
          /* @__PURE__ */ import_react17.default.createElement(import_material16.ListItemIcon, null, /* @__PURE__ */ import_react17.default.createElement(import_Delete2.default, { fontSize: "small" })),
          "Delete"
        )))
      ), /* @__PURE__ */ import_react17.default.createElement(
        import_material16.Box,
        {
          sx: {
            flex: 3,
            display: "flex",
            justifyContent: "center",
            overflow: "hidden"
          }
        },
        /* @__PURE__ */ import_react17.default.createElement(
          import_material16.Box,
          {
            sx: {
              width: "100%",
              maxWidth: CHAT_MAX_WIDTH,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }
          },
          /* @__PURE__ */ import_react17.default.createElement(
            import_material16.Box,
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
            /* @__PURE__ */ import_react17.default.createElement(import_Chat.default, { fontSize: "small", color: "action" }),
            /* @__PURE__ */ import_react17.default.createElement(import_material16.Typography, { variant: "subtitle2", noWrap: true, sx: { flex: 1 } }, chat.activeThread?.title ?? "AI Chat"),
            /* @__PURE__ */ import_react17.default.createElement(import_material16.Tooltip, { title: rightPanelCollapsed ? "Show context panel" : "Hide context panel" }, /* @__PURE__ */ import_react17.default.createElement(import_material16.IconButton, { size: "small", onClick: () => setRightPanelCollapsed((v) => !v) }, rightPanelCollapsed ? /* @__PURE__ */ import_react17.default.createElement(import_ChevronLeft.default, { fontSize: "small" }) : /* @__PURE__ */ import_react17.default.createElement(import_ChevronRight.default, { fontSize: "small" })))
          ),
          chat.error && /* @__PURE__ */ import_react17.default.createElement(import_material16.Box, { sx: { px: 2, pt: 1 } }, /* @__PURE__ */ import_react17.default.createElement(ErrorBanner, { error: chat.error, onDismiss: chat.clearError })),
          /* @__PURE__ */ import_react17.default.createElement(
            import_material16.Box,
            {
              ref: messagesContainerRef,
              sx: {
                flex: 1,
                overflowY: "auto",
                minHeight: 0
              }
            },
            messages.length === 0 ? /* @__PURE__ */ import_react17.default.createElement(
              PersonaHomepage,
              {
                personas,
                loading: personasLoading,
                error: personasError,
                selectedId: personaId,
                onSelect: handlePersonaChange
              }
            ) : /* @__PURE__ */ import_react17.default.createElement(
              MessageList,
              {
                messages,
                streamingMessageIds: chat.streamingMessageIds,
                onFeedback: chat.submitFeedback,
                onRegenerate: chat.regenerateFrom,
                onEditAndResend: chat.editAndResend
              }
            ),
            /* @__PURE__ */ import_react17.default.createElement("div", { ref: messagesEndRef })
          ),
          (urlPreviewLoading || urlPreview || urlPreviewError) && /* @__PURE__ */ import_react17.default.createElement(import_material16.Box, { sx: { px: 2, pt: 1 } }, urlPreviewChip),
          /* @__PURE__ */ import_react17.default.createElement(
            import_material16.Box,
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
            /* @__PURE__ */ import_react17.default.createElement(
              import_material16.InputBase,
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
            isStreaming ? /* @__PURE__ */ import_react17.default.createElement(import_material16.Tooltip, { title: "Stop" }, /* @__PURE__ */ import_react17.default.createElement(import_material16.IconButton, { color: "error", onClick: chat.stopGeneration }, /* @__PURE__ */ import_react17.default.createElement(import_Stop.default, null))) : /* @__PURE__ */ import_react17.default.createElement(import_material16.Tooltip, { title: "Send" }, /* @__PURE__ */ import_react17.default.createElement(
              import_material16.IconButton,
              {
                color: "primary",
                onClick: handleSend,
                disabled: !input.trim() || !keyVal.token || compareMode && compareModelsSel.length === 0
              },
              /* @__PURE__ */ import_react17.default.createElement(import_Send.default, null)
            ))
          ),
          statusParts.length > 0 && /* @__PURE__ */ import_react17.default.createElement(import_material16.Box, { sx: { px: 2, pb: 1 } }, /* @__PURE__ */ import_react17.default.createElement(import_material16.Typography, { variant: "caption", color: "text.secondary" }, statusParts.join(" \xB7 ")))
        )
      ), !rightPanelCollapsed && /* @__PURE__ */ import_react17.default.createElement(
        import_material16.Box,
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
        /* @__PURE__ */ import_react17.default.createElement(SourcesPanel, { citations: chat.citations }),
        /* @__PURE__ */ import_react17.default.createElement(import_material16.Divider, null),
        /* @__PURE__ */ import_react17.default.createElement(
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
var import_react18, import_material17, BarList;
var init_BarList = __esm({
  "src/components/BarList.tsx"() {
    "use strict";
    import_react18 = __toESM(require("react"));
    import_material17 = require("@mui/material");
    BarList = ({ rows, emptyLabel = "No data yet." }) => {
      if (rows.length === 0) {
        return /* @__PURE__ */ import_react18.default.createElement(import_material17.Typography, { variant: "body2", color: "text.secondary" }, emptyLabel);
      }
      const max = Math.max(...rows.map((r) => r.count), 1);
      return /* @__PURE__ */ import_react18.default.createElement(import_material17.Box, { sx: { display: "flex", flexDirection: "column", gap: 1 } }, rows.map((row) => /* @__PURE__ */ import_react18.default.createElement(import_material17.Box, { key: row.key, sx: { display: "flex", alignItems: "center", gap: 1 } }, /* @__PURE__ */ import_react18.default.createElement(import_material17.Typography, { variant: "body2", sx: { width: 180, flexShrink: 0 }, noWrap: true, title: row.key }, row.key), /* @__PURE__ */ import_react18.default.createElement(import_material17.Box, { sx: { flex: 1, bgcolor: "action.hover", borderRadius: 1, overflow: "hidden", height: 18 } }, /* @__PURE__ */ import_react18.default.createElement(
        import_material17.Box,
        {
          sx: {
            width: `${row.count / max * 100}%`,
            height: "100%",
            bgcolor: "primary.main",
            borderRadius: 1
          }
        }
      )), /* @__PURE__ */ import_react18.default.createElement(import_material17.Typography, { variant: "body2", sx: { width: 40, textAlign: "right", flexShrink: 0 } }, row.count))));
    };
  }
});

// src/components/AnalyticsPage.tsx
var AnalyticsPage_exports = {};
__export(AnalyticsPage_exports, {
  AnalyticsPage: () => AnalyticsPage
});
var import_react19, import_material18, import_core_plugin_api8, RANGES, AnalyticsPage;
var init_AnalyticsPage = __esm({
  "src/components/AnalyticsPage.tsx"() {
    "use strict";
    import_react19 = __toESM(require("react"));
    import_material18 = require("@mui/material");
    import_core_plugin_api8 = require("@backstage/core-plugin-api");
    init_api();
    init_BarList();
    RANGES = [
      { value: "24h", label: "Last 24 hours" },
      { value: "7d", label: "Last 7 days" },
      { value: "30d", label: "Last 30 days" },
      { value: "all", label: "All time" }
    ];
    AnalyticsPage = () => {
      const chatApi = (0, import_core_plugin_api8.useApi)(liteLlmChatApiRef);
      const [range, setRange] = (0, import_react19.useState)("30d");
      const [byPersona, setByPersona] = (0, import_react19.useState)([]);
      const [byModel, setByModel] = (0, import_react19.useState)([]);
      const [feedback, setFeedback] = (0, import_react19.useState)(null);
      const [error, setError] = (0, import_react19.useState)(null);
      const [loading, setLoading] = (0, import_react19.useState)(true);
      (0, import_react19.useEffect)(() => {
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
      return /* @__PURE__ */ import_react19.default.createElement(import_material18.Box, { sx: { p: 3, maxWidth: 900, mx: "auto" } }, /* @__PURE__ */ import_react19.default.createElement(import_material18.Box, { sx: { display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 } }, /* @__PURE__ */ import_react19.default.createElement(import_material18.Typography, { variant: "h5" }, "AI Chat analytics"), /* @__PURE__ */ import_react19.default.createElement(import_material18.Select, { size: "small", value: range, onChange: (e) => setRange(e.target.value) }, RANGES.map((r) => /* @__PURE__ */ import_react19.default.createElement(import_material18.MenuItem, { key: r.value, value: r.value }, r.label)))), error && /* @__PURE__ */ import_react19.default.createElement(import_material18.Alert, { severity: "error", sx: { mb: 2 } }, error), /* @__PURE__ */ import_react19.default.createElement(import_material18.Box, { sx: { display: "flex", flexDirection: "column", gap: 2 } }, /* @__PURE__ */ import_react19.default.createElement(import_material18.Paper, { variant: "outlined", sx: { p: 2 } }, /* @__PURE__ */ import_react19.default.createElement(import_material18.Typography, { variant: "subtitle1", sx: { mb: 1.5 } }, "Turns by persona"), /* @__PURE__ */ import_react19.default.createElement(BarList, { rows: byPersona, emptyLabel: loading ? "Loading\u2026" : "No chat turns in this range." })), /* @__PURE__ */ import_react19.default.createElement(import_material18.Paper, { variant: "outlined", sx: { p: 2 } }, /* @__PURE__ */ import_react19.default.createElement(import_material18.Typography, { variant: "subtitle1", sx: { mb: 1.5 } }, "Turns by model"), /* @__PURE__ */ import_react19.default.createElement(BarList, { rows: byModel, emptyLabel: loading ? "Loading\u2026" : "No chat turns in this range." })), /* @__PURE__ */ import_react19.default.createElement(import_material18.Paper, { variant: "outlined", sx: { p: 2 } }, /* @__PURE__ */ import_react19.default.createElement(import_material18.Typography, { variant: "subtitle1", sx: { mb: 1.5 } }, "Feedback (all time)"), /* @__PURE__ */ import_react19.default.createElement(BarList, { rows: feedbackRows, emptyLabel: loading ? "Loading\u2026" : "No feedback recorded yet." }))));
    };
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AnalyticsPage: () => AnalyticsPage,
  ChatPage: () => ChatPage,
  LiteLlmChatApi: () => LiteLlmChatApi,
  liteLlmChatApiRef: () => liteLlmChatApiRef,
  litellmChatPlugin: () => litellmChatPlugin
});
module.exports = __toCommonJS(index_exports);

// src/plugin.tsx
var import_react20 = __toESM(require("react"));
var import_icons_material = require("@mui/icons-material");
var import_frontend_plugin_api = require("@backstage/frontend-plugin-api");
init_api();
var liteLlmChatApi = import_frontend_plugin_api.ApiBlueprint.make({
  params: (defineParams) => defineParams({
    api: liteLlmChatApiRef,
    deps: { fetchApi: import_frontend_plugin_api.fetchApiRef },
    factory: ({ fetchApi }) => new LiteLlmChatApi(fetchApi)
  })
});
var chatPage = import_frontend_plugin_api.PageBlueprint.make({
  params: {
    path: "/ai-chat",
    title: "AI Chat",
    icon: /* @__PURE__ */ import_react20.default.createElement(import_icons_material.Chat, null),
    loader: async () => {
      const { ChatPage: ChatPage2 } = await Promise.resolve().then(() => (init_ChatPage(), ChatPage_exports));
      return /* @__PURE__ */ import_react20.default.createElement(ChatPage2, null);
    }
  }
});
var analyticsPage = import_frontend_plugin_api.PageBlueprint.make({
  name: "analytics",
  params: {
    path: "/ai-chat/analytics",
    title: "AI Chat Analytics",
    icon: /* @__PURE__ */ import_react20.default.createElement(import_icons_material.BarChart, null),
    loader: async () => {
      const { AnalyticsPage: AnalyticsPage2 } = await Promise.resolve().then(() => (init_AnalyticsPage(), AnalyticsPage_exports));
      return /* @__PURE__ */ import_react20.default.createElement(AnalyticsPage2, null);
    }
  }
});
var litellmChatPlugin = (0, import_frontend_plugin_api.createFrontendPlugin)({
  pluginId: "litellm-chat",
  extensions: [liteLlmChatApi, chatPage, analyticsPage]
});

// src/index.ts
init_ChatPage();
init_AnalyticsPage();
init_api();
//# sourceMappingURL=index.cjs.js.map
