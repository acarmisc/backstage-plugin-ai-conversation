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
      filename: r.filename ?? r.file_name ?? r.source ?? r.name ?? "",
      score: typeof r.score === "number" ? r.score : 0,
      text: r.text ?? r.snippet ?? r.content ?? ""
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
  const { userId, model, vectorStoreIds, personaId, customSystemPrompt, keyAlias, keyToken, topK } = opts;
  const api = useApi(liteLlmChatApiRef);
  const [threads, setThreads] = useState(() => loadThreads(userId));
  const [activeId, setActiveId] = useState(
    () => threads[0]?.id ?? null
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [citations, setCitations] = useState([]);
  const [keySpend, setKeySpend] = useState(null);
  const abortRef = useRef(null);
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
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);
  const sendMessage = useCallback(
    (text) => {
      if (!text.trim() || !activeThread || !keyToken) return;
      setError(null);
      setCitations([]);
      const userMsg = { id: genId(), role: "user", content: text };
      const assistantMsg = { id: genId(), role: "assistant", content: "" };
      const threadId = activeThread.id;
      const updatedMessages = [...activeThread.messages, userMsg, assistantMsg];
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
            updatedAt: Date.now()
          } : t
        )
      );
      setIsStreaming(true);
      const reqMessages = updatedMessages.slice(0, -1);
      const controller = api.chatStream(
        {
          model,
          messages: reqMessages,
          vector_store_ids: vectorStoreIds.length ? vectorStoreIds : void 0,
          persona_id: personaId || void 0,
          custom_system_prompt: customSystemPrompt || void 0,
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
                snippet: r.text
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
                const msgs = [...t.messages];
                const last = msgs[msgs.length - 1];
                msgs[msgs.length - 1] = {
                  ...last,
                  content: last.content + chunk.delta
                };
                return { ...t, messages: msgs, updatedAt: Date.now() };
              })
            );
          }
        },
        () => {
          setIsStreaming(false);
          abortRef.current = null;
          if (currentKeyAlias) {
            api.getKeySpend(currentKeyAlias).then(setKeySpend).catch(() => {
            });
          }
        },
        (err) => {
          setError(err.message);
          setIsStreaming(false);
          abortRef.current = null;
        }
      );
      abortRef.current = controller;
    },
    [activeThread, api, keyToken, model, vectorStoreIds, personaId, customSystemPrompt, keyAlias, topK]
  );
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
    stopGeneration,
    submitFeedback,
    isStreaming,
    error,
    citations,
    keySpend
  };
}
var STORAGE_PREFIX, SAVE_DEBOUNCE_MS;
var init_useChat = __esm({
  "src/hooks/useChat.ts"() {
    "use strict";
    init_api();
    STORAGE_PREFIX = "litellm-chat:threads";
    SAVE_DEBOUNCE_MS = 400;
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

// src/components/VectorStorePicker.tsx
import React2, { useEffect as useEffect3, useState as useState3 } from "react";
import { Autocomplete, Box, Checkbox, Chip, TextField, Typography as Typography2 } from "@mui/material";
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
      const chatApi = useApi3(liteLlmChatApiRef);
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
      return /* @__PURE__ */ React2.createElement(Box, null, /* @__PURE__ */ React2.createElement(
        Autocomplete,
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
            TextField,
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

// src/components/PersonaPicker.tsx
import React3 from "react";
import { Select as Select2, MenuItem as MenuItem2, FormControl as FormControl2, InputLabel as InputLabel2, Typography as Typography3 } from "@mui/material";
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
      return /* @__PURE__ */ React3.createElement(FormControl2, { size: "small", error: !!error, sx: { minWidth: 200 } }, /* @__PURE__ */ React3.createElement(InputLabel2, { shrink: true }, "Persona"), /* @__PURE__ */ React3.createElement(
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
        /* @__PURE__ */ React3.createElement(MenuItem2, { value: "" }, /* @__PURE__ */ React3.createElement("em", null, "None")),
        personas.map((p) => /* @__PURE__ */ React3.createElement(MenuItem2, { key: p.id, value: p.id }, p.title))
      ), error && /* @__PURE__ */ React3.createElement(Typography3, { variant: "caption", color: "error", sx: { mt: 0.5 } }, error));
    };
  }
});

// src/components/PersonaHomepage.tsx
import React4 from "react";
import { Box as Box2, Typography as Typography4, Chip as Chip2, CircularProgress } from "@mui/material";
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
        return /* @__PURE__ */ React4.createElement(Box2, { sx: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React4.createElement(CircularProgress, { size: 24 }));
      }
      if (error || personas.length === 0) {
        return /* @__PURE__ */ React4.createElement(Box2, { sx: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React4.createElement(Typography4, { color: "text.secondary" }, error ? `Couldn't load personas: ${error}` : "Start a conversation\u2026"));
      }
      return /* @__PURE__ */ React4.createElement(
        Box2,
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
        /* @__PURE__ */ React4.createElement(Typography4, { variant: "subtitle1", align: "center", color: "text.secondary" }, "Pick a persona to get started, or just start typing"),
        /* @__PURE__ */ React4.createElement(
          Box2,
          {
            sx: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 1.5
            }
          },
          personas.map((p) => {
            const selected = p.id === selectedId;
            return /* @__PURE__ */ React4.createElement(
              Box2,
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
              /* @__PURE__ */ React4.createElement(Box2, { sx: { display: "flex", alignItems: "center", gap: 0.75 } }, /* @__PURE__ */ React4.createElement(PersonIcon, { fontSize: "small", color: selected ? "primary" : "action" }), /* @__PURE__ */ React4.createElement(Typography4, { variant: "body2", sx: { fontWeight: 600 }, noWrap: true }, p.title)),
              p.description && /* @__PURE__ */ React4.createElement(
                Typography4,
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
              p.tags && p.tags.length > 0 && /* @__PURE__ */ React4.createElement(Box2, { sx: { display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 } }, p.tags.map((tag) => /* @__PURE__ */ React4.createElement(Chip2, { key: tag, label: tag, size: "small", variant: "outlined" })))
            );
          })
        )
      );
    };
  }
});

