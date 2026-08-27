import type { PersistedThread, Thread, AiConversationUIMessage } from '../types';
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
export declare function migrateThreadMessages(messages: unknown): AiConversationUIMessage[];
/**
 * Shapes a thread into the server-persistence request body. keyToken/keyAlias
 * are stripped — same exclusion exportThread() already applies to its JSON
 * export, since a chat key is a live credential scoped to the browser/user
 * that minted it and must never be written to durable storage shared across
 * sessions.
 */
export declare function toSaveThreadBody(thread: Thread): SaveThreadBody;
/**
 * Converts a server-persisted thread back into the shape useThreads
 * operates on. keyToken/keyAlias are never persisted server-side (see
 * toSaveThreadBody above) — same as importThread(), the user re-generates a
 * chat key for a thread restored from another device/session.
 */
export declare function fromPersisted(persisted: PersistedThread): Thread;
