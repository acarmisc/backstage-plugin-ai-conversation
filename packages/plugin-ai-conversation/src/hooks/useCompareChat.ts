import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { Chat } from '@ai-sdk/react';
import type { ChatStatus, ChatTransport } from 'ai';
import type { AiConversationUIMessage } from './messageShape';

/**
 * Compare mode: N models replying to the same prompt in parallel, side by
 * side (HANDOFF-ai-sdk-migration.md Phase 19 design decision). There's no
 * direct SDK equivalent for this — `@ai-sdk/react`'s `useChat` is one
 * instance per hook call, and the set of selected models is dynamic, so it
 * can't be N `useChat()` calls (that would violate the Rules of Hooks: a
 * variable number of hook calls). Instead this uses the SDK's underlying
 * `Chat` class directly — the plain (non-hook) primitive `useChat` itself
 * is built on — one instance per model, held in a ref-backed `Map` and
 * subscribed to via `useSyncExternalStore` so column updates still drive
 * React re-renders.
 *
 * This is the single highest-risk piece of the whole migration per the
 * handoff doc ("no direct SDK equivalent... budget real design time").
 * Behavioral parity with the old `runCompareSend`/`Map<msgId,
 * AbortController>` implementation has NOT been verified against a live
 * LiteLLM backend or in a browser — only type-checked. Treat as unverified
 * until smoke-tested for real.
 */

export interface CompareColumn {
  model: string;
  messages: AiConversationUIMessage[];
  status: ChatStatus;
  error: Error | undefined;
}

export interface UseCompareChatOptions {
  /** Builds a fresh Transport for one column, with `model` already baked
   * into the request settings that Transport reads on every send. */
  createTransport: (model: string) => ChatTransport<AiConversationUIMessage>;
  onFinishColumn?: (model: string) => void;
}

export interface UseCompareChatResult {
  columns: CompareColumn[];
  isStreaming: boolean;
  /** Starts every model in `models` on the same prompt, replacing whatever
   * columns previously existed. `baseMessages` is the conversation so far
   * (shared across all columns); each column appends its own reply to it. */
  sendToAll: (models: string[], baseMessages: AiConversationUIMessage[]) => void;
  stopAll: () => void;
  /** Clears all columns — e.g. on thread switch, so a stale compare-mode
   * render doesn't leak into the next thread. */
  reset: () => void;
}

interface ColumnEntry {
  model: string;
  chat: Chat<AiConversationUIMessage>;
  unsubscribe: () => void;
}

export function useCompareChat(options: UseCompareChatOptions): UseCompareChatResult {
  const { createTransport, onFinishColumn } = options;

  // One Chat instance per model column, keyed by model id. A ref (not
  // state) because Chat instances themselves aren't render data — each
  // one manages its own subscriber list and re-renders happen via
  // useSyncExternalStore below, not via this Map changing identity.
  const columnsRef = useRef<Map<string, ColumnEntry>>(new Map());

  // A single external-store snapshot standing in for "any column changed"
  // — good enough here since sendToAll/stopAll touch every column at once
  // and per-token updates already come from each Chat's own throttling.
  // A version counter is simpler and cheaper than diffing N column arrays
  // every render.
  const versionRef = useRef(0);
  const listenersRef = useRef<Set<() => void>>(new Set());

  const notify = useCallback(() => {
    versionRef.current += 1;
    listenersRef.current.forEach(l => l());
  }, []);

  const subscribe = useCallback((onStoreChange: () => void) => {
    listenersRef.current.add(onStoreChange);
    return () => {
      listenersRef.current.delete(onStoreChange);
    };
  }, []);

  const getSnapshot = useCallback(() => versionRef.current, []);
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const teardownColumn = useCallback((entry: ColumnEntry) => {
    entry.unsubscribe();
  }, []);

  const reset = useCallback(() => {
    columnsRef.current.forEach(entry => {
      entry.chat.stop().catch(() => {});
      teardownColumn(entry);
    });
    columnsRef.current.clear();
    notify();
  }, [notify, teardownColumn]);

  const sendToAll = useCallback(
    (models: string[], baseMessages: AiConversationUIMessage[]) => {
      // Stop and discard any previous columns first — a new send always
      // starts a fresh turn, matching the old runCompareSend's
      // stopGeneration()-first behavior.
      columnsRef.current.forEach(entry => {
        entry.chat.stop().catch(() => {});
        teardownColumn(entry);
      });
      columnsRef.current.clear();

      for (const model of models) {
        const transport = createTransport(model);
        const chat = new Chat<AiConversationUIMessage>({
          id: `compare:${model}:${Date.now()}`,
          transport,
          messages: baseMessages,
        });
        const unsubMessages = chat['~registerMessagesCallback'](notify);
        const unsubStatus = chat['~registerStatusCallback'](notify);
        const unsubError = chat['~registerErrorCallback'](notify);
        const entry: ColumnEntry = {
          model,
          chat,
          unsubscribe: () => {
            unsubMessages();
            unsubStatus();
            unsubError();
          },
        };
        columnsRef.current.set(model, entry);
        chat
          .sendMessage()
          .then(() => onFinishColumn?.(model))
          .catch(() => {
            /* surfaced via chat.error / status, already triggers a re-render */
          });
      }
      notify();
    },
    [createTransport, notify, onFinishColumn, teardownColumn],
  );

  const stopAll = useCallback(() => {
    columnsRef.current.forEach(entry => {
      entry.chat.stop().catch(() => {});
    });
  }, []);

  const columns: CompareColumn[] = useMemo(
    () =>
      Array.from(columnsRef.current.values()).map(entry => ({
        model: entry.model,
        messages: entry.chat.messages,
        status: entry.chat.status,
        error: entry.chat.error,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versionRef.current],
  );

  const isStreaming = columns.some(c => c.status === 'submitted' || c.status === 'streaming');

  return { columns, isStreaming, sendToAll, stopAll, reset };
}
