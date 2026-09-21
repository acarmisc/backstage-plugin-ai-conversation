import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AiConversationApiInterface } from '../api';
import type { Thread } from '../types';
import { fromPersisted, migrateThreadMessages } from './threadPersistence';

const STORAGE_PREFIX = 'ai-conversation:threads';
const SAVE_DEBOUNCE_MS = 400;

/** Threads written before the AI SDK migration have flat `ChatMessage[]`-
 * shaped `messages` — migrate each one on load. */
export function loadThreads(userId: string): Thread[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Thread & { messages: unknown }>;
    return parsed.map(t => ({ ...t, messages: migrateThreadMessages(t.messages) }));
  } catch {
    return [];
  }
}

export function saveThreads(userId: string, threads: Thread[]) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}:${userId}`, JSON.stringify(threads));
  } catch {
    // quota or disabled — ignore
  }
}

/** Entries from `incoming` not already present (by id) in `prev` — lets a
 * second source of threads (userId-keyed localStorage, server persistence)
 * merge into local state without clobbering or duplicating. */
export function newThreadsOnly(prev: Thread[], incoming: Thread[]): Thread[] {
  const existingIds = new Set(prev.map(t => t.id));
  return incoming.filter(t => !existingIds.has(t.id));
}

export interface UseThreadPersistenceOptions {
  userId: string;
  threads: Thread[];
  activeId: string | null;
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  setActiveId: Dispatch<SetStateAction<string | null>>;
  api: AiConversationApiInterface;
  /** When true the backend is authoritative: its thread list is loaded on
   * mount and the active thread is upserted on the same debounce that drives
   * the localStorage write. localStorage is written either way, as an
   * offline cache. */
  persistenceEnabled: boolean;
  onError: (message: string) => void;
}

export interface ThreadPersistence {
  /** Upserts the active thread server-side right now, bypassing the
   * debounce. Only safe to call from an event handler whose state updates
   * have already been committed to the refs (i.e. on a later tick) — the
   * debounced effect is the normal path. */
  syncActiveThreadNow: () => void;
}

/**
 * Owns every side-effect that mirrors the local thread list to durable
 * storage: the debounced localStorage + server write, the unload flush, the
 * one-time server load, and the userId re-load that fires when identity
 * resolves from its `'default'` placeholder.
 *
 * Extracted from useThreads, which was otherwise carrying this alongside the
 * streaming engine. All state stays in useThreads — this only reads the
 * current values through refs so its effects don't re-run on every change.
 */
export function useThreadPersistence({
  userId,
  threads,
  activeId,
  setThreads,
  setActiveId,
  api,
  persistenceEnabled,
  onError,
}: UseThreadPersistenceOptions): ThreadPersistence {
  // Effects below are keyed on coarse inputs (userId, persistenceEnabled) but
  // must read the latest list — refs keep them from re-running per keystroke.
  const threadsRef = useRef<Thread[]>(threads);
  threadsRef.current = threads;
  const activeIdRef = useRef<string | null>(activeId);
  activeIdRef.current = activeId;
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncActiveThreadNow = useCallback(() => {
    if (!persistenceEnabled) return;
    const active = threadsRef.current.find(t => t.id === activeIdRef.current);
    if (active) api.saveThread(active).catch(() => {});
  }, [persistenceEnabled, api]);

  // `userId` starts as the 'default' placeholder and only resolves to the
  // real identity asynchronously, after this hook has already mounted and
  // loaded threads for the placeholder key. Without this, every reload reads
  // the wrong localStorage bucket and the sidebar looks empty until a new
  // message is sent (which saves — but never loads — under the resolved key).
  // Re-load once userId settles and merge in anything found, rather than
  // replacing state and risking dropping an in-flight thread.
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
  }, [userId, setThreads, setActiveId]);

  // Debounced write — localStorage always, server when persistence is on.
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveThreads(userId, threadsRef.current);
      syncActiveThreadNow();
    }, SAVE_DEBOUNCE_MS);
  }, [userId, threads, syncActiveThreadNow]);

  // Flush anything the debounce is still holding when the tab closes, and on
  // unmount (which also fires when the user navigates away).
  useEffect(() => {
    const flush = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      saveThreads(userId, threadsRef.current);
      syncActiveThreadNow();
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, [userId, syncActiveThreadNow]);

  // One-time load of the server's list, merged ahead of local threads.
  useEffect(() => {
    if (!persistenceEnabled) return undefined;
    let cancelled = false;
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
        if (!cancelled) onError(err.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistenceEnabled]);

  return { syncActiveThreadNow };
}
