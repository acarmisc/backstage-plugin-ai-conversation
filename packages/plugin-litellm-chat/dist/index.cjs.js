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
var import_core_plugin_api, liteLlmChatApiRef, BASE_PATH, LiteLlmChatApi;
var init_api = __esm({
  "src/api.ts"() {
    "use strict";
    import_core_plugin_api = require("@backstage/core-plugin-api");
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
    };
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
function useChat(opts) {
  const { userId, model, vectorStoreIds, keyAlias, keyToken, topK } = opts;
  const api = (0, import_core_plugin_api2.useApi)(liteLlmChatApiRef);
  const [threads, setThreads] = (0, import_react.useState)(() => loadThreads(userId));
  const [activeId, setActiveId] = (0, import_react.useState)(
    () => threads[0]?.id ?? null
  );
  const [isStreaming, setIsStreaming] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const [citations, setCitations] = (0, import_react.useState)([]);
  const [keySpend, setKeySpend] = (0, import_react.useState)(null);
  const abortRef = (0, import_react.useRef)(null);
  const threadsRef = (0, import_react.useRef)(threads);
  threadsRef.current = threads;
  const saveTimeoutRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveThreads(userId, threadsRef.current);
    }, SAVE_DEBOUNCE_MS);
  }, [userId, threads]);
  (0, import_react.useEffect)(() => {
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
  const newThread = (0, import_react.useCallback)(() => {
    const thread = {
      id: genId(),
      title: "New chat",
      messages: [],
      model,
      vectorStoreIds,
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
  }, [model, vectorStoreIds, keyAlias, keyToken]);
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
    },
    [activeId, threads, api]
  );
  const stopGeneration = (0, import_react.useCallback)(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);
  const sendMessage = (0, import_react.useCallback)(
    (text) => {
      if (!text.trim() || !activeThread || !keyToken) return;
      setError(null);
      setCitations([]);
      const userMsg = { role: "user", content: text };
      const assistantMsg = { role: "assistant", content: "" };
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
    [activeThread, api, keyToken, model, vectorStoreIds, keyAlias, topK]
  );
  return {
    threads,
    activeThread,
    newThread,
    selectThread,
    deleteThread,
    sendMessage,
    stopGeneration,
    isStreaming,
    error,
    citations,
    keySpend
  };
}
var import_react, import_core_plugin_api2, STORAGE_PREFIX, SAVE_DEBOUNCE_MS;
var init_useChat = __esm({
  "src/hooks/useChat.ts"() {
    "use strict";
    import_react = require("react");
    import_core_plugin_api2 = require("@backstage/core-plugin-api");
    init_api();
    STORAGE_PREFIX = "litellm-chat:threads";
    SAVE_DEBOUNCE_MS = 400;
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

// src/components/VectorStorePicker.tsx
var import_react3, import_material2, import_CheckBoxOutlineBlank, import_CheckBox, import_core_plugin_api4, VectorStorePicker;
var init_VectorStorePicker = __esm({
  "src/components/VectorStorePicker.tsx"() {
    "use strict";
    import_react3 = __toESM(require("react"));
    import_material2 = require("@mui/material");
    import_CheckBoxOutlineBlank = __toESM(require("@mui/icons-material/CheckBoxOutlineBlank"));
    import_CheckBox = __toESM(require("@mui/icons-material/CheckBox"));
    import_core_plugin_api4 = require("@backstage/core-plugin-api");
    init_api();
    VectorStorePicker = ({
      value,
      onChange,
      defaultVectorStoreIds
    }) => {
      const chatApi = (0, import_core_plugin_api4.useApi)(liteLlmChatApiRef);
      const [stores, setStores] = (0, import_react3.useState)([]);
      const [loading, setLoading] = (0, import_react3.useState)(true);
      const [error, setError] = (0, import_react3.useState)(null);
      (0, import_react3.useEffect)(() => {
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
      return /* @__PURE__ */ import_react3.default.createElement(import_material2.Box, null, /* @__PURE__ */ import_react3.default.createElement(
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
          renderOption: (props, option, { selected: isSelected }) => /* @__PURE__ */ import_react3.default.createElement("li", { ...props, key: option.id }, /* @__PURE__ */ import_react3.default.createElement(
            import_material2.Checkbox,
            {
              icon: /* @__PURE__ */ import_react3.default.createElement(import_CheckBoxOutlineBlank.default, { fontSize: "small" }),
              checkedIcon: /* @__PURE__ */ import_react3.default.createElement(import_CheckBox.default, { fontSize: "small" }),
              checked: isSelected,
              size: "small",
              sx: { mr: 1, p: 0 }
            }
          ), option.name, " ", option.file_count != null ? `(${option.file_count})` : ""),
          renderTags: (tagValue, getTagProps) => tagValue.map((option, index) => /* @__PURE__ */ import_react3.default.createElement(
            import_material2.Chip,
            {
              ...getTagProps({ index }),
              key: option.id,
              size: "small",
              label: option.name
            }
          )),
          renderInput: (params) => /* @__PURE__ */ import_react3.default.createElement(
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
      ), error && /* @__PURE__ */ import_react3.default.createElement(import_material2.Typography, { variant: "caption", color: "error", sx: { display: "block", mt: 0.5 } }, error));
    };
  }
});

// src/components/KeyPicker.tsx
var import_react4, import_material3, import_VpnKey, import_Delete, import_core_plugin_api5, KeyPicker;
var init_KeyPicker = __esm({
  "src/components/KeyPicker.tsx"() {
    "use strict";
    import_react4 = __toESM(require("react"));
    import_material3 = require("@mui/material");
    import_VpnKey = __toESM(require("@mui/icons-material/VpnKey"));
    import_Delete = __toESM(require("@mui/icons-material/Delete"));
    import_core_plugin_api5 = require("@backstage/core-plugin-api");
    init_api();
    KeyPicker = ({ value, onChange, onDelete }) => {
      const chatApi = (0, import_core_plugin_api5.useApi)(liteLlmChatApiRef);
      const [loading, setLoading] = (0, import_react4.useState)(false);
      const [error, setError] = (0, import_react4.useState)(null);
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
        return /* @__PURE__ */ import_react4.default.createElement(import_material3.Box, { sx: { display: "flex", alignItems: "center", gap: 1, minWidth: 200 } }, /* @__PURE__ */ import_react4.default.createElement(import_VpnKey.default, { fontSize: "small", color: "success" }), /* @__PURE__ */ import_react4.default.createElement(import_material3.Typography, { variant: "body2", sx: { flex: 1, overflow: "hidden", textOverflow: "ellipsis" } }, value.alias || "chat key"), /* @__PURE__ */ import_react4.default.createElement(import_material3.Tooltip, { title: "Delete chat key" }, /* @__PURE__ */ import_react4.default.createElement(import_material3.IconButton, { edge: "end", size: "small", onClick: handleDelete }, /* @__PURE__ */ import_react4.default.createElement(import_Delete.default, { fontSize: "small" }))));
      }
      return /* @__PURE__ */ import_react4.default.createElement(import_material3.Box, { sx: { minWidth: 200 } }, /* @__PURE__ */ import_react4.default.createElement(
        import_material3.Button,
        {
          size: "small",
          variant: "outlined",
          startIcon: loading ? /* @__PURE__ */ import_react4.default.createElement(import_material3.CircularProgress, { size: 16 }) : /* @__PURE__ */ import_react4.default.createElement(import_VpnKey.default, null),
          onClick: handleGenerate,
          disabled: loading
        },
        loading ? "Minting\u2026" : "Generate chat key"
      ), error && /* @__PURE__ */ import_react4.default.createElement(import_material3.Typography, { variant: "caption", color: "error", sx: { display: "block", mt: 0.5 } }, error));
    };
  }
});

// src/components/MessageList.tsx
var import_react5, import_material4, import_react_markdown, import_remark_gfm, blink, MessageList;
var init_MessageList = __esm({
  "src/components/MessageList.tsx"() {
    "use strict";
    import_react5 = __toESM(require("react"));
    import_material4 = require("@mui/material");
    import_react_markdown = __toESM(require("react-markdown"));
    import_remark_gfm = __toESM(require("remark-gfm"));
    blink = {
      "@keyframes blink": {
        "0%, 50%": { opacity: 1 },
        "51%, 100%": { opacity: 0 }
      }
    };
    MessageList = ({
      messages,
      isStreaming
    }) => {
      return /* @__PURE__ */ import_react5.default.createElement(
        import_material4.Box,
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
        messages.length === 0 && /* @__PURE__ */ import_react5.default.createElement(
          import_material4.Box,
          {
            sx: {
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }
          },
          /* @__PURE__ */ import_react5.default.createElement(import_material4.Typography, { color: "text.secondary" }, "Start a conversation\u2026")
        ),
        messages.map((msg, i) => {
          const isUser = msg.role === "user";
          const isLast = i === messages.length - 1;
          return /* @__PURE__ */ import_react5.default.createElement(
            import_material4.Box,
            {
              key: i,
              sx: {
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "80%"
              }
            },
            /* @__PURE__ */ import_react5.default.createElement(
              import_material4.Box,
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
              isUser ? /* @__PURE__ */ import_react5.default.createElement(import_material4.Box, { sx: { whiteSpace: "pre-wrap" } }, msg.content) : msg.content ? /* @__PURE__ */ import_react5.default.createElement(import_react_markdown.default, { remarkPlugins: [import_remark_gfm.default] }, msg.content) : isStreaming && isLast ? /* @__PURE__ */ import_react5.default.createElement(
                import_material4.Box,
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
            )
          );
        })
      );
    };
  }
});

// src/components/ErrorBanner.tsx
var import_react6, import_material5, ErrorBanner;
var init_ErrorBanner = __esm({
  "src/components/ErrorBanner.tsx"() {
    "use strict";
    import_react6 = __toESM(require("react"));
    import_material5 = require("@mui/material");
    ErrorBanner = ({ error, onDismiss }) => {
      if (!error) return null;
      return /* @__PURE__ */ import_react6.default.createElement(import_material5.Alert, { severity: "error", onClose: onDismiss, sx: { mb: 1 } }, /* @__PURE__ */ import_react6.default.createElement(import_material5.AlertTitle, null, "Chat error"), error);
    };
  }
});

// src/components/SourcesPanel.tsx
var import_react7, import_material6, SourcesPanel;
var init_SourcesPanel = __esm({
  "src/components/SourcesPanel.tsx"() {
    "use strict";
    import_react7 = __toESM(require("react"));
    import_material6 = require("@mui/material");
    SourcesPanel = ({ citations }) => {
      return /* @__PURE__ */ import_react7.default.createElement(import_material6.Box, { sx: { p: 1.5 } }, /* @__PURE__ */ import_react7.default.createElement(import_material6.Typography, { variant: "overline", color: "text.secondary" }, "Sources"), citations.length === 0 ? /* @__PURE__ */ import_react7.default.createElement(import_material6.Typography, { variant: "body2", color: "text.secondary", sx: { mt: 0.5 } }, "No sources for the latest reply yet.") : citations.map((c, i) => /* @__PURE__ */ import_react7.default.createElement(import_material6.Box, { key: i, sx: { mt: 1.5 } }, /* @__PURE__ */ import_react7.default.createElement(import_material6.Box, { sx: { display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ import_react7.default.createElement(import_material6.Typography, { variant: "body2", fontWeight: 500 }, c.filename), /* @__PURE__ */ import_react7.default.createElement(import_material6.Chip, { size: "small", label: c.score.toFixed(3), color: "primary", variant: "outlined" })), /* @__PURE__ */ import_react7.default.createElement(
        import_material6.Typography,
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
var import_react8, import_material7, Stat, UsagePanel;
var init_UsagePanel = __esm({
  "src/components/UsagePanel.tsx"() {
    "use strict";
    import_react8 = __toESM(require("react"));
    import_material7 = require("@mui/material");
    Stat = ({ label, value }) => /* @__PURE__ */ import_react8.default.createElement(import_material7.Box, { sx: { display: "flex", justifyContent: "space-between", py: 0.25 } }, /* @__PURE__ */ import_react8.default.createElement(import_material7.Typography, { variant: "body2", color: "text.secondary" }, label), /* @__PURE__ */ import_react8.default.createElement(import_material7.Typography, { variant: "body2", fontWeight: 500 }, value));
    UsagePanel = ({
      lastTurnUsage,
      totalTokens,
      keySpend
    }) => {
      const budgetPct = keySpend?.max_budget && keySpend.max_budget > 0 ? Math.min(100, keySpend.spend / keySpend.max_budget * 100) : null;
      return /* @__PURE__ */ import_react8.default.createElement(import_material7.Box, { sx: { p: 1.5 } }, /* @__PURE__ */ import_react8.default.createElement(import_material7.Typography, { variant: "overline", color: "text.secondary" }, "Usage"), !lastTurnUsage && !keySpend ? /* @__PURE__ */ import_react8.default.createElement(import_material7.Typography, { variant: "body2", color: "text.secondary", sx: { mt: 0.5 } }, "Send a message to see token and budget usage.") : /* @__PURE__ */ import_react8.default.createElement(import_material7.Box, { sx: { mt: 0.5 } }, lastTurnUsage && /* @__PURE__ */ import_react8.default.createElement(import_react8.default.Fragment, null, /* @__PURE__ */ import_react8.default.createElement(Stat, { label: "This turn", value: `${lastTurnUsage.total_tokens.toLocaleString()} tokens` }), /* @__PURE__ */ import_react8.default.createElement(Stat, { label: "Prompt / completion", value: `${lastTurnUsage.prompt_tokens.toLocaleString()} / ${lastTurnUsage.completion_tokens.toLocaleString()}` }), /* @__PURE__ */ import_react8.default.createElement(Stat, { label: "Session total", value: `${totalTokens.toLocaleString()} tokens` })), keySpend && /* @__PURE__ */ import_react8.default.createElement(import_react8.default.Fragment, null, /* @__PURE__ */ import_react8.default.createElement(import_material7.Divider, { sx: { my: 1 } }), /* @__PURE__ */ import_react8.default.createElement(Stat, { label: "Spent", value: formatUsd(keySpend.spend) }), keySpend.max_budget != null && /* @__PURE__ */ import_react8.default.createElement(import_react8.default.Fragment, null, /* @__PURE__ */ import_react8.default.createElement(Stat, { label: "Budget", value: `${formatUsd(keySpend.spend)} / ${formatUsd(keySpend.max_budget)}` }), /* @__PURE__ */ import_react8.default.createElement(
        import_material7.LinearProgress,
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
var import_react9, import_material8, import_Add, import_Delete2, import_Settings, import_ExpandMore, import_Chat, import_Send, import_Stop, import_core_plugin_api6, SIDEBAR_WIDTH, RIGHT_RAIL_WIDTH, CHAT_MAX_WIDTH, ChatPage;
var init_ChatPage = __esm({
  "src/components/ChatPage.tsx"() {
    "use strict";
    import_react9 = __toESM(require("react"));
    import_material8 = require("@mui/material");
    import_Add = __toESM(require("@mui/icons-material/Add"));
    import_Delete2 = __toESM(require("@mui/icons-material/Delete"));
    import_Settings = __toESM(require("@mui/icons-material/Settings"));
    import_ExpandMore = __toESM(require("@mui/icons-material/ExpandMore"));
    import_Chat = __toESM(require("@mui/icons-material/Chat"));
    import_Send = __toESM(require("@mui/icons-material/Send"));
    import_Stop = __toESM(require("@mui/icons-material/Stop"));
    import_core_plugin_api6 = require("@backstage/core-plugin-api");
    init_api();
    init_useChat();
    init_ModelPicker();
    init_VectorStorePicker();
    init_KeyPicker();
    init_MessageList();
    init_ErrorBanner();
    init_SourcesPanel();
    init_UsagePanel();
    SIDEBAR_WIDTH = 280;
    RIGHT_RAIL_WIDTH = 300;
    CHAT_MAX_WIDTH = 900;
    ChatPage = () => {
      const chatApi = (0, import_core_plugin_api6.useApi)(liteLlmChatApiRef);
      const identityApi = (0, import_core_plugin_api6.useApi)(import_core_plugin_api6.identityApiRef);
      const [userId, setUserId] = (0, import_react9.useState)("default");
      const [config, setConfig] = (0, import_react9.useState)({
        defaultModel: null,
        defaultVectorStoreIds: null,
        maxRequestBudget: null
      });
      const [model, setModel] = (0, import_react9.useState)("");
      const [vectorStoreIds, setVectorStoreIds] = (0, import_react9.useState)([]);
      const [keyVal, setKeyVal] = (0, import_react9.useState)({
        alias: "",
        token: ""
      });
      const [showSettings, setShowSettings] = (0, import_react9.useState)(true);
      const [input, setInput] = (0, import_react9.useState)("");
      const [configError, setConfigError] = (0, import_react9.useState)(null);
      const messagesEndRef = (0, import_react9.useRef)(null);
      const messagesContainerRef = (0, import_react9.useRef)(null);
      (0, import_react9.useEffect)(() => {
        chatApi.getChatConfig().then(setConfig).catch((err) => setConfigError(err.message ?? "Failed to reach the chat backend"));
        identityApi.getCredentials().then((c) => setUserId(c.token ? "oidc" : "default")).catch(() => {
        });
      }, [chatApi, identityApi]);
      const chat = useChat({
        userId,
        model,
        vectorStoreIds,
        keyAlias: keyVal.alias,
        keyToken: keyVal.token,
        topK: 5
      });
      const activeThreadId = chat.activeThread?.id ?? null;
      (0, import_react9.useEffect)(() => {
        if (!chat.activeThread) return;
        setModel(chat.activeThread.model);
        setVectorStoreIds(chat.activeThread.vectorStoreIds);
        setKeyVal({ alias: chat.activeThread.keyAlias, token: chat.activeThread.keyToken });
      }, [activeThreadId]);
      const messages = chat.activeThread?.messages ?? [];
      const isStreaming = chat.isStreaming;
      (0, import_react9.useEffect)(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [messages, isStreaming]);
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
      return /* @__PURE__ */ import_react9.default.createElement(import_material8.Box, { sx: { display: "flex", height: "100dvh", overflow: "hidden" } }, /* @__PURE__ */ import_react9.default.createElement(
        import_material8.Box,
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
        /* @__PURE__ */ import_react9.default.createElement(import_material8.Box, { sx: { flexShrink: 0 } }, /* @__PURE__ */ import_react9.default.createElement(
          import_material8.Box,
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
          /* @__PURE__ */ import_react9.default.createElement(import_Settings.default, { fontSize: "small", sx: { mr: 1 } }),
          /* @__PURE__ */ import_react9.default.createElement(import_material8.Typography, { variant: "overline", sx: { flex: 1 } }, "Settings"),
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
        ), /* @__PURE__ */ import_react9.default.createElement(import_material8.Collapse, { in: showSettings }, /* @__PURE__ */ import_react9.default.createElement(import_material8.Box, { sx: { p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 } }, configError && /* @__PURE__ */ import_react9.default.createElement(import_material8.Typography, { variant: "caption", color: "error" }, "Couldn't load chat defaults: ", configError), /* @__PURE__ */ import_react9.default.createElement(ModelPicker, { value: model, onChange: setModel, defaultModel: config.defaultModel }), /* @__PURE__ */ import_react9.default.createElement(
          VectorStorePicker,
          {
            value: vectorStoreIds,
            onChange: setVectorStoreIds,
            defaultVectorStoreIds: config.defaultVectorStoreIds
          }
        ), /* @__PURE__ */ import_react9.default.createElement(
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
        )))),
        /* @__PURE__ */ import_react9.default.createElement(import_material8.Divider, null),
        /* @__PURE__ */ import_react9.default.createElement(import_material8.Box, { sx: { p: 1.5 } }, /* @__PURE__ */ import_react9.default.createElement(
          import_material8.Button,
          {
            fullWidth: true,
            variant: "outlined",
            startIcon: /* @__PURE__ */ import_react9.default.createElement(import_Add.default, null),
            onClick: chat.newThread,
            size: "small"
          },
          "New chat"
        )),
        /* @__PURE__ */ import_react9.default.createElement(import_material8.Box, { sx: { flex: 1, overflowY: "auto", minHeight: 0 } }, /* @__PURE__ */ import_react9.default.createElement(import_material8.List, { dense: true }, chat.threads.map((t) => /* @__PURE__ */ import_react9.default.createElement(
          import_material8.ListItem,
          {
            key: t.id,
            disablePadding: true,
            secondaryAction: /* @__PURE__ */ import_react9.default.createElement(
              import_material8.IconButton,
              {
                edge: "end",
                size: "small",
                onClick: (e) => {
                  e.stopPropagation();
                  chat.deleteThread(t.id);
                }
              },
              /* @__PURE__ */ import_react9.default.createElement(import_Delete2.default, { fontSize: "small" })
            )
          },
          /* @__PURE__ */ import_react9.default.createElement(
            import_material8.ListItemButton,
            {
              selected: chat.activeThread?.id === t.id,
              onClick: () => chat.selectThread(t.id),
              sx: { pr: 6 }
            },
            /* @__PURE__ */ import_react9.default.createElement(
              import_material8.ListItemText,
              {
                primary: t.title,
                primaryTypographyProps: { noWrap: true, variant: "body2" },
                secondaryTypographyProps: { noWrap: true, variant: "caption" }
              }
            )
          )
        ))))
      ), /* @__PURE__ */ import_react9.default.createElement(
        import_material8.Box,
        {
          sx: {
            flex: 3,
            display: "flex",
            justifyContent: "center",
            overflow: "hidden"
          }
        },
        /* @__PURE__ */ import_react9.default.createElement(
          import_material8.Box,
          {
            sx: {
              width: "100%",
              maxWidth: CHAT_MAX_WIDTH,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }
          },
          /* @__PURE__ */ import_react9.default.createElement(
            import_material8.Box,
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
            /* @__PURE__ */ import_react9.default.createElement(import_Chat.default, { fontSize: "small", color: "action" }),
            /* @__PURE__ */ import_react9.default.createElement(import_material8.Typography, { variant: "subtitle2", noWrap: true, sx: { flex: 1 } }, chat.activeThread?.title ?? "AI Chat")
          ),
          chat.error && /* @__PURE__ */ import_react9.default.createElement(import_material8.Box, { sx: { px: 2, pt: 1 } }, /* @__PURE__ */ import_react9.default.createElement(ErrorBanner, { error: chat.error, onDismiss: () => {
          } })),
          /* @__PURE__ */ import_react9.default.createElement(
            import_material8.Box,
            {
              ref: messagesContainerRef,
              sx: {
                flex: 1,
                overflowY: "auto",
                minHeight: 0
              }
            },
            /* @__PURE__ */ import_react9.default.createElement(MessageList, { messages, isStreaming }),
            /* @__PURE__ */ import_react9.default.createElement("div", { ref: messagesEndRef })
          ),
          /* @__PURE__ */ import_react9.default.createElement(
            import_material8.Box,
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
            /* @__PURE__ */ import_react9.default.createElement(
              import_material8.InputBase,
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
            isStreaming ? /* @__PURE__ */ import_react9.default.createElement(import_material8.Tooltip, { title: "Stop" }, /* @__PURE__ */ import_react9.default.createElement(import_material8.IconButton, { color: "error", onClick: chat.stopGeneration }, /* @__PURE__ */ import_react9.default.createElement(import_Stop.default, null))) : /* @__PURE__ */ import_react9.default.createElement(import_material8.Tooltip, { title: "Send" }, /* @__PURE__ */ import_react9.default.createElement(
              import_material8.IconButton,
              {
                color: "primary",
                onClick: handleSend,
                disabled: !input.trim() || !keyVal.token
              },
              /* @__PURE__ */ import_react9.default.createElement(import_Send.default, null)
            ))
          ),
          statusParts.length > 0 && /* @__PURE__ */ import_react9.default.createElement(import_material8.Box, { sx: { px: 2, pb: 1 } }, /* @__PURE__ */ import_react9.default.createElement(import_material8.Typography, { variant: "caption", color: "text.secondary" }, statusParts.join(" \xB7 ")))
        )
      ), /* @__PURE__ */ import_react9.default.createElement(
        import_material8.Box,
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
        /* @__PURE__ */ import_react9.default.createElement(SourcesPanel, { citations: chat.citations }),
        /* @__PURE__ */ import_react9.default.createElement(import_material8.Divider, null),
        /* @__PURE__ */ import_react9.default.createElement(
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

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ChatPage: () => ChatPage,
  LiteLlmChatApi: () => LiteLlmChatApi,
  liteLlmChatApiRef: () => liteLlmChatApiRef,
  litellmChatPlugin: () => litellmChatPlugin
});
module.exports = __toCommonJS(index_exports);

// src/plugin.tsx
var import_react10 = __toESM(require("react"));
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
    icon: /* @__PURE__ */ import_react10.default.createElement(import_icons_material.Chat, null),
    loader: async () => {
      const { ChatPage: ChatPage2 } = await Promise.resolve().then(() => (init_ChatPage(), ChatPage_exports));
      return /* @__PURE__ */ import_react10.default.createElement(ChatPage2, null);
    }
  }
});
var litellmChatPlugin = (0, import_frontend_plugin_api.createFrontendPlugin)({
  pluginId: "litellm-chat",
  extensions: [liteLlmChatApi, chatPage]
});

// src/index.ts
init_ChatPage();
init_api();
//# sourceMappingURL=index.cjs.js.map
