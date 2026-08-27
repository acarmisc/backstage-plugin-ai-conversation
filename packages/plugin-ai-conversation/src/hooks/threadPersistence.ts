import type { PersistedThread, Thread, AiConversationUIMessage, ChatMessage } from '../types';
import { chatMessagesToUIMessages } from './messageShape';

/** Body of `PUT /threads/:id` — see api.ts saveThread(). */
export interface SaveThreadBody {
  title: string;
  pinned: boolean;
  data: Omit<Thread, 'keyToken' | 'keyAlias'>;
}

/**
 * Detects and migrates a thread's `messages` field from the pre-Phase-20
 * flat `ChatMessage[]` shape to `AiConversationUIMessage[]`
 * (HANDOFF-ai-sdk-migration.md Phase 20), for data written before this
 * migration shipped — existing localStorage threads, server-persisted
 * rows, version-1 thread exports.
 *
 * One-way: once migrated and re-saved (the debounced save in
 * `useThreads.ts` does this on the very next change), the old shape is
 * gone from that thread's storage. Detection is per-thread: a message
 * array's shape is homogeneous within one thread (threads are loaded and
 * migrated wholesale before any new message can be appended, so old- and
 * new-shape messages never mix within a single thread's history) —
 * checking the first element for a `parts` array is enough to tell
 * already-migrated data from legacy data.
 *
 * Malformed/unrecognized entries are dropped rather than thrown on,
 * matching `fromPersisted`'s existing "never crash the sidebar on bad
 * data" discipline.
 */
export function migrateThreadMessages(messages: unknown): AiConversationUIMessage[] {
  if (!Array.isArray(messages)) return [];
  if (messages.length === 0) return [];
  const first = messages[0];
  const alreadyMigrated =
    typeof first === 'object' && first !== null && Array.isArray((first as any).parts);
  if (alreadyMigrated) return messages as AiConversationUIMessage[];
  return chatMessagesToUIMessages(messages as ChatMessage[]);
}

/**
 * Shapes a thread into the server-persistence request body. keyToken/keyAlias
 * are stripped — same exclusion exportThread() already applies to its JSON
 * export, since a chat key is a live credential scoped to the browser/user
 * that minted it and must never be written to durable storage shared across
 * sessions.
 */
export function toSaveThreadBody(thread: Thread): SaveThreadBody {
  const { keyToken: _keyToken, keyAlias: _keyAlias, ...data } = thread;
  return { title: thread.title, pinned: !!thread.pinned, data };
}

/**
 * Converts a server-persisted thread back into the shape useThreads
 * operates on. keyToken/keyAlias are never persisted server-side (see
 * toSaveThreadBody above) — same as importThread(), the user re-generates a
 * chat key for a thread restored from another device/session.
 */
export function fromPersisted(persisted: PersistedThread): Thread {
  // mapThreadRow() deliberately returns `data: null` on a corrupt DB row
  // rather than throwing to the client — so `data` must be assumed possibly
  // null/malformed here, or the sidebar crashes rendering it (title,
  // messages etc. would all be undefined). Spread only when it's a usable
  // object, then re-guard the fields the UI reads unconditionally with
  // fallbacks (row title/id, empty lists) so an unrecoverable payload still
  // renders instead of crashing. Required Thread fields are re-asserted
  // explicitly — a Partial-spread alone would leave them possibly-undefined.
  const raw =
    persisted.data && typeof persisted.data === 'object' && !Array.isArray(persisted.data)
      ? (persisted.data as Partial<Thread>)
      : {};
  return {
    ...raw,
    keyToken: '',
    keyAlias: '',
    id: typeof raw.id === 'string' ? raw.id : persisted.id,
    title: typeof raw.title === 'string' && raw.title ? raw.title : persisted.title,
    pinned: typeof raw.pinned === 'boolean' ? raw.pinned : persisted.pinned,
    messages: migrateThreadMessages(raw.messages),
    model: typeof raw.model === 'string' ? raw.model : '',
    vectorStoreIds: Array.isArray(raw.vectorStoreIds) ? raw.vectorStoreIds : [],
    personaId: typeof raw.personaId === 'string' ? raw.personaId : '',
    customSystemPrompt: typeof raw.customSystemPrompt === 'string' ? raw.customSystemPrompt : '',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    totalTokens: typeof raw.totalTokens === 'number' ? raw.totalTokens : 0,
    lastTurnUsage: raw.lastTurnUsage ?? null,
  };
}
