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
  return { ...persisted.data, keyToken: '', keyAlias: '' };
}