// src/components/KeyPicker.tsx
import React5, { useState as useState4 } from "react";
import { Button, Box as Box3, Typography as Typography5, CircularProgress as CircularProgress2, Tooltip, IconButton } from "@mui/material";
import KeyIcon from "@mui/icons-material/VpnKey";
import DeleteIcon from "@mui/icons-material/Delete";
import { useApi as useApi4 } from "@backstage/core-plugin-api";
var KeyPicker;
var init_KeyPicker = __esm({
  "src/components/KeyPicker.tsx"() {
    "use strict";
    init_api();
    KeyPicker = ({ value, onChange, onDelete }) => {
      const chatApi = useApi4(liteLlmChatApiRef);
      const [loading, setLoading] = useState4(false);
      const [error, setError] = useState4(null);
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
          startIcon: loading ? /* @__PURE__ */ React5.createElement(CircularProgress2, { size: 16 }) : /* @__PURE__ */ React5.createElement(KeyIcon, null),
          onClick: handleGenerate,
          disabled: loading
        },
        loading ? "Minting\u2026" : "Generate chat key"
      ), error && /* @__PURE__ */ React5.createElement(Typography5, { variant: "caption", color: "error", sx: { display: "block", mt: 0.5 } }, error));
    };
  }
});

// src/components/MessageList.tsx
import React6 from "react";
import { Box as Box4, IconButton as IconButton2 } from "@mui/material";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import ThumbDownOutlinedIcon from "@mui/icons-material/ThumbDownOutlined";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
var blink, MessageList;
var init_MessageList = __esm({
  "src/components/MessageList.tsx"() {
    "use strict";
    blink = {
      "@keyframes blink": {
        "0%, 50%": { opacity: 1 },
        "51%, 100%": { opacity: 0 }
      }
    };
    MessageList = ({
      messages,
      isStreaming,
      onFeedback
    }) => {
      return /* @__PURE__ */ React6.createElement(
        Box4,
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
        messages.map((msg, i) => {
          const isUser = msg.role === "user";
          const isLast = i === messages.length - 1;
          const showFeedback = !isUser && !!msg.content && !(isStreaming && isLast) && !!onFeedback;
          return /* @__PURE__ */ React6.createElement(
            Box4,
            {
              key: msg.id,
              sx: {
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "80%"
              }
            },
            /* @__PURE__ */ React6.createElement(
              Box4,
              {
                sx: {
                  bgcolor: isUser ? "primary.main" : "background.paper",
                  color: isUser ? "primary.contrastText" : "text.primary",
                  border: isUser ? "none" : 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  px: 1.5,
                  py: 1,
                  wordBreak: "break-word",
                  "& p": { margin: 0 },
                  "& pre": { overflowX: "auto", maxWidth: "100%" },
                  "& code": {
                    fontFamily: "monospace",
                    fontSize: "0.85em",
                    bgcolor: isUser ? "transparent" : "action.hover",
                    px: 0.5,
                    borderRadius: 0.5
                  },
                  "& pre code": { bgcolor: "transparent", px: 0 }
                }
              },
              isUser ? /* @__PURE__ */ React6.createElement(Box4, { sx: { whiteSpace: "pre-wrap" } }, msg.content) : msg.content ? /* @__PURE__ */ React6.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, msg.content) : isStreaming && isLast ? /* @__PURE__ */ React6.createElement(
                Box4,
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
            ),
            showFeedback && /* @__PURE__ */ React6.createElement(Box4, { sx: { display: "flex", gap: 0.5, mt: 0.25 } }, /* @__PURE__ */ React6.createElement(
              IconButton2,
              {
                size: "small",
                "aria-label": "Good response",
                color: msg.feedback === "up" ? "primary" : "default",
                onClick: () => onFeedback(msg.id, "up")
              },
              msg.feedback === "up" ? /* @__PURE__ */ React6.createElement(ThumbUpIcon, { fontSize: "small" }) : /* @__PURE__ */ React6.createElement(ThumbUpOutlinedIcon, { fontSize: "small" })
            ), /* @__PURE__ */ React6.createElement(
              IconButton2,
              {
                size: "small",
                "aria-label": "Bad response",
                color: msg.feedback === "down" ? "primary" : "default",
                onClick: () => onFeedback(msg.id, "down")
              },
              msg.feedback === "down" ? /* @__PURE__ */ React6.createElement(ThumbDownIcon, { fontSize: "small" }) : /* @__PURE__ */ React6.createElement(ThumbDownOutlinedIcon, { fontSize: "small" })
            ))
          );
        })
      );
    };
  }
});

