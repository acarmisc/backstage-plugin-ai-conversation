import type { PersistedThread, Thread } from '../types';

/** Body of `PUT /threads/:id` — see api.ts saveThread(). */
export interface SaveThreadBody {
  title: string;
  pinned: boolean;
  data: Omit<Thread, 'keyToken' | 'keyAlias'>;
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
 * Converts a server-persisted thread back into the shape useChat operates
 * on. keyToken/keyAlias are never persisted server-side (see
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
    messages: Array.isArray(raw.messages) ? raw.messages : [],
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
