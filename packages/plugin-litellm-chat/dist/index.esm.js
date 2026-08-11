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

// src/api.ts
import { createApiRef } from "@backstage/core-plugin-api";
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
var liteLlmChatApiRef, BASE_PATH, LiteLlmChatApi;
var init_api = __esm({
  "src/api.ts"() {
    "use strict";
    liteLlmChatApiRef = createApiRef({
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
          return { defaultModel: null, defaultVectorStoreIds: null, maxRequestBudget: null };
        }
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
    };
  }
});

// src/hooks/useChat.ts
import { useState, useCallback, useRef, useEffect } from "react";
import { useApi } from "@backstage/core-plugin-api";
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
  const { userId, model, vectorStoreIds, personaId, customSystemPrompt, keyAlias, keyToken, topK, webSearch } = opts;
  const api = useApi(liteLlmChatApiRef);
  const [threads, setThreads] = useState(() => loadThreads(userId));
  const [activeId, setActiveId] = useState(
    () => threads[0]?.id ?? null
  );
  const [streamingIds, setStreamingIds] = useState(/* @__PURE__ */ new Set());
  const [error, setError] = useState(null);
  const [citations, setCitations] = useState([]);
  const [keySpend, setKeySpend] = useState(null);
  const isStreaming = streamingIds.size > 0;
  const abortMapRef = useRef(/* @__PURE__ */ new Map());
  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const saveTimeoutRef = useRef(null);
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveThreads(userId, threadsRef.current);
    }, SAVE_DEBOUNCE_MS);
  }, [userId, threads]);
  useEffect(() => {
    const flush = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      saveThreads(userId, threadsRef.current);
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [userId]);
  const activeThread = threads.find((t) => t.id === activeId) ?? null;
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
  }, [keyToken, activeId]);
  const newThread = useCallback(() => {
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
  }, [model, vectorStoreIds, personaId, customSystemPrompt, keyAlias, keyToken]);
  const selectThread = useCallback((id) => {
    setActiveId(id);
    setError(null);
    setCitations([]);
    setKeySpend(null);
  }, []);
  const deleteThread = useCallback(
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
    },
    [activeId, threads, api]
  );
  const stopGeneration = useCallback(() => {
    abortMapRef.current.forEach((controller) => controller.abort());
    abortMapRef.current.clear();
    setStreamingIds(/* @__PURE__ */ new Set());
  }, []);
  const startStream = useCallback(
    (threadId, assistantMsgId, reqMessages, reqModel, attachedUrl, onSettled) => {
      setStreamingIds((prev) => new Set(prev).add(assistantMsgId));
      const controller = api.chatStream(
        {
          model: reqModel,
          messages: reqMessages,
          vector_store_ids: vectorStoreIds.length ? vectorStoreIds : void 0,
          persona_id: personaId || void 0,
          custom_system_prompt: customSystemPrompt || void 0,
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
    [api, vectorStoreIds, personaId, customSystemPrompt, topK, keyToken, webSearch]
  );
  const runSend = useCallback(
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
    [activeThread, api, keyToken, model, vectorStoreIds, personaId, customSystemPrompt, keyAlias, webSearch, startStream, stopGeneration]
  );
  const runCompareSend = useCallback(
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
    [activeThread, api, keyToken, vectorStoreIds, personaId, customSystemPrompt, keyAlias, webSearch, startStream, stopGeneration]
  );
  const sendMessage = useCallback(
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
  const regenerateFrom = useCallback(
    (messageId) => {
      if (!activeThread) return;
      const messages = activeThread.messages;
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;
      const target = messages[idx];
      const compareModels = activeThread.compareModels;
      const isCompare = activeThread.mode === "compare" && !!compareModels?.length;
      if (target.role === "user") {
        if (isCompare) runCompareSend(target.content, messages.slice(0, idx), compareModels);
        else runSend(target.content, messages.slice(0, idx));
        return;
      }
      const turnId = target.turnId;
      let userIdx = idx - 1;
      while (userIdx >= 0 && !(messages[userIdx].role === "user" && (!turnId || messages[userIdx].turnId === turnId))) {
        userIdx -= 1;
      }
      if (userIdx < 0) return;
      if (isCompare && target.compareModel) {
        runCompareSend(messages[userIdx].content, messages.slice(0, userIdx), compareModels);
      } else {
        runSend(messages[userIdx].content, messages.slice(0, userIdx));
      }
    },
    [activeThread, runSend, runCompareSend]
  );
  const editAndResend = useCallback(
    (messageId, newContent) => {
      if (!activeThread) return;
      const messages = activeThread.messages;
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1 || messages[idx].role !== "user") return;
      if (activeThread.mode === "compare" && activeThread.compareModels?.length) {
        runCompareSend(newContent, messages.slice(0, idx), activeThread.compareModels);
      } else {
        runSend(newContent, messages.slice(0, idx));
      }
    },
    [activeThread, runSend, runCompareSend]
  );
  const setCompareMode = useCallback(
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
  const togglePin = useCallback((id) => {
    setThreads(
      (prev) => prev.map((t) => t.id === id ? { ...t, pinned: !t.pinned } : t)
    );
  }, []);
  const exportThread = useCallback(
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
  const importThread = useCallback(async (file) => {
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
  const submitFeedback = useCallback(
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
        vectorStoreIds: activeThread.vectorStoreIds
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
    streamingMessageIds: streamingIds,
    error,
    citations,
    keySpend
  };
}
var THREAD_EXPORT_VERSION, STORAGE_PREFIX, SAVE_DEBOUNCE_MS;
var init_useChat = __esm({
  "src/hooks/useChat.ts"() {
    "use strict";
    init_api();
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
      const chatApi = useApi4(liteLlmChatApiRef);
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

// src/components/PersonaHomepage.tsx
import React5 from "react";
import { Box as Box3, Typography as Typography5, Chip as Chip3, CircularProgress } from "@mui/material";
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
        return /* @__PURE__ */ React5.createElement(Box3, { sx: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React5.createElement(CircularProgress, { size: 24 }));
      }
      if (error || personas.length === 0) {
        return /* @__PURE__ */ React5.createElement(Box3, { sx: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React5.createElement(Typography5, { color: "text.secondary" }, error ? `Couldn't load personas: ${error}` : "Start a conversation\u2026"));
      }
      return /* @__PURE__ */ React5.createElement(
        Box3,
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
        /* @__PURE__ */ React5.createElement(Typography5, { variant: "subtitle1", align: "center", color: "text.secondary" }, "Pick a persona to get started, or just start typing"),
        /* @__PURE__ */ React5.createElement(
          Box3,
          {
            sx: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 1.5
            }
          },
          personas.map((p) => {
            const selected = p.id === selectedId;
            return /* @__PURE__ */ React5.createElement(
              Box3,
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
              /* @__PURE__ */ React5.createElement(Box3, { sx: { display: "flex", alignItems: "center", gap: 0.75 } }, /* @__PURE__ */ React5.createElement(PersonIcon, { fontSize: "small", color: selected ? "primary" : "action" }), /* @__PURE__ */ React5.createElement(Typography5, { variant: "body2", sx: { fontWeight: 600 }, noWrap: true }, p.title)),
              p.description && /* @__PURE__ */ React5.createElement(
                Typography5,
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
              p.tags && p.tags.length > 0 && /* @__PURE__ */ React5.createElement(Box3, { sx: { display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 } }, p.tags.map((tag) => /* @__PURE__ */ React5.createElement(Chip3, { key: tag, label: tag, size: "small", variant: "outlined" })))
            );
          })
        )
      );
    };
  }
});

// src/components/KeyPicker.tsx
import React6, { useState as useState5 } from "react";
import { Button, Box as Box4, Typography as Typography6, CircularProgress as CircularProgress2, Tooltip, IconButton } from "@mui/material";
import KeyIcon from "@mui/icons-material/VpnKey";
import DeleteIcon from "@mui/icons-material/Delete";
import { useApi as useApi5 } from "@backstage/core-plugin-api";
var KeyPicker;
var init_KeyPicker = __esm({
  "src/components/KeyPicker.tsx"() {
    "use strict";
    init_api();
    KeyPicker = ({ value, onChange, onDelete }) => {
      const chatApi = useApi5(liteLlmChatApiRef);
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
        return /* @__PURE__ */ React6.createElement(Box4, { sx: { display: "flex", alignItems: "center", gap: 1, minWidth: 200 } }, /* @__PURE__ */ React6.createElement(KeyIcon, { fontSize: "small", color: "success" }), /* @__PURE__ */ React6.createElement(Typography6, { variant: "body2", sx: { flex: 1, overflow: "hidden", textOverflow: "ellipsis" } }, value.alias || "chat key"), /* @__PURE__ */ React6.createElement(Tooltip, { title: "Delete chat key" }, /* @__PURE__ */ React6.createElement(IconButton, { edge: "end", size: "small", onClick: handleDelete }, /* @__PURE__ */ React6.createElement(DeleteIcon, { fontSize: "small" }))));
      }
      return /* @__PURE__ */ React6.createElement(Box4, { sx: { minWidth: 200 } }, /* @__PURE__ */ React6.createElement(
        Button,
        {
          size: "small",
          variant: "outlined",
          startIcon: loading ? /* @__PURE__ */ React6.createElement(CircularProgress2, { size: 16 }) : /* @__PURE__ */ React6.createElement(KeyIcon, null),
          onClick: handleGenerate,
          disabled: loading
        },
        loading ? "Minting\u2026" : "Generate chat key"
      ), error && /* @__PURE__ */ React6.createElement(Typography6, { variant: "caption", color: "error", sx: { display: "block", mt: 0.5 } }, error));
    };
  }
});

// src/components/PersonaAvatar.tsx
import React7 from "react";
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
      return /* @__PURE__ */ React7.createElement(Box5, { sx: { position: "relative", width: ringSize, height: ringSize, flexShrink: 0 } }, /* @__PURE__ */ React7.createElement(
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
      ), /* @__PURE__ */ React7.createElement(
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
import React8, { useState as useState6 } from "react";
import { Box as Box6, IconButton as IconButton2, Tooltip as Tooltip2 } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
function extractText(node) {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React8.isValidElement(node)) {
    return extractText(node.props.children);
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
        return /* @__PURE__ */ React8.createElement("code", { className, style: { fontFamily: MONO_FONT_STACK }, ...props }, children);
      }
      const handleCopy = () => {
        const text = extractText(children).replace(/\n$/, "");
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      };
      return /* @__PURE__ */ React8.createElement(Box6, { sx: { position: "relative", "&:hover .litellm-copy-btn": { opacity: 1 } } }, /* @__PURE__ */ React8.createElement(Tooltip2, { title: copied ? "Copied" : "Copy code" }, /* @__PURE__ */ React8.createElement(
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
        copied ? /* @__PURE__ */ React8.createElement(CheckIcon, { fontSize: "inherit" }) : /* @__PURE__ */ React8.createElement(ContentCopyIcon, { fontSize: "inherit" })
      )), /* @__PURE__ */ React8.createElement("code", { className, style: { fontFamily: MONO_FONT_STACK }, ...props }, children));
    };
  }
});

// src/components/AssistantMessage.tsx
import React9, { useState as useState7 } from "react";
import { Box as Box7, IconButton as IconButton3, Tooltip as Tooltip3 } from "@mui/material";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import ThumbDownOutlinedIcon from "@mui/icons-material/ThumbDownOutlined";
import ContentCopyIcon2 from "@mui/icons-material/ContentCopy";
import CheckIcon2 from "@mui/icons-material/Check";
import ReplayIcon from "@mui/icons-material/Replay";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
var blink, AssistantMessage;
var init_AssistantMessage = __esm({
  "src/components/AssistantMessage.tsx"() {
    "use strict";
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
      const [copied, setCopied] = useState7(false);
      const showActions = !!message.content && !isStreaming;
      const handleCopy = () => {
        navigator.clipboard?.writeText(message.content).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      };
      return /* @__PURE__ */ React9.createElement(
        Box7,
        {
          sx: {
            display: "flex",
            gap: 1,
            alignSelf: "flex-start",
            maxWidth: "85%",
            "&:hover .litellm-actions": { opacity: 1 }
          }
        },
        /* @__PURE__ */ React9.createElement(PersonaAvatar, { label: avatarLabel.slice(0, 2).toUpperCase(), isStreaming, size: 28 }),
        /* @__PURE__ */ React9.createElement(Box7, { sx: { minWidth: 0, flex: 1 } }, /* @__PURE__ */ React9.createElement(
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
          message.content ? /* @__PURE__ */ React9.createElement(
            ReactMarkdown,
            {
              remarkPlugins: [remarkGfm, remarkMath],
              rehypePlugins: [rehypeKatex],
              components: { code: CodeBlock }
            },
            message.content
          ) : isStreaming ? /* @__PURE__ */ React9.createElement(
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
          ) : null
        ), showActions && /* @__PURE__ */ React9.createElement(
          Box7,
          {
            className: "litellm-actions",
            sx: { display: "flex", gap: 0.25, mt: 0.25, opacity: 0, transition: "opacity 0.15s" }
          },
          onFeedback && /* @__PURE__ */ React9.createElement(React9.Fragment, null, /* @__PURE__ */ React9.createElement(
            IconButton3,
            {
              size: "small",
              "aria-label": "Good response",
              color: message.feedback === "up" ? "primary" : "default",
              onClick: () => onFeedback(message.id, "up")
            },
            message.feedback === "up" ? /* @__PURE__ */ React9.createElement(ThumbUpIcon, { fontSize: "small" }) : /* @__PURE__ */ React9.createElement(ThumbUpOutlinedIcon, { fontSize: "small" })
          ), /* @__PURE__ */ React9.createElement(
            IconButton3,
            {
              size: "small",
              "aria-label": "Bad response",
              color: message.feedback === "down" ? "primary" : "default",
              onClick: () => onFeedback(message.id, "down")
            },
            message.feedback === "down" ? /* @__PURE__ */ React9.createElement(ThumbDownIcon, { fontSize: "small" }) : /* @__PURE__ */ React9.createElement(ThumbDownOutlinedIcon, { fontSize: "small" })
          )),
          onRegenerate && /* @__PURE__ */ React9.createElement(Tooltip3, { title: "Regenerate" }, /* @__PURE__ */ React9.createElement(IconButton3, { size: "small", "aria-label": "Regenerate", onClick: () => onRegenerate(message.id) }, /* @__PURE__ */ React9.createElement(ReplayIcon, { fontSize: "small" }))),
          /* @__PURE__ */ React9.createElement(Tooltip3, { title: copied ? "Copied" : "Copy" }, /* @__PURE__ */ React9.createElement(IconButton3, { size: "small", "aria-label": "Copy", onClick: handleCopy }, copied ? /* @__PURE__ */ React9.createElement(CheckIcon2, { fontSize: "small" }) : /* @__PURE__ */ React9.createElement(ContentCopyIcon2, { fontSize: "small" })))
        ))
      );
    };
  }
});

// src/components/UserMessage.tsx
import React10, { useState as useState8 } from "react";
import { Box as Box8, Button as Button2, Chip as Chip4, IconButton as IconButton4, TextField as TextField3, Tooltip as Tooltip4 } from "@mui/material";
import ContentCopyIcon3 from "@mui/icons-material/ContentCopy";
import CheckIcon3 from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
var UserMessage;
var init_UserMessage = __esm({
  "src/components/UserMessage.tsx"() {
    "use strict";
    UserMessage = ({ message, onEditAndResend }) => {
      const [editing, setEditing] = useState8(false);
      const [draft, setDraft] = useState8(message.content);
      const [copied, setCopied] = useState8(false);
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
        return /* @__PURE__ */ React10.createElement(Box8, { sx: { alignSelf: "flex-end", maxWidth: "80%", width: "100%", display: "flex", flexDirection: "column", gap: 0.5 } }, /* @__PURE__ */ React10.createElement(
          TextField3,
          {
            value: draft,
            onChange: (e) => setDraft(e.target.value),
            multiline: true,
            minRows: 1,
            maxRows: 8,
            size: "small",
            autoFocus: true,
            fullWidth: true
          }
        ), /* @__PURE__ */ React10.createElement(Box8, { sx: { display: "flex", gap: 1, justifyContent: "flex-end" } }, /* @__PURE__ */ React10.createElement(Button2, { size: "small", onClick: () => setEditing(false) }, "Cancel"), /* @__PURE__ */ React10.createElement(Button2, { size: "small", variant: "contained", onClick: saveEdit, disabled: !draft.trim() }, "Save & resend")));
      }
      return /* @__PURE__ */ React10.createElement(
        Box8,
        {
          sx: {
            alignSelf: "flex-end",
            maxWidth: "80%",
            "&:hover .litellm-actions": { opacity: 1 }
          }
        },
        message.attachedUrl && /* @__PURE__ */ React10.createElement(Box8, { sx: { display: "flex", justifyContent: "flex-end", mb: 0.5 } }, /* @__PURE__ */ React10.createElement(Tooltip4, { title: message.attachedUrl.url }, /* @__PURE__ */ React10.createElement(
          Chip4,
          {
            size: "small",
            icon: /* @__PURE__ */ React10.createElement(LinkIcon, { fontSize: "small" }),
            label: message.attachedUrl.title,
            variant: "outlined",
            component: "a",
            href: message.attachedUrl.url,
            target: "_blank",
            rel: "noopener noreferrer",
            clickable: true
          }
        ))),
        /* @__PURE__ */ React10.createElement(
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
          message.content
        ),
        /* @__PURE__ */ React10.createElement(
          Box8,
          {
            className: "litellm-actions",
            sx: { display: "flex", gap: 0.25, mt: 0.25, justifyContent: "flex-end", opacity: 0, transition: "opacity 0.15s" }
          },
          onEditAndResend && /* @__PURE__ */ React10.createElement(Tooltip4, { title: "Edit & resend" }, /* @__PURE__ */ React10.createElement(IconButton4, { size: "small", "aria-label": "Edit and resend", onClick: startEdit }, /* @__PURE__ */ React10.createElement(EditIcon, { fontSize: "small" }))),
          /* @__PURE__ */ React10.createElement(Tooltip4, { title: copied ? "Copied" : "Copy" }, /* @__PURE__ */ React10.createElement(IconButton4, { size: "small", "aria-label": "Copy", onClick: handleCopy }, copied ? /* @__PURE__ */ React10.createElement(CheckIcon3, { fontSize: "small" }) : /* @__PURE__ */ React10.createElement(ContentCopyIcon3, { fontSize: "small" })))
        )
      );
    };
  }
});

// src/components/MessageList.tsx
import React11 from "react";
import { Box as Box9, Typography as Typography7 } from "@mui/material";
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
      return /* @__PURE__ */ React11.createElement(
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
        groups.map((group, gi) => /* @__PURE__ */ React11.createElement(React11.Fragment, { key: group.user?.id ?? `g${gi}` }, group.user && /* @__PURE__ */ React11.createElement(UserMessage, { message: group.user, onEditAndResend }), group.assistants.length > 1 ? /* @__PURE__ */ React11.createElement(Box9, { sx: { display: "flex", gap: 1.5, overflowX: "auto", width: "100%" } }, group.assistants.map((msg) => /* @__PURE__ */ React11.createElement(Box9, { key: msg.id, sx: { flex: "1 1 320px", minWidth: 280, maxWidth: "none" } }, msg.compareModel && /* @__PURE__ */ React11.createElement(Typography7, { variant: "caption", color: "text.secondary", sx: { display: "block", mb: 0.25 } }, msg.compareModel), /* @__PURE__ */ React11.createElement(
          AssistantMessage,
          {
            message: msg,
            isStreaming: streamingMessageIds.has(msg.id),
            avatarLabel: msg.compareModel ?? avatarLabel,
            onFeedback,
            onRegenerate
          }
        )))) : group.assistants.map((msg) => /* @__PURE__ */ React11.createElement(
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
import React12 from "react";
import { Alert, AlertTitle } from "@mui/material";
var ErrorBanner;
var init_ErrorBanner = __esm({
  "src/components/ErrorBanner.tsx"() {
    "use strict";
    ErrorBanner = ({ error, onDismiss }) => {
      if (!error) return null;
      return /* @__PURE__ */ React12.createElement(Alert, { severity: "error", onClose: onDismiss, sx: { mb: 1 } }, /* @__PURE__ */ React12.createElement(AlertTitle, null, "Chat error"), error);
    };
  }
});

// src/components/SourcesPanel.tsx
import React13 from "react";
import { Box as Box10, Chip as Chip5, Typography as Typography8 } from "@mui/material";
var SourcesPanel;
var init_SourcesPanel = __esm({
  "src/components/SourcesPanel.tsx"() {
    "use strict";
    SourcesPanel = ({ citations }) => {
      return /* @__PURE__ */ React13.createElement(Box10, { sx: { p: 1.5 } }, /* @__PURE__ */ React13.createElement(Typography8, { variant: "overline", color: "text.secondary" }, "Sources"), citations.length === 0 ? /* @__PURE__ */ React13.createElement(Typography8, { variant: "body2", color: "text.secondary", sx: { mt: 0.5 } }, "No sources for the latest reply yet.") : citations.map((c, i) => /* @__PURE__ */ React13.createElement(Box10, { key: i, sx: { mt: 1.5 } }, /* @__PURE__ */ React13.createElement(Box10, { sx: { display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React13.createElement(Typography8, { variant: "body2", fontWeight: 500 }, c.url ? /* @__PURE__ */ React13.createElement("a", { href: c.url, target: "_blank", rel: "noopener noreferrer" }, c.filename) : c.filename), c.source && /* @__PURE__ */ React13.createElement(
        Chip5,
        {
          size: "small",
          label: c.source === "web" ? "Web" : "Knowledge base",
          variant: "outlined",
          color: c.source === "web" ? "secondary" : "default"
        }
      ), /* @__PURE__ */ React13.createElement(Chip5, { size: "small", label: c.score.toFixed(3), color: "primary", variant: "outlined" })), /* @__PURE__ */ React13.createElement(
        Typography8,
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
import React14 from "react";
import { Box as Box11, Divider, LinearProgress, Typography as Typography9 } from "@mui/material";
function formatUsd(n) {
  return `$${n.toFixed(4)}`;
}
var Stat, UsagePanel;
var init_UsagePanel = __esm({
  "src/components/UsagePanel.tsx"() {
    "use strict";
    Stat = ({ label, value }) => /* @__PURE__ */ React14.createElement(Box11, { sx: { display: "flex", justifyContent: "space-between", py: 0.25 } }, /* @__PURE__ */ React14.createElement(Typography9, { variant: "body2", color: "text.secondary" }, label), /* @__PURE__ */ React14.createElement(Typography9, { variant: "body2", fontWeight: 500 }, value));
    UsagePanel = ({
      lastTurnUsage,
      totalTokens,
      keySpend
    }) => {
      const budgetPct = keySpend?.max_budget && keySpend.max_budget > 0 ? Math.min(100, keySpend.spend / keySpend.max_budget * 100) : null;
      return /* @__PURE__ */ React14.createElement(Box11, { sx: { p: 1.5 } }, /* @__PURE__ */ React14.createElement(Typography9, { variant: "overline", color: "text.secondary" }, "Usage"), !lastTurnUsage && !keySpend ? /* @__PURE__ */ React14.createElement(Typography9, { variant: "body2", color: "text.secondary", sx: { mt: 0.5 } }, "Send a message to see token and budget usage.") : /* @__PURE__ */ React14.createElement(Box11, { sx: { mt: 0.5 } }, lastTurnUsage && /* @__PURE__ */ React14.createElement(React14.Fragment, null, /* @__PURE__ */ React14.createElement(Stat, { label: "This turn", value: `${lastTurnUsage.total_tokens.toLocaleString()} tokens` }), /* @__PURE__ */ React14.createElement(Stat, { label: "Prompt / completion", value: `${lastTurnUsage.prompt_tokens.toLocaleString()} / ${lastTurnUsage.completion_tokens.toLocaleString()}` }), /* @__PURE__ */ React14.createElement(Stat, { label: "Session total", value: `${totalTokens.toLocaleString()} tokens` })), keySpend && /* @__PURE__ */ React14.createElement(React14.Fragment, null, /* @__PURE__ */ React14.createElement(Divider, { sx: { my: 1 } }), /* @__PURE__ */ React14.createElement(Stat, { label: "Spent", value: formatUsd(keySpend.spend) }), keySpend.max_budget != null && /* @__PURE__ */ React14.createElement(React14.Fragment, null, /* @__PURE__ */ React14.createElement(Stat, { label: "Budget", value: `${formatUsd(keySpend.spend)} / ${formatUsd(keySpend.max_budget)}` }), /* @__PURE__ */ React14.createElement(
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
import React15, { useEffect as useEffect5, useMemo, useRef as useRef2, useState as useState9 } from "react";
import {
  Box as Box12,
  Button as Button3,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton as IconButton5,
  Divider as Divider2,
  Typography as Typography10,
  Collapse,
  Tooltip as Tooltip5,
  InputBase,
  TextField as TextField4,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Menu,
  MenuItem as MenuItem3,
  ListItemIcon,
  Chip as Chip6,
  Switch,
  FormControlLabel
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon2 from "@mui/icons-material/Delete";
import SettingsIcon from "@mui/icons-material/Settings";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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
  return thread.messages.some((m) => m.content.toLowerCase().includes(q));
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
    init_useChat();
    init_theme();
    init_ModelPicker();
    init_CompareModelPicker();
    init_VectorStorePicker();
    init_PersonaPicker();
    init_PersonaHomepage();
    init_KeyPicker();
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
      const chatApi = useApi6(liteLlmChatApiRef);
      const identityApi = useApi6(identityApiRef);
      const [userId, setUserId] = useState9("default");
      const [config, setConfig] = useState9({
        defaultModel: null,
        defaultVectorStoreIds: null,
        maxRequestBudget: null
      });
      const [model, setModel] = useState9("");
      const [compareMode, setCompareModeUi] = useState9(false);
      const [compareModelsSel, setCompareModelsSel] = useState9([]);
      const [vectorStoreIds, setVectorStoreIds] = useState9([]);
      const [webSearch, setWebSearch] = useState9(false);
      const [personaId, setPersonaId] = useState9("");
      const [customSystemPrompt, setCustomSystemPrompt] = useState9("");
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
      const messagesEndRef = useRef2(null);
      const messagesContainerRef = useRef2(null);
      const importInputRef = useRef2(null);
      useEffect5(() => {
        injectDesignSystemAssets();
        chatApi.getChatConfig().then(setConfig).catch((err) => setConfigError(err.message ?? "Failed to reach the chat backend"));
        chatApi.listPersonas().then(setPersonas).catch((err) => setPersonasError(err.message ?? "Failed to load personas")).finally(() => setPersonasLoading(false));
        identityApi.getCredentials().then((c) => setUserId(c.token ? "oidc" : "default")).catch(() => {
        });
      }, [chatApi, identityApi]);
      const chat = useChat({
        userId,
        model,
        vectorStoreIds,
        personaId,
        customSystemPrompt,
        keyAlias: keyVal.alias,
        keyToken: keyVal.token,
        topK: 5,
        webSearch
      });
      const activeThreadId = chat.activeThread?.id ?? null;
      useEffect5(() => {
        if (!chat.activeThread) return;
        setModel(chat.activeThread.model);
        setVectorStoreIds(chat.activeThread.vectorStoreIds);
        setPersonaId(chat.activeThread.personaId ?? "");
        setCustomSystemPrompt(chat.activeThread.customSystemPrompt ?? "");
        setKeyVal({ alias: chat.activeThread.keyAlias, token: chat.activeThread.keyToken });
        setCompareModeUi(chat.activeThread.mode === "compare");
        setCompareModelsSel(chat.activeThread.compareModels ?? []);
        setWebSearch(!!chat.activeThread.webSearch);
      }, [activeThreadId]);
      const messages = chat.activeThread?.messages ?? [];
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
      const visibleThreads = useMemo(
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
      return /* @__PURE__ */ React15.createElement(Box12, { sx: { display: "flex", height: "100dvh", overflow: "hidden" } }, /* @__PURE__ */ React15.createElement(
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
        /* @__PURE__ */ React15.createElement(Box12, { sx: { display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "flex-end", px: 0.5, py: 0.5 } }, /* @__PURE__ */ React15.createElement(Tooltip5, { title: sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar" }, /* @__PURE__ */ React15.createElement(IconButton5, { size: "small", onClick: () => setSidebarCollapsed((v) => !v) }, sidebarCollapsed ? /* @__PURE__ */ React15.createElement(ChevronRightIcon, { fontSize: "small" }) : /* @__PURE__ */ React15.createElement(ChevronLeftIcon, { fontSize: "small" })))),
        sidebarCollapsed ? /* @__PURE__ */ React15.createElement(Box12, { sx: { display: "flex", flexDirection: "column", alignItems: "center", gap: 1, pt: 1 } }, /* @__PURE__ */ React15.createElement(Tooltip5, { title: "New chat", placement: "right" }, /* @__PURE__ */ React15.createElement(IconButton5, { onClick: chat.newThread }, /* @__PURE__ */ React15.createElement(AddIcon, null))), /* @__PURE__ */ React15.createElement(Tooltip5, { title: "Settings", placement: "right" }, /* @__PURE__ */ React15.createElement(IconButton5, { onClick: () => setSidebarCollapsed(false) }, /* @__PURE__ */ React15.createElement(SettingsIcon, null)))) : /* @__PURE__ */ React15.createElement(React15.Fragment, null, /* @__PURE__ */ React15.createElement(Box12, { sx: { flexShrink: 0 } }, /* @__PURE__ */ React15.createElement(
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
            onClick: () => setShowSettings((v) => !v)
          },
          /* @__PURE__ */ React15.createElement(SettingsIcon, { fontSize: "small", sx: { mr: 1 } }),
          /* @__PURE__ */ React15.createElement(Typography10, { variant: "overline", sx: { flex: 1 } }, "Settings"),
          /* @__PURE__ */ React15.createElement(
            ExpandMoreIcon,
            {
              fontSize: "small",
              sx: {
                transform: showSettings ? "rotate(180deg)" : "none",
                transition: "transform 0.2s"
              }
            }
          )
        ), /* @__PURE__ */ React15.createElement(Collapse, { in: showSettings }, /* @__PURE__ */ React15.createElement(Box12, { sx: { p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 } }, configError && /* @__PURE__ */ React15.createElement(Typography10, { variant: "caption", color: "error" }, "Couldn't load chat defaults: ", configError), /* @__PURE__ */ React15.createElement(
          PersonaPicker,
          {
            value: personaId,
            personas,
            loading: personasLoading,
            error: personasError,
            onChange: handlePersonaChange
          }
        ), /* @__PURE__ */ React15.createElement(
          TextField4,
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
        ), /* @__PURE__ */ React15.createElement(
          FormControlLabel,
          {
            control: /* @__PURE__ */ React15.createElement(
              Switch,
              {
                size: "small",
                checked: compareMode,
                onChange: (e) => setCompareModeUi(e.target.checked)
              }
            ),
            label: /* @__PURE__ */ React15.createElement(Typography10, { variant: "body2" }, "Compare models side-by-side")
          }
        ), compareMode ? /* @__PURE__ */ React15.createElement(CompareModelPicker, { value: compareModelsSel, onChange: setCompareModelsSel }) : /* @__PURE__ */ React15.createElement(ModelPicker, { value: model, onChange: setModel, defaultModel: config.defaultModel }), /* @__PURE__ */ React15.createElement(
          Accordion,
          {
            disableGutters: true,
            variant: "outlined",
            sx: { "&:before": { display: "none" } }
          },
          /* @__PURE__ */ React15.createElement(AccordionSummary, { expandIcon: /* @__PURE__ */ React15.createElement(ExpandMoreIcon, { fontSize: "small" }) }, /* @__PURE__ */ React15.createElement(Typography10, { variant: "body2", sx: { fontWeight: 500 } }, "Advanced")),
          /* @__PURE__ */ React15.createElement(AccordionDetails, { sx: { display: "flex", flexDirection: "column", gap: 1.5 } }, /* @__PURE__ */ React15.createElement(
            VectorStorePicker,
            {
              value: vectorStoreIds,
              onChange: setVectorStoreIds,
              defaultVectorStoreIds: config.defaultVectorStoreIds
            }
          ), /* @__PURE__ */ React15.createElement(
            FormControlLabel,
            {
              control: /* @__PURE__ */ React15.createElement(
                Switch,
                {
                  size: "small",
                  checked: webSearch,
                  onChange: (e) => setWebSearch(e.target.checked)
                }
              ),
              label: /* @__PURE__ */ React15.createElement(Typography10, { variant: "body2" }, "Include web search")
            }
          ), /* @__PURE__ */ React15.createElement(
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
        )))), /* @__PURE__ */ React15.createElement(Divider2, null), /* @__PURE__ */ React15.createElement(Box12, { sx: { p: 1.5, display: "flex", gap: 1 } }, /* @__PURE__ */ React15.createElement(
          Button3,
          {
            fullWidth: true,
            variant: "outlined",
            startIcon: /* @__PURE__ */ React15.createElement(AddIcon, null),
            onClick: chat.newThread,
            size: "small"
          },
          "New chat"
        ), /* @__PURE__ */ React15.createElement(Tooltip5, { title: "Import thread" }, /* @__PURE__ */ React15.createElement(IconButton5, { size: "small", onClick: () => importInputRef.current?.click() }, /* @__PURE__ */ React15.createElement(FileUploadIcon, { fontSize: "small" }))), /* @__PURE__ */ React15.createElement(
          "input",
          {
            ref: importInputRef,
            type: "file",
            accept: "application/json",
            hidden: true,
            onChange: handleImportFile
          }
        )), importError && /* @__PURE__ */ React15.createElement(Box12, { sx: { px: 1.5, pb: 1 } }, /* @__PURE__ */ React15.createElement(Typography10, { variant: "caption", color: "error" }, importError)), /* @__PURE__ */ React15.createElement(Box12, { sx: { px: 1.5, pb: 1 } }, /* @__PURE__ */ React15.createElement(
          InputBase,
          {
            fullWidth: true,
            placeholder: "Search threads\u2026",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            startAdornment: /* @__PURE__ */ React15.createElement(SearchIcon, { fontSize: "small", sx: { mr: 0.75, color: "text.secondary" } }),
            sx: {
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              px: 1,
              py: 0.5,
              fontSize: "0.85rem"
            }
          }
        )), /* @__PURE__ */ React15.createElement(Box12, { sx: { flex: 1, overflowY: "auto", minHeight: 0 } }, /* @__PURE__ */ React15.createElement(List, { dense: true }, visibleThreads.map((t) => /* @__PURE__ */ React15.createElement(
          ListItem,
          {
            key: t.id,
            disablePadding: true,
            secondaryAction: /* @__PURE__ */ React15.createElement(IconButton5, { edge: "end", size: "small", onClick: (e) => openThreadMenu(e, t.id) }, /* @__PURE__ */ React15.createElement(MoreVertIcon, { fontSize: "small" }))
          },
          /* @__PURE__ */ React15.createElement(
            ListItemButton,
            {
              selected: chat.activeThread?.id === t.id,
              onClick: () => chat.selectThread(t.id),
              sx: { pr: 6 }
            },
            t.pinned && /* @__PURE__ */ React15.createElement(PushPinIcon, { fontSize: "small", sx: { mr: 0.75, color: "text.secondary" } }),
            /* @__PURE__ */ React15.createElement(
              ListItemText,
              {
                primary: t.title,
                primaryTypographyProps: { noWrap: true, variant: "body2" },
                secondaryTypographyProps: { noWrap: true, variant: "caption" }
              }
            )
          )
        )), visibleThreads.length === 0 && /* @__PURE__ */ React15.createElement(Typography10, { variant: "caption", color: "text.secondary", sx: { px: 2, py: 1, display: "block" } }, searchQuery ? "No threads match your search." : "No threads yet."))), /* @__PURE__ */ React15.createElement(Menu, { anchorEl: threadMenuAnchor, open: !!threadMenuAnchor, onClose: closeThreadMenu }, /* @__PURE__ */ React15.createElement(
          MenuItem3,
          {
            onClick: () => {
              if (threadMenuTarget) chat.togglePin(threadMenuTarget);
              closeThreadMenu();
            }
          },
          /* @__PURE__ */ React15.createElement(ListItemIcon, null, menuTargetThread?.pinned ? /* @__PURE__ */ React15.createElement(PushPinIcon, { fontSize: "small" }) : /* @__PURE__ */ React15.createElement(PushPinOutlinedIcon, { fontSize: "small" })),
          menuTargetThread?.pinned ? "Unpin" : "Pin"
        ), /* @__PURE__ */ React15.createElement(
          MenuItem3,
          {
            onClick: () => {
              if (threadMenuTarget) chat.exportThread(threadMenuTarget);
              closeThreadMenu();
            }
          },
          /* @__PURE__ */ React15.createElement(ListItemIcon, null, /* @__PURE__ */ React15.createElement(FileDownloadIcon, { fontSize: "small" })),
          "Export"
        ), /* @__PURE__ */ React15.createElement(
          MenuItem3,
          {
            onClick: () => {
              if (threadMenuTarget) chat.deleteThread(threadMenuTarget);
              closeThreadMenu();
            }
          },
          /* @__PURE__ */ React15.createElement(ListItemIcon, null, /* @__PURE__ */ React15.createElement(DeleteIcon2, { fontSize: "small" })),
          "Delete"
        )))
      ), /* @__PURE__ */ React15.createElement(
        Box12,
        {
          sx: {
            flex: 3,
            display: "flex",
            justifyContent: "center",
            overflow: "hidden"
          }
        },
        /* @__PURE__ */ React15.createElement(
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
          /* @__PURE__ */ React15.createElement(
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
            /* @__PURE__ */ React15.createElement(ChatIcon, { fontSize: "small", color: "action" }),
            /* @__PURE__ */ React15.createElement(Typography10, { variant: "subtitle2", noWrap: true, sx: { flex: 1 } }, chat.activeThread?.title ?? "AI Chat"),
            /* @__PURE__ */ React15.createElement(Tooltip5, { title: rightPanelCollapsed ? "Show context panel" : "Hide context panel" }, /* @__PURE__ */ React15.createElement(IconButton5, { size: "small", onClick: () => setRightPanelCollapsed((v) => !v) }, rightPanelCollapsed ? /* @__PURE__ */ React15.createElement(ChevronLeftIcon, { fontSize: "small" }) : /* @__PURE__ */ React15.createElement(ChevronRightIcon, { fontSize: "small" })))
          ),
          chat.error && /* @__PURE__ */ React15.createElement(Box12, { sx: { px: 2, pt: 1 } }, /* @__PURE__ */ React15.createElement(ErrorBanner, { error: chat.error, onDismiss: () => {
          } })),
          /* @__PURE__ */ React15.createElement(
            Box12,
            {
              ref: messagesContainerRef,
              sx: {
                flex: 1,
                overflowY: "auto",
                minHeight: 0
              }
            },
            messages.length === 0 ? /* @__PURE__ */ React15.createElement(
              PersonaHomepage,
              {
                personas,
                loading: personasLoading,
                error: personasError,
                selectedId: personaId,
                onSelect: handlePersonaChange
              }
            ) : /* @__PURE__ */ React15.createElement(
              MessageList,
              {
                messages,
                streamingMessageIds: chat.streamingMessageIds,
                onFeedback: chat.submitFeedback,
                onRegenerate: chat.regenerateFrom,
                onEditAndResend: chat.editAndResend
              }
            ),
            /* @__PURE__ */ React15.createElement("div", { ref: messagesEndRef })
          ),
          (urlPreviewLoading || urlPreview || urlPreviewError) && /* @__PURE__ */ React15.createElement(Box12, { sx: { px: 2, pt: 1 } }, urlPreviewLoading ? /* @__PURE__ */ React15.createElement(Chip6, { size: "small", icon: /* @__PURE__ */ React15.createElement(LinkIcon2, { fontSize: "small" }), label: "Fetching page\u2026", variant: "outlined" }) : urlPreviewError ? /* @__PURE__ */ React15.createElement(
            Chip6,
            {
              size: "small",
              color: "error",
              icon: /* @__PURE__ */ React15.createElement(LinkIcon2, { fontSize: "small" }),
              label: urlPreviewError,
              variant: "outlined",
              onDelete: dismissUrlPreview,
              deleteIcon: /* @__PURE__ */ React15.createElement(CloseIcon, { fontSize: "small" })
            }
          ) : urlPreview ? /* @__PURE__ */ React15.createElement(Tooltip5, { title: urlPreview.url }, /* @__PURE__ */ React15.createElement(
            Chip6,
            {
              size: "small",
              icon: /* @__PURE__ */ React15.createElement(LinkIcon2, { fontSize: "small" }),
              label: `Page attached: ${urlPreview.title}`,
              variant: "outlined",
              onDelete: dismissUrlPreview,
              deleteIcon: /* @__PURE__ */ React15.createElement(CloseIcon, { fontSize: "small" })
            }
          )) : null),
          /* @__PURE__ */ React15.createElement(
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
            /* @__PURE__ */ React15.createElement(
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
            isStreaming ? /* @__PURE__ */ React15.createElement(Tooltip5, { title: "Stop" }, /* @__PURE__ */ React15.createElement(IconButton5, { color: "error", onClick: chat.stopGeneration }, /* @__PURE__ */ React15.createElement(StopIcon, null))) : /* @__PURE__ */ React15.createElement(Tooltip5, { title: "Send" }, /* @__PURE__ */ React15.createElement(
              IconButton5,
              {
                color: "primary",
                onClick: handleSend,
                disabled: !input.trim() || !keyVal.token || compareMode && compareModelsSel.length === 0
              },
              /* @__PURE__ */ React15.createElement(SendIcon, null)
            ))
          ),
          statusParts.length > 0 && /* @__PURE__ */ React15.createElement(Box12, { sx: { px: 2, pb: 1 } }, /* @__PURE__ */ React15.createElement(Typography10, { variant: "caption", color: "text.secondary" }, statusParts.join(" \xB7 ")))
        )
      ), !rightPanelCollapsed && /* @__PURE__ */ React15.createElement(
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
        /* @__PURE__ */ React15.createElement(SourcesPanel, { citations: chat.citations }),
        /* @__PURE__ */ React15.createElement(Divider2, null),
        /* @__PURE__ */ React15.createElement(
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

// src/plugin.tsx
init_api();
import React16 from "react";
import { Chat as ChatIcon2 } from "@mui/icons-material";
import {
  createFrontendPlugin,
  ApiBlueprint,
  PageBlueprint,
  fetchApiRef
} from "@backstage/frontend-plugin-api";
var liteLlmChatApi = ApiBlueprint.make({
  params: (defineParams) => defineParams({
    api: liteLlmChatApiRef,
    deps: { fetchApi: fetchApiRef },
    factory: ({ fetchApi }) => new LiteLlmChatApi(fetchApi)
  })
});
var chatPage = PageBlueprint.make({
  params: {
    path: "/ai-chat",
    title: "AI Chat",
    icon: /* @__PURE__ */ React16.createElement(ChatIcon2, null),
    loader: async () => {
      const { ChatPage: ChatPage2 } = await Promise.resolve().then(() => (init_ChatPage(), ChatPage_exports));
      return /* @__PURE__ */ React16.createElement(ChatPage2, null);
    }
  }
});
var litellmChatPlugin = createFrontendPlugin({
  pluginId: "litellm-chat",
  extensions: [liteLlmChatApi, chatPage]
});

// src/index.ts
init_ChatPage();
init_api();
export {
  ChatPage,
  LiteLlmChatApi,
  liteLlmChatApiRef,
  litellmChatPlugin
};
//# sourceMappingURL=index.esm.js.map