// src/components/ErrorBanner.tsx
import React7 from "react";
import { Alert, AlertTitle } from "@mui/material";
var ErrorBanner;
var init_ErrorBanner = __esm({
  "src/components/ErrorBanner.tsx"() {
    "use strict";
    ErrorBanner = ({ error, onDismiss }) => {
      if (!error) return null;
      return /* @__PURE__ */ React7.createElement(Alert, { severity: "error", onClose: onDismiss, sx: { mb: 1 } }, /* @__PURE__ */ React7.createElement(AlertTitle, null, "Chat error"), error);
    };
  }
});

// src/components/SourcesPanel.tsx
import React8 from "react";
import { Box as Box5, Chip as Chip3, Typography as Typography6 } from "@mui/material";
var SourcesPanel;
var init_SourcesPanel = __esm({
  "src/components/SourcesPanel.tsx"() {
    "use strict";
    SourcesPanel = ({ citations }) => {
      return /* @__PURE__ */ React8.createElement(Box5, { sx: { p: 1.5 } }, /* @__PURE__ */ React8.createElement(Typography6, { variant: "overline", color: "text.secondary" }, "Sources"), citations.length === 0 ? /* @__PURE__ */ React8.createElement(Typography6, { variant: "body2", color: "text.secondary", sx: { mt: 0.5 } }, "No sources for the latest reply yet.") : citations.map((c, i) => /* @__PURE__ */ React8.createElement(Box5, { key: i, sx: { mt: 1.5 } }, /* @__PURE__ */ React8.createElement(Box5, { sx: { display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React8.createElement(Typography6, { variant: "body2", fontWeight: 500 }, c.filename), /* @__PURE__ */ React8.createElement(Chip3, { size: "small", label: c.score.toFixed(3), color: "primary", variant: "outlined" })), /* @__PURE__ */ React8.createElement(
        Typography6,
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
import React9 from "react";
import { Box as Box6, Divider, LinearProgress, Typography as Typography7 } from "@mui/material";
function formatUsd(n) {
  return `$${n.toFixed(4)}`;
}
var Stat, UsagePanel;
var init_UsagePanel = __esm({
  "src/components/UsagePanel.tsx"() {
    "use strict";
    Stat = ({ label, value }) => /* @__PURE__ */ React9.createElement(Box6, { sx: { display: "flex", justifyContent: "space-between", py: 0.25 } }, /* @__PURE__ */ React9.createElement(Typography7, { variant: "body2", color: "text.secondary" }, label), /* @__PURE__ */ React9.createElement(Typography7, { variant: "body2", fontWeight: 500 }, value));
    UsagePanel = ({
      lastTurnUsage,
      totalTokens,
      keySpend
    }) => {
      const budgetPct = keySpend?.max_budget && keySpend.max_budget > 0 ? Math.min(100, keySpend.spend / keySpend.max_budget * 100) : null;
      return /* @__PURE__ */ React9.createElement(Box6, { sx: { p: 1.5 } }, /* @__PURE__ */ React9.createElement(Typography7, { variant: "overline", color: "text.secondary" }, "Usage"), !lastTurnUsage && !keySpend ? /* @__PURE__ */ React9.createElement(Typography7, { variant: "body2", color: "text.secondary", sx: { mt: 0.5 } }, "Send a message to see token and budget usage.") : /* @__PURE__ */ React9.createElement(Box6, { sx: { mt: 0.5 } }, lastTurnUsage && /* @__PURE__ */ React9.createElement(React9.Fragment, null, /* @__PURE__ */ React9.createElement(Stat, { label: "This turn", value: `${lastTurnUsage.total_tokens.toLocaleString()} tokens` }), /* @__PURE__ */ React9.createElement(Stat, { label: "Prompt / completion", value: `${lastTurnUsage.prompt_tokens.toLocaleString()} / ${lastTurnUsage.completion_tokens.toLocaleString()}` }), /* @__PURE__ */ React9.createElement(Stat, { label: "Session total", value: `${totalTokens.toLocaleString()} tokens` })), keySpend && /* @__PURE__ */ React9.createElement(React9.Fragment, null, /* @__PURE__ */ React9.createElement(Divider, { sx: { my: 1 } }), /* @__PURE__ */ React9.createElement(Stat, { label: "Spent", value: formatUsd(keySpend.spend) }), keySpend.max_budget != null && /* @__PURE__ */ React9.createElement(React9.Fragment, null, /* @__PURE__ */ React9.createElement(Stat, { label: "Budget", value: `${formatUsd(keySpend.spend)} / ${formatUsd(keySpend.max_budget)}` }), /* @__PURE__ */ React9.createElement(
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
import React10, { useEffect as useEffect4, useState as useState5, useRef as useRef2 } from "react";
import {
  Box as Box7,
  Button as Button2,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton as IconButton3,
  Divider as Divider2,
  Typography as Typography8,
  Collapse,
  Tooltip as Tooltip2,
  InputBase,
  TextField as TextField2,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon2 from "@mui/icons-material/Delete";
import SettingsIcon from "@mui/icons-material/Settings";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChatIcon from "@mui/icons-material/Chat";
import SendIcon from "@mui/icons-material/Send";
import StopIcon from "@mui/icons-material/Stop";
import { useApi as useApi5, identityApiRef } from "@backstage/core-plugin-api";
var SIDEBAR_WIDTH, RIGHT_RAIL_WIDTH, CHAT_MAX_WIDTH, ChatPage;
var init_ChatPage = __esm({
  "src/components/ChatPage.tsx"() {
    "use strict";
    init_api();
    init_useChat();
    init_ModelPicker();
    init_VectorStorePicker();
    init_PersonaPicker();
    init_PersonaHomepage();
    init_KeyPicker();
    init_MessageList();
    init_ErrorBanner();
    init_SourcesPanel();
    init_UsagePanel();
    SIDEBAR_WIDTH = 280;
    RIGHT_RAIL_WIDTH = 300;
    CHAT_MAX_WIDTH = 900;
    ChatPage = () => {
      const chatApi = useApi5(liteLlmChatApiRef);
      const identityApi = useApi5(identityApiRef);
      const [userId, setUserId] = useState5("default");
      const [config, setConfig] = useState5({
        defaultModel: null,
        defaultVectorStoreIds: null,
        maxRequestBudget: null
      });
      const [model, setModel] = useState5("");
      const [vectorStoreIds, setVectorStoreIds] = useState5([]);
      const [personaId, setPersonaId] = useState5("");
      const [customSystemPrompt, setCustomSystemPrompt] = useState5("");
      const [keyVal, setKeyVal] = useState5({
        alias: "",
        token: ""
      });
      const [showSettings, setShowSettings] = useState5(true);
      const [input, setInput] = useState5("");
      const [configError, setConfigError] = useState5(null);
      const [personas, setPersonas] = useState5([]);
      const [personasLoading, setPersonasLoading] = useState5(true);
      const [personasError, setPersonasError] = useState5(null);
      const messagesEndRef = useRef2(null);
      const messagesContainerRef = useRef2(null);
      useEffect4(() => {
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
        topK: 5
      });
      const activeThreadId = chat.activeThread?.id ?? null;
      useEffect4(() => {
        if (!chat.activeThread) return;
        setModel(chat.activeThread.model);
        setVectorStoreIds(chat.activeThread.vectorStoreIds);
        setPersonaId(chat.activeThread.personaId ?? "");
        setCustomSystemPrompt(chat.activeThread.customSystemPrompt ?? "");
        setKeyVal({ alias: chat.activeThread.keyAlias, token: chat.activeThread.keyToken });
      }, [activeThreadId]);
      const messages = chat.activeThread?.messages ?? [];
      const isStreaming = chat.isStreaming;
      useEffect4(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [messages, isStreaming]);
      const handlePersonaChange = (id, persona) => {
        setPersonaId(id);
        if (persona?.defaultModel) setModel(persona.defaultModel);
        if (persona?.defaultVectorStoreIds) {
          setVectorStoreIds(persona.defaultVectorStoreIds);
        }
      };
      const handleSend = () => {
        if (!input.trim() || !keyVal.token || isStreaming) return;
        if (!chat.activeThread) {
          chat.newThread();
        }
        chat.sendMessage(input.trim());
        setInput("");
      };
      const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      };
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
      return /* @__PURE__ */ React10.createElement(Box7, { sx: { display: "flex", height: "100dvh", overflow: "hidden" } }, /* @__PURE__ */ React10.createElement(
        Box7,
        {
          sx: {
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            borderRight: 1,
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }
        },
        /* @__PURE__ */ React10.createElement(Box7, { sx: { flexShrink: 0 } }, /* @__PURE__ */ React10.createElement(
          Box7,
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
          /* @__PURE__ */ React10.createElement(SettingsIcon, { fontSize: "small", sx: { mr: 1 } }),
          /* @__PURE__ */ React10.createElement(Typography8, { variant: "overline", sx: { flex: 1 } }, "Settings"),
          /* @__PURE__ */ React10.createElement(
            ExpandMoreIcon,
            {
              fontSize: "small",
              sx: {
                transform: showSettings ? "rotate(180deg)" : "none",
                transition: "transform 0.2s"
              }
            }
          )
        ), /* @__PURE__ */ React10.createElement(Collapse, { in: showSettings }, /* @__PURE__ */ React10.createElement(Box7, { sx: { p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 } }, configError && /* @__PURE__ */ React10.createElement(Typography8, { variant: "caption", color: "error" }, "Couldn't load chat defaults: ", configError), /* @__PURE__ */ React10.createElement(
          PersonaPicker,
          {
            value: personaId,
            personas,
            loading: personasLoading,
            error: personasError,
            onChange: handlePersonaChange
          }
        ), /* @__PURE__ */ React10.createElement(
          TextField2,
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
        ), /* @__PURE__ */ React10.createElement(ModelPicker, { value: model, onChange: setModel, defaultModel: config.defaultModel }), /* @__PURE__ */ React10.createElement(
          Accordion,
          {
            disableGutters: true,
            variant: "outlined",
            sx: { "&:before": { display: "none" } }
          },
          /* @__PURE__ */ React10.createElement(AccordionSummary, { expandIcon: /* @__PURE__ */ React10.createElement(ExpandMoreIcon, { fontSize: "small" }) }, /* @__PURE__ */ React10.createElement(Typography8, { variant: "body2", sx: { fontWeight: 500 } }, "Advanced")),
          /* @__PURE__ */ React10.createElement(AccordionDetails, { sx: { display: "flex", flexDirection: "column", gap: 1.5 } }, /* @__PURE__ */ React10.createElement(
            VectorStorePicker,
            {
              value: vectorStoreIds,
              onChange: setVectorStoreIds,
              defaultVectorStoreIds: config.defaultVectorStoreIds
            }
          ), /* @__PURE__ */ React10.createElement(
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
        )))),
        /* @__PURE__ */ React10.createElement(Divider2, null),
        /* @__PURE__ */ React10.createElement(Box7, { sx: { p: 1.5 } }, /* @__PURE__ */ React10.createElement(
          Button2,
          {
            fullWidth: true,
            variant: "outlined",
            startIcon: /* @__PURE__ */ React10.createElement(AddIcon, null),
            onClick: chat.newThread,
            size: "small"
          },
          "New chat"
        )),
        /* @__PURE__ */ React10.createElement(Box7, { sx: { flex: 1, overflowY: "auto", minHeight: 0 } }, /* @__PURE__ */ React10.createElement(List, { dense: true }, chat.threads.map((t) => /* @__PURE__ */ React10.createElement(
          ListItem,
          {
            key: t.id,
            disablePadding: true,
            secondaryAction: /* @__PURE__ */ React10.createElement(
              IconButton3,
              {
                edge: "end",
                size: "small",
                onClick: (e) => {
                  e.stopPropagation();
                  chat.deleteThread(t.id);
                }
              },
              /* @__PURE__ */ React10.createElement(DeleteIcon2, { fontSize: "small" })
            )
          },
          /* @__PURE__ */ React10.createElement(
            ListItemButton,
            {
              selected: chat.activeThread?.id === t.id,
              onClick: () => chat.selectThread(t.id),
              sx: { pr: 6 }
            },
            /* @__PURE__ */ React10.createElement(
              ListItemText,
              {
                primary: t.title,
                primaryTypographyProps: { noWrap: true, variant: "body2" },
                secondaryTypographyProps: { noWrap: true, variant: "caption" }
              }
            )
          )
        ))))
      ), /* @__PURE__ */ React10.createElement(
        Box7,
        {
          sx: {
            flex: 3,
            display: "flex",
            justifyContent: "center",
            overflow: "hidden"
          }
        },
        /* @__PURE__ */ React10.createElement(
          Box7,
          {
            sx: {
              width: "100%",
              maxWidth: CHAT_MAX_WIDTH,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }
          },
          /* @__PURE__ */ React10.createElement(
            Box7,
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
            /* @__PURE__ */ React10.createElement(ChatIcon, { fontSize: "small", color: "action" }),
            /* @__PURE__ */ React10.createElement(Typography8, { variant: "subtitle2", noWrap: true, sx: { flex: 1 } }, chat.activeThread?.title ?? "AI Chat")
          ),
          chat.error && /* @__PURE__ */ React10.createElement(Box7, { sx: { px: 2, pt: 1 } }, /* @__PURE__ */ React10.createElement(ErrorBanner, { error: chat.error, onDismiss: () => {
          } })),
          /* @__PURE__ */ React10.createElement(
            Box7,
            {
              ref: messagesContainerRef,
              sx: {
                flex: 1,
                overflowY: "auto",
                minHeight: 0
              }
            },
            messages.length === 0 ? /* @__PURE__ */ React10.createElement(
              PersonaHomepage,
              {
                personas,
                loading: personasLoading,
                error: personasError,
                selectedId: personaId,
                onSelect: handlePersonaChange
              }
            ) : /* @__PURE__ */ React10.createElement(
              MessageList,
              {
                messages,
                isStreaming,
                onFeedback: chat.submitFeedback
              }
            ),
            /* @__PURE__ */ React10.createElement("div", { ref: messagesEndRef })
          ),
          /* @__PURE__ */ React10.createElement(
            Box7,
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
            /* @__PURE__ */ React10.createElement(
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
            isStreaming ? /* @__PURE__ */ React10.createElement(Tooltip2, { title: "Stop" }, /* @__PURE__ */ React10.createElement(IconButton3, { color: "error", onClick: chat.stopGeneration }, /* @__PURE__ */ React10.createElement(StopIcon, null))) : /* @__PURE__ */ React10.createElement(Tooltip2, { title: "Send" }, /* @__PURE__ */ React10.createElement(
              IconButton3,
              {
                color: "primary",
                onClick: handleSend,
                disabled: !input.trim() || !keyVal.token
              },
              /* @__PURE__ */ React10.createElement(SendIcon, null)
            ))
          ),
          statusParts.length > 0 && /* @__PURE__ */ React10.createElement(Box7, { sx: { px: 2, pb: 1 } }, /* @__PURE__ */ React10.createElement(Typography8, { variant: "caption", color: "text.secondary" }, statusParts.join(" \xB7 ")))
        )
      ), /* @__PURE__ */ React10.createElement(
        Box7,
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
        /* @__PURE__ */ React10.createElement(SourcesPanel, { citations: chat.citations }),
        /* @__PURE__ */ React10.createElement(Divider2, null),
        /* @__PURE__ */ React10.createElement(
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
import React11 from "react";
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
    icon: /* @__PURE__ */ React11.createElement(ChatIcon2, null),
    loader: async () => {
      const { ChatPage: ChatPage2 } = await Promise.resolve().then(() => (init_ChatPage(), ChatPage_exports));
      return /* @__PURE__ */ React11.createElement(ChatPage2, null);
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
