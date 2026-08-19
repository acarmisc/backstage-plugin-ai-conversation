import { useState, useCallback, useRef, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { liteLlmChatApiRef, LiteLlmChatApi } from '../api';
import { computeRegenerateTarget, computeEditTarget } from './chatTruncation';
import { fromPersisted } from './threadPersistence';
import type {
  Thread,
  ChatMessage,
  ChatStreamChunk,
  Citation,
  KeySpend,
  ThreadExport,
  ReasoningEffort,
} from '../types';

const THREAD_EXPORT_VERSION = 1 as const;

const STORAGE_PREFIX = 'litellm-chat:threads';

function loadThreads(userId: string): Thread[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${userId}`);
    return raw ? (JSON.parse(raw) as Thread[]) : [];
  } catch {
    return [];
  }
}

function saveThreads(userId: string, threads: Thread[]) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}:${userId}`, JSON.stringify(threads));
  } catch {
    // quota or disabled — ignore
  }
}

function genId(): string {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function findQuestionFor(messages: ChatMessage[], messageId: string): ChatMessage | undefined {
  const idx = messages.findIndex(m => m.id === messageId);
  if (idx <= 0) return undefined;
  return messages[idx - 1];
}

const SAVE_DEBOUNCE_MS = 400;

export interface UseChatOptions {
  userId: string;
  model: string;
  vectorStoreIds: string[];
  personaId: string;
  customSystemPrompt: string;
  toneId: string;
  focusId: string;
  verbosityId: string;
  reasoningEffort: ReasoningEffort | '';
  keyAlias: string;
  keyToken: string;
  topK?: number;
  webSearch?: boolean;
  /** Mirrors `litellm.chat.persistence.enabled` (see config.d.ts). When
   * true, threads are synced to the backend in addition to localStorage —
   * on enable, the backend's thread list replaces local state (server is
   * authoritative once persistence is on). When false (default), behavior
   * is unchanged from client-side-only threads. */
  persistenceEnabled?: boolean;
}

export interface UseChatResult {
  threads: Thread[];
  activeThread: Thread | null;
  newThread: () => void;
  selectThread: (id: string) => void;
  deleteThread: (id: string) => void;
  sendMessage: (
    text: string,
    attachedUrl?: { url: string; title: string },
    compareModelsOverride?: string[],
  ) => void;
  regenerateFrom: (messageId: string) => void;
  editAndResend: (messageId: string, newContent: string) => void;
  stopGeneration: () => void;
  submitFeedback: (messageId: string, vote: 'up' | 'down') => void;
  togglePin: (id: string) => void;
  exportThread: (id: string) => void;
  importThread: (file: File) => Promise<void>;
  setCompareMode: (enabled: boolean, models?: string[]) => void;
  isStreaming: boolean;
  /** IDs of assistant messages currently receiving tokens — in compare
   * mode several are streaming at once, one per model column. */
  streamingMessageIds: Set<string>;
  error: string | null;
  citations: Citation[];
  keySpend: KeySpend | null;
}

export function useChat(opts: UseChatOptions): UseChatResult {
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
    persistenceEnabled,
  } = opts;
  const api = useApi(liteLlmChatApiRef) as InstanceType<typeof LiteLlmChatApi>;

  const [threads, setThreads] = useState<Thread[]>(() => loadThreads(userId));
  const [activeId, setActiveId] = useState<string | null>(
    () => threads[0]?.id ?? null,
  );
  const [streamingIds, setStreamingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [keySpend, setKeySpend] = useState<KeySpend | null>(null);
  const isStreaming = streamingIds.size > 0;

  // Keyed by assistant message id rather than one global controller — in
  // compare mode several models stream in parallel into different
  // messages, each independently abortable.
  const abortMapRef = useRef<Map<string, AbortController>>(new Map());

  // Debounce localStorage writes — `threads` changes on every streamed
  // token, and writing the full (growing) history to localStorage on each
  // one is a synchronous, main-thread-blocking JSON.stringify per token.
  const threadsRef = useRef<Thread[]>(threads);
  threadsRef.current = threads;
  const activeIdRef = useRef<string | null>(activeId);
  activeIdRef.current = activeId;
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Syncs the active thread to the backend when persistence is enabled.
  // Only the active thread, not the whole list — it's the one that changes
  // on every streamed token, while other threads change only at specific
  // mutation points (create/delete/pin/import), each of which syncs itself
  // directly (see newThread/deleteThread/togglePin/importThread below).
  // Best-effort: a sync failure degrades to localStorage-only for that
  // thread rather than surfacing an error mid-stream.
  const syncActiveThreadToBackend = useCallback(() => {
    if (!persistenceEnabled) return;
    const active = threadsRef.current.find(t => t.id === activeIdRef.current);
    if (active) api.saveThread(active).catch(() => {});
  }, [persistenceEnabled, api]);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveThreads(userId, threadsRef.current);
      syncActiveThreadToBackend();
    }, SAVE_DEBOUNCE_MS);
  }, [userId, threads, syncActiveThreadToBackend]);

  // Flush any pending debounced write on unmount or tab close so a save
  // scheduled just before either doesn't get lost.
  useEffect(() => {
    const flush = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      saveThreads(userId, threadsRef.current);
      syncActiveThreadToBackend();
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, [userId, syncActiveThreadToBackend]);

  // When persistence is enabled, the backend's thread list is authoritative
  // — load it once and replace whatever localStorage had (which may be
  // stale or from before persistence was turned on). A fetch failure
  // degrades to the localStorage-loaded threads already in state rather
  // than clearing the sidebar.
  useEffect(() => {
    if (!persistenceEnabled) return;
    let cancelled = false;
    api
      .listThreads()
      .then(persisted => {
        if (cancelled) return;
        setThreads(persisted.map(fromPersisted));
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistenceEnabled]);

  const activeThread = threads.find(t => t.id === activeId) ?? null;

  // Auto-create a ready-to-use thread when a key is available and no thread
  // is active — so the user can start typing immediately without clicking
  // "New chat". Fires on key generation, key selection, or after all threads
  // are deleted.
  useEffect(() => {
    if (!keyToken || activeId) return;
    const thread: Thread = {
      id: genId(),
      title: 'New chat',
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
      lastTurnUsage: null,
    };
    setThreads(prev => [thread, ...prev]);
    setActiveId(thread.id);
    if (persistenceEnabled) api.saveThread(thread).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyToken, activeId]);

  const newThread = useCallback(() => {
    const thread: Thread = {
      id: genId(),
      title: 'New chat',
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
      lastTurnUsage: null,
    };
    setThreads(prev => [thread, ...prev]);
    setActiveId(thread.id);
    setError(null);
    setCitations([]);
    setKeySpend(null);
    if (persistenceEnabled) api.saveThread(thread).catch(() => {});
  }, [
    model,
    vectorStoreIds,
    personaId,
    customSystemPrompt,
    keyAlias,
    keyToken,
    persistenceEnabled,
    api,
  ]);

  const selectThread = useCallback((id: string) => {
    setActiveId(id);
    setError(null);
    setCitations([]);
    setKeySpend(null);
  }, []);

  const deleteThread = useCallback(
    (id: string) => {
      const thread = threads.find(t => t.id === id);
      const remaining = threads.filter(t => t.id !== id);
      setThreads(remaining);
      if (activeId === id) {
        setActiveId(remaining[0]?.id ?? null);
      }
      // Best-effort key cleanup — fire and forget.
      if (thread?.keyToken) {
        api.deleteChatKey(thread.keyToken).catch(() => {});
      }
      if (persistenceEnabled) api.deleteThread(id).catch(() => {});
    },
    [activeId, threads, api, persistenceEnabled],
  );

  const stopGeneration = useCallback(() => {
    abortMapRef.current.forEach(controller => controller.abort());
    abortMapRef.current.clear();
    setStreamingIds(new Set());
  }, []);

  // Streams one model's reply into the assistant message `assistantMsgId`.
  // Shared by single-send (one call) and compare mode (one call per model,
  // running concurrently) — each call owns its own AbortController and its
  // own entry in streamingIds, so columns finish independently.
  const startStream = useCallback(
    (
      threadId: string,
      assistantMsgId: string,
      reqMessages: ChatMessage[],
      reqModel: string,
      attachedUrl: { url: string; title: string } | undefined,
      onSettled: () => void,
    ) => {
      setStreamingIds(prev => new Set(prev).add(assistantMsgId));

      const controller = api.chatStream(
        {
          model: reqModel,
          messages: reqMessages,
          thread_id: threadId,
          vector_store_ids: vectorStoreIds.length ? vectorStoreIds : undefined,
          persona_id: personaId || undefined,
          custom_system_prompt: customSystemPrompt || undefined,
          tone_id: toneId || undefined,
          focus_id: focusId || undefined,
          verbosity_id: verbosityId || undefined,
          reasoning_effort: reasoningEffort || undefined,
          context_url: attachedUrl?.url,
          web_search: webSearch || undefined,
          top_k: topK,
          user_key: keyToken,
        },
        (chunk: ChatStreamChunk) => {
          if (chunk.error) {
            setError(chunk.error);
            return;
          }
          if (chunk.search_results) {
            setCitations(
              chunk.search_results.map(r => ({
                filename: r.filename,
                score: r.score,
                snippet: r.text,
                source: r.source,
                url: r.url,
              })),
            );
          }
          if (chunk.usage) {
            const usage = chunk.usage;
            setThreads(prev =>
              prev.map(t =>
                t.id === threadId
                  ? {
                      ...t,
                      lastTurnUsage: usage,
                      totalTokens: t.totalTokens + usage.total_tokens,
                    }
                  : t,
              ),
            );
          }
          if (chunk.delta) {
            setThreads(prev =>
              prev.map(t => {
                if (t.id !== threadId) return t;
                const msgs = t.messages.map(m =>
                  m.id === assistantMsgId ? { ...m, content: m.content + chunk.delta } : m,
                );
                return { ...t, messages: msgs, updatedAt: Date.now() };
              }),
            );
          }
        },
        () => {
          abortMapRef.current.delete(assistantMsgId);
          setStreamingIds(prev => {
            const next = new Set(prev);
            next.delete(assistantMsgId);
            return next;
          });
          onSettled();
        },
        (err: Error) => {
          setError(err.message);
          abortMapRef.current.delete(assistantMsgId);
          setStreamingIds(prev => {
            const next = new Set(prev);
            next.delete(assistantMsgId);
            return next;
          });
          onSettled();
        },
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
      webSearch,
    ],
  );

  // Shared core for sendMessage/regenerateFrom/editAndResend: appends a user
  // message + assistant placeholder onto `baseMessages` (not necessarily the
  // thread's current messages — the two callers above pass a truncated
  // slice) and streams into it. Any in-flight generation is aborted first so
  // regenerating never races the previous response's tokens into the thread.
  const runSend = useCallback(
    (text: string, baseMessages: ChatMessage[], attachedUrl?: { url: string; title: string }) => {
      if (!text.trim() || !activeThread || !keyToken) return;

      stopGeneration();
      setError(null);
      setCitations([]);

      const turnId = genId();
      const userMsg: ChatMessage = { id: genId(), role: 'user', content: text, attachedUrl, turnId };
      const assistantMsg: ChatMessage = { id: genId(), role: 'assistant', content: '', turnId };

      const threadId = activeThread.id;
      const updatedMessages = [...baseMessages, userMsg, assistantMsg];
      const currentKeyAlias = keyAlias;

      setThreads(prev =>
        prev.map(t =>
          t.id === threadId
            ? {
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
                reasoningEffort: reasoningEffort || undefined,
                keyAlias,
                keyToken,
                webSearch,
                mode: 'single',
                updatedAt: Date.now(),
              }
            : t,
        ),
      );

      const reqMessages = updatedMessages.slice(0, -1);
      startStream(threadId, assistantMsg.id, reqMessages, model, attachedUrl, () => {
        if (currentKeyAlias) {
          api.getKeySpend(currentKeyAlias).then(setKeySpend).catch(() => {});
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
      stopGeneration,
    ],
  );

  // Compare mode: sends the same prompt to every model in `models` in
  // parallel, each into its own assistant message sharing one turnId so the
  // UI can render them as side-by-side columns.
  const runCompareSend = useCallback(
    (
      text: string,
      baseMessages: ChatMessage[],
      models: string[],
      attachedUrl?: { url: string; title: string },
    ) => {
      if (!text.trim() || !activeThread || !keyToken || models.length === 0) return;

      stopGeneration();
      setError(null);
      setCitations([]);

      const turnId = genId();
      const userMsg: ChatMessage = { id: genId(), role: 'user', content: text, attachedUrl, turnId };
      const assistantMsgs: ChatMessage[] = models.map(m => ({
        id: genId(),
        role: 'assistant',
        content: '',
        turnId,
        compareModel: m,
      }));

      const threadId = activeThread.id;
      const updatedMessages = [...baseMessages, userMsg, ...assistantMsgs];
      const currentKeyAlias = keyAlias;
      const reqMessagesBase = [...baseMessages, userMsg];

      setThreads(prev =>
        prev.map(t =>
          t.id === threadId
            ? {
                ...t,
                messages: updatedMessages,
                title: t.messages.length === 0 ? text.slice(0, 40) : t.title,
                vectorStoreIds,
                personaId,
                customSystemPrompt,
                toneId,
                focusId,
                verbosityId,
                reasoningEffort: reasoningEffort || undefined,
                keyAlias,
                keyToken,
                webSearch,
                mode: 'compare',
                compareModels: models,
                updatedAt: Date.now(),
              }
            : t,
        ),
      );

      assistantMsgs.forEach(am => {
        startStream(threadId, am.id, reqMessagesBase, am.compareModel as string, attachedUrl, () => {
          if (currentKeyAlias) {
            api.getKeySpend(currentKeyAlias).then(setKeySpend).catch(() => {});
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
      stopGeneration,
    ],
  );

  const sendMessage = useCallback(
    (
      text: string,
      attachedUrl?: { url: string; title: string },
      compareModelsOverride?: string[],
    ) => {
      if (!activeThread) return;
      const models =
        compareModelsOverride ??
        (activeThread.mode === 'compare' ? activeThread.compareModels : undefined);
      if (models?.length) {
        runCompareSend(text, activeThread.messages, models, attachedUrl);
      } else {
        runSend(text, activeThread.messages, attachedUrl);
      }
    },
    [activeThread, runSend, runCompareSend],
  );

  // Re-asks the question behind `messageId` and streams a fresh reply (all
  // columns, if the target belongs to a compare-mode turn). Truncates
  // through the target (exclusive if it's an assistant reply being
  // regenerated — that reply and anything after it is dropped and
  // reproduced fresh; inclusive if it's a user message — that message and
  // its old reply are dropped and re-sent).
  const regenerateFrom = useCallback(
    (messageId: string) => {
      if (!activeThread) return;
      const target = computeRegenerateTarget(activeThread.messages, messageId);
      if (!target) return;
      const compareModels = activeThread.compareModels;
      const isCompare =
        activeThread.mode === 'compare' && !!compareModels?.length && target.isCompareEligible;

      if (isCompare) {
        runCompareSend(target.text, target.baseMessages, compareModels!);
      } else {
        runSend(target.text, target.baseMessages);
      }
    },
    [activeThread, runSend, runCompareSend],
  );

  // Replaces a past user message with `newContent` and re-sends it, dropping
  // that message and everything after it — same truncate-and-resend
  // mechanics as regenerateFrom, just with edited text instead of the
  // original.
  const editAndResend = useCallback(
    (messageId: string, newContent: string) => {
      if (!activeThread) return;
      const target = computeEditTarget(activeThread.messages, messageId);
      if (!target) return;
      if (activeThread.mode === 'compare' && activeThread.compareModels?.length) {
        runCompareSend(newContent, target.baseMessages, activeThread.compareModels);
      } else {
        runSend(newContent, target.baseMessages);
      }
    },
    [activeThread, runSend, runCompareSend],
  );

  const setCompareMode = useCallback(
    (enabled: boolean, models?: string[]) => {
      if (!activeThread) return;
      const threadId = activeThread.id;
      setThreads(prev =>
        prev.map(t =>
          t.id === threadId
            ? {
                ...t,
                mode: enabled ? 'compare' : 'single',
                compareModels: enabled ? models ?? t.compareModels ?? [] : t.compareModels,
              }
            : t,
        ),
      );
    },
    [activeThread],
  );

  const togglePin = useCallback(
    (id: string) => {
      // Computed from the ref (not the `prev` inside setThreads' updater,
      // which React may not invoke synchronously) so the value handed to
      // saveThread below is available right after this call, not on some
      // later render.
      const current = threadsRef.current.find(t => t.id === id);
      if (!current) return;
      const toggled: Thread = { ...current, pinned: !current.pinned };
      setThreads(prev => prev.map(t => (t.id === id ? toggled : t)));
      if (persistenceEnabled) api.saveThread(toggled).catch(() => {});
    },
    [persistenceEnabled, api],
  );

  const exportThread = useCallback(
    (id: string) => {
      const thread = threads.find(t => t.id === id);
      if (!thread) return;
      const { keyToken: _keyToken, keyAlias: _keyAlias, ...portable } = thread;
      const payload: ThreadExport = { version: THREAD_EXPORT_VERSION, thread: portable };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${thread.title.replace(/[^\w-]+/g, '_').slice(0, 60) || 'thread'}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    [threads],
  );

  const importThread = useCallback(async (file: File) => {
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Not valid JSON');
    }
    const payload = parsed as { version?: unknown; thread?: Partial<Thread> };
    if (
      payload?.version !== THREAD_EXPORT_VERSION ||
      !payload.thread ||
      typeof payload.thread.id !== 'string' ||
      !Array.isArray(payload.thread.messages)
    ) {
      throw new Error('Unrecognized thread export format');
    }
    const src = payload.thread;
    const imported: Thread = {
      id: genId(),
      title: typeof src.title === 'string' ? src.title : 'Imported chat',
      messages: src.messages as ChatMessage[],
      model: typeof src.model === 'string' ? src.model : '',
      vectorStoreIds: Array.isArray(src.vectorStoreIds) ? src.vectorStoreIds : [],
      personaId: typeof src.personaId === 'string' ? src.personaId : '',
      customSystemPrompt:
        typeof src.customSystemPrompt === 'string' ? src.customSystemPrompt : '',
      keyAlias: '',
      keyToken: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalTokens: typeof src.totalTokens === 'number' ? src.totalTokens : 0,
      lastTurnUsage: null,
      pinned: false,
    };
    setThreads(prev => [imported, ...prev]);
    setActiveId(imported.id);
    if (persistenceEnabled) api.saveThread(imported).catch(() => {});
  }, [persistenceEnabled, api]);

  const submitFeedback = useCallback(
    (messageId: string, vote: 'up' | 'down') => {
      if (!activeThread) return;
      const message = activeThread.messages.find(m => m.id === messageId);
      if (!message) return;
      const question = findQuestionFor(activeThread.messages, messageId);

      const threadId = activeThread.id;
      setThreads(prev =>
        prev.map(t =>
          t.id !== threadId
            ? t
            : {
                ...t,
                messages: t.messages.map(m =>
                  m.id === messageId ? { ...m, feedback: vote } : m,
                ),
              },
        ),
      );

      api
        .sendFeedback({
          threadId,
          messageId,
          vote,
          question: question?.content ?? '',
          answer: message.content,
          model: activeThread.model,
          personaId: activeThread.personaId || undefined,
          vectorStoreIds: activeThread.vectorStoreIds,
          toneId: activeThread.toneId || undefined,
          focusId: activeThread.focusId || undefined,
          verbosityId: activeThread.verbosityId || undefined,
        })
        .catch((err: Error) => setError(err.message));
    },
    [activeThread, api],
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
    keySpend,
  };
}
