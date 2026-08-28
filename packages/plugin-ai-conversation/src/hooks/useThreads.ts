import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import type { FetchApi } from '@backstage/core-plugin-api';
import { fetchApiRef } from '@backstage/core-plugin-api';
import { useChat as useAiSdkChat } from '@ai-sdk/react';
import type { FileUIPart } from 'ai';
import { aiConversationApiRef, AiConversationApi } from '../api';
import { computeRegenerateTarget, computeEditTarget } from './chatTruncation';
import { fromPersisted, migrateThreadMessages } from './threadPersistence';
import { createAiConversationTransport, type ChatRequestSettings } from './aiSdkTransport';
import { extractText } from './messageShape';
import { useCompareChat } from './useCompareChat';
import type {
  Thread,
  AiConversationUIMessage,
  Citation,
  KeySpend,
  ThreadExport,
  ReasoningEffort,
} from '../types';

/**
 * Drop-in replacement for the old `useChat` hook (HANDOFF-ai-sdk-migration.md
 * Phase 19) — same public shape (`UseChatResult` below, unchanged from the
 * pre-migration version) so `ChatPage.tsx` and everything under it keeps
 * working without modification. Only the streaming/state engine underneath
 * changed: `@ai-sdk/react`'s `useChat` (single mode) + `useCompareChat`
 * (compare mode, see that file) replace the old hand-rolled SSE reader,
 * abort-map, and truncate-and-resend logic.
 *
 * `Thread.messages` is `AiConversationUIMessage[]` (HANDOFF-ai-sdk-migration.md
 * Phase 20) — the SDK's own message shape, with `metadata.turnId`/
 * `metadata.compareModel` carrying what used to be top-level `ChatMessage`
 * fields. Legacy `ChatMessage[]`-shaped data (localStorage from before
 * this shipped, server-persisted rows, v1 thread exports) is migrated on
 * load — see `threadPersistence.ts`'s `migrateThreadMessages`.
 *
 * Regenerate/edit-resend deliberately do NOT use the SDK's native
 * `regenerate()`/`sendMessage({messageId})` truncation — this repo's exact
 * truncate-inclusive/exclusive rules (`chatTruncation.ts`, already unit
 * tested and behaviorally proven) are computed first, then applied via
 * `setMessages()` + a fresh `sendMessage()`. This trades a slightly less
 * "idiomatic" SDK usage for keeping full, known control over the one
 * behavior the migration doc calls out as needing exact parity, not just
 * approximate parity.
 *
 * NOT LIVE-VERIFIED: this file has been type-checked and unit-tested where
 * the logic is pure, but not run against a live LiteLLM backend or in a
 * browser (this environment has neither). Compare mode in particular is
 * the migration's own highest-risk item — smoke-test before trusting it.
 */

const THREAD_EXPORT_VERSION = 2 as const;

const STORAGE_PREFIX = 'ai-conversation:threads';

/** Threads written to localStorage before Phase 20 have flat
 * `ChatMessage[]`-shaped `messages` — migrate each one on load. See
 * `migrateThreadMessages`'s doc comment for why this is safe to do
 * per-thread without a version marker. */
function loadThreads(userId: string): Thread[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Thread & { messages: unknown }>;
    return parsed.map(t => ({ ...t, messages: migrateThreadMessages(t.messages) }));
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

/** Entries from `incoming` not already present (by id) in `prev` — shared by
 * every effect that merges a second source of threads (userId-keyed
 * localStorage, server persistence) into local state without clobbering or
 * duplicating anything already loaded. */
function newThreadsOnly(prev: Thread[], incoming: Thread[]): Thread[] {
  const existingIds = new Set(prev.map(t => t.id));
  return incoming.filter(t => !existingIds.has(t.id));
}

function findQuestionFor(
  messages: AiConversationUIMessage[],
  messageId: string,
): AiConversationUIMessage | undefined {
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
  persistenceEnabled?: boolean;
}

export interface UseChatResult {
  threads: Thread[];
  activeThread: Thread | null;
  newThread: (overrideKey?: { alias: string; token: string }) => void;
  selectThread: (id: string) => void;
  deleteThread: (id: string) => void;
  sendMessage: (
    text: string,
    attachedUrl?: { url: string; title: string },
    compareModelsOverride?: string[],
    files?: FileUIPart[],
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
  streamingMessageIds: Set<string>;
  error: string | null;
  citations: Citation[];
  keySpend: KeySpend | null;
}

export function useThreads(opts: UseChatOptions): UseChatResult {
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
  const api = useApi(aiConversationApiRef) as InstanceType<typeof AiConversationApi>;
  const fetchApi = useApi(fetchApiRef) as FetchApi;

  const [threads, setThreads] = useState<Thread[]>(() => loadThreads(userId));
  const [activeId, setActiveId] = useState<string | null>(() => threads[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [keySpend, setKeySpend] = useState<KeySpend | null>(null);

  // `userId` starts as the 'default' placeholder and only resolves to the
  // real identity (e.g. 'oidc') asynchronously, after this hook has already
  // mounted and loaded threads for the placeholder key. Without this, every
  // reload reads the wrong localStorage bucket and the sidebar looks empty
  // until a new message is sent (which saves — but never loads — under the
  // resolved key). Re-load once userId settles and merge in anything found,
  // rather than replacing state and risking dropping an in-flight thread.
  const loadedUserIdRef = useRef(userId);
  useEffect(() => {
    if (userId === loadedUserIdRef.current) return;
    loadedUserIdRef.current = userId;
    const stored = loadThreads(userId);
    if (stored.length === 0) return;
    setThreads(prev => {
      const fresh = newThreadsOnly(prev, stored);
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    setActiveId(prev => prev ?? stored[0]?.id ?? null);
  }, [userId]);

  const activeThread = threads.find(t => t.id === activeId) ?? null;
  const isCompareThread = activeThread?.mode === 'compare';

  // Latest request settings, read by the Transport's prepareSendMessagesRequest
  // on every send — see aiSdkTransport.ts for why this is a ref (settings
  // change on every render; the Transport instance must stay stable).
  const settingsRef = useRef<ChatRequestSettings>({
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
    threadId: activeThread?.id ?? '',
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
    threadId: activeThread?.id ?? '',
  };

  const transport = useMemo(
    () => createAiConversationTransport(fetchApi, () => settingsRef.current),
    [fetchApi],
  );

  // Single-mode engine — one instance, re-keyed by activeThread.id so the
  // SDK reinitializes its internal Chat when the user switches threads.
  const chat = useAiSdkChat<AiConversationUIMessage>({
    id: activeThread?.id ?? 'no-active-thread',
    messages: activeThread?.messages ?? [],
    transport,
    onData: dataPart => {
      if (!activeThread) return;
      if (dataPart.type === 'data-citations') {
        const results = dataPart.data as Citation[];
        setCitations(
          Array.isArray(results)
            ? results.map((r: any) => ({
                filename: r.filename,
                score: r.score,
                snippet: r.text ?? r.snippet,
                source: r.source,
                url: r.url,
              }))
            : [],
        );
      }
      if (dataPart.type === 'data-usage') {
        const usage = dataPart.data as { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        const threadId = activeThread.id;
        setThreads(prev =>
          prev.map(t =>
            t.id === threadId
              ? { ...t, lastTurnUsage: usage, totalTokens: t.totalTokens + usage.total_tokens }
              : t,
          ),
        );
      }
    },
    onError: err => setError(err.message),
    onFinish: () => {
      if (keyAlias) api.getKeySpend(keyAlias).then(setKeySpend).catch(() => {});
    },
  });

  const compareChat = useCompareChat({
    createTransport: forModel =>
      createAiConversationTransport(fetchApi, () => ({
        ...settingsRef.current,
        model: forModel,
      })),
    onFinishColumn: () => {
      if (keyAlias) api.getKeySpend(keyAlias).then(setKeySpend).catch(() => {});
    },
  });

  // Mirrors the live SDK engine's messages back into Thread.messages, so
  // the rest of the app (sidebar previews, persistence, export) has a
  // stable place to read from. Only one engine is "live" for the active
  // thread at a time, gated by thread.mode.
  useEffect(() => {
    if (!activeThread || isCompareThread) return;
    const threadId = activeThread.id;
    setThreads(prev =>
      prev.map(t => (t.id === threadId ? { ...t, messages: chat.messages, updatedAt: Date.now() } : t)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.messages, isCompareThread]);

  const compareTurnRef = useRef<{
    threadId: string;
    turnId: string;
    prefix: AiConversationUIMessage[];
  } | null>(null);

  useEffect(() => {
    if (!activeThread || !isCompareThread) return;
    const turn = compareTurnRef.current;
    if (!turn || turn.threadId !== activeThread.id || compareChat.columns.length === 0) return;
    const assistantMsgs: AiConversationUIMessage[] = compareChat.columns.map(col => {
      const last = col.messages[col.messages.length - 1];
      const base: AiConversationUIMessage = last ?? {
        id: genId(),
        role: 'assistant',
        parts: [],
      };
      return {
        ...base,
        metadata: { ...base.metadata, turnId: turn.turnId, compareModel: col.model },
      };
    });
    const threadId = activeThread.id;
    setThreads(prev =>
      prev.map(t =>
        t.id === threadId
          ? { ...t, messages: [...turn.prefix, ...assistantMsgs], updatedAt: Date.now() }
          : t,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareChat.columns, isCompareThread]);

  const isStreaming = isCompareThread
    ? compareChat.isStreaming
    : chat.status === 'submitted' || chat.status === 'streaming';
  const streamingMessageIds = useMemo(() => {
    if (isCompareThread) {
      return new Set(
        compareChat.columns
          .filter(c => c.status === 'submitted' || c.status === 'streaming')
          .map(c => c.messages[c.messages.length - 1]?.id)
          .filter((id): id is string => !!id),
      );
    }
    const last = chat.messages[chat.messages.length - 1];
    return isStreaming && last ? new Set([last.id]) : new Set<string>();
  }, [isCompareThread, compareChat.columns, chat.messages, isStreaming]);

  // --- Thread list persistence (localStorage + optional server sync) ---
  // Unchanged from the pre-migration implementation — this is orthogonal
  // to which streaming engine is active.

  const threadsRef = useRef<Thread[]>(threads);
  threadsRef.current = threads;
  const activeIdRef = useRef<string | null>(activeId);
  activeIdRef.current = activeId;
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    if (persistenceEnabled) {
      api
        .listThreads()
        .then(persisted => {
          if (cancelled) return;
          setThreads(prev => {
            const fresh = newThreadsOnly(prev, persisted.map(fromPersisted));
            return fresh.length ? [...fresh, ...prev] : prev;
          });
        })
        .catch(err => {
          if (!cancelled) setError(err.message);
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistenceEnabled]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyToken, activeId, persistenceEnabled, api]);

  const newThread = useCallback(
    // `overrideKey` lets a caller that just minted a key hand it in directly,
    // instead of relying on this callback's own `keyAlias`/`keyToken`
    // closure — which is stale immediately after an async mint (the caller
    // awaited chatApi.mintChatKey() and called setKeyVal(), but this
    // useCallback instance was still built from the pre-mint render). Baking
    // in a stale empty key here meant the "restore thread settings" effect
    // read it straight back onto keyVal on the next render, wiping out the
    // just-minted key before the second message could use it.
    (overrideKey?: { alias: string; token: string }) => {
      const thread: Thread = {
        id: genId(),
        title: 'New chat',
        messages: [],
        model,
        vectorStoreIds,
        personaId,
        customSystemPrompt,
        keyAlias: overrideKey?.alias ?? keyAlias,
        keyToken: overrideKey?.token ?? keyToken,
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
      compareChat.reset();
    },
    [model, vectorStoreIds, personaId, customSystemPrompt, keyAlias, keyToken, compareChat],
  );

  const selectThread = useCallback(
    (id: string) => {
      setActiveId(id);
      setError(null);
      setCitations([]);
      setKeySpend(null);
      compareChat.reset();
    },
    [compareChat],
  );

  const deleteThread = useCallback(
    (id: string) => {
      const thread = threads.find(t => t.id === id);
      const remaining = threads.filter(t => t.id !== id);
      setThreads(remaining);
      if (activeId === id) {
        setActiveId(remaining[0]?.id ?? null);
        compareChat.reset();
      }
      if (thread?.keyToken) {
        api.deleteChatKey(thread.keyToken).catch(() => {});
      }
      if (persistenceEnabled) api.deleteThread(id).catch(() => {});
    },
    [activeId, threads, api, persistenceEnabled, compareChat],
  );

  const stopGeneration = useCallback(() => {
    chat.stop().catch(() => {});
    compareChat.stopAll();
  }, [chat, compareChat]);

  // Shared core for sendMessage/regenerateFrom/editAndResend — single mode.
  const runSend = useCallback(
    (
      text: string,
      baseMessages: AiConversationUIMessage[],
      attachedUrl?: { url: string; title: string },
      files?: FileUIPart[],
    ) => {
      if (!text.trim() || !activeThread || !keyToken) return;

      setError(null);
      setCitations([]);

      const threadId = activeThread.id;
      setThreads(prev =>
        prev.map(t =>
          t.id === threadId
            ? {
                ...t,
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

      chat.setMessages(baseMessages);
      chat
        .sendMessage(
          { text, files, metadata: { attachedUrl } },
          { body: attachedUrl ? { context_url: attachedUrl.url } : undefined },
        )
        .catch(() => {});
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
      chat,
    ],
  );

  const runCompareSend = useCallback(
    (
      text: string,
      baseMessages: AiConversationUIMessage[],
      models: string[],
      attachedUrl?: { url: string; title: string },
      files?: FileUIPart[],
    ) => {
      if (!text.trim() || !activeThread || !keyToken || models.length === 0) return;

      setError(null);
      setCitations([]);

      const turnId = genId();
      const userMsg: AiConversationUIMessage = {
        id: genId(),
        role: 'user',
        metadata: { attachedUrl, turnId },
        parts: [{ type: 'text', text }, ...(files ?? [])],
      };
      const threadId = activeThread.id;

      compareTurnRef.current = { threadId, turnId, prefix: [...baseMessages, userMsg] };

      setThreads(prev =>
        prev.map(t =>
          t.id === threadId
            ? {
                ...t,
                messages: [...baseMessages, userMsg],
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
      compareChat,
    ],
  );

  const sendMessage = useCallback(
    (
      text: string,
      attachedUrl?: { url: string; title: string },
      compareModelsOverride?: string[],
      files?: FileUIPart[],
    ) => {
      if (!activeThread) return;
      const models =
        compareModelsOverride ??
        (activeThread.mode === 'compare' ? activeThread.compareModels : undefined);
      if (models?.length) {
        runCompareSend(text, activeThread.messages, models, attachedUrl, files);
      } else {
        runSend(text, activeThread.messages, attachedUrl, files);
      }
    },
    [activeThread, runSend, runCompareSend],
  );

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
      setThreads(prev => prev.map(t => (t.id === id ? { ...t, pinned: !t.pinned } : t)));
      if (!persistenceEnabled) return;
      const current = threadsRef.current.find(t => t.id === id);
      if (!current) return;
      if (current.id === activeIdRef.current) return;
      api.saveThread({ ...current, pinned: !current.pinned }).catch(() => {});
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
      (payload?.version !== 1 && payload?.version !== THREAD_EXPORT_VERSION) ||
      !payload.thread ||
      typeof payload.thread.id !== 'string' ||
      !Array.isArray(payload.thread.messages)
    ) {
      throw new Error('Unrecognized thread export format');
    }
    const src = payload.thread;
    // Version-1 exports have flat ChatMessage[]-shaped messages — same
    // migration used for legacy localStorage/server data (see
    // migrateThreadMessages). Version-2 exports pass through unchanged.
    const imported: Thread = {
      id: genId(),
      title: typeof src.title === 'string' ? src.title : 'Imported chat',
      messages: migrateThreadMessages(src.messages),
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
  }, []);

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
                  m.id === messageId ? { ...m, metadata: { ...m.metadata, feedback: vote } } : m,
                ),
              },
        ),
      );

      api
        .sendFeedback({
          threadId,
          messageId,
          vote,
          question: question ? extractText(question) : '',
          answer: extractText(message),
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
    streamingMessageIds,
    error,
    citations,
    keySpend,
  };
}
