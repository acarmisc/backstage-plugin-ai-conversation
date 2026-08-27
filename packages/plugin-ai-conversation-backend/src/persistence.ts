import type { Knex } from 'knex';
import type { SaveThreadRequest, ThreadRecord } from './types';

export const CHAT_THREADS_TABLE = 'chat_threads';

/** Generous but bounded — a thread's JSON payload (messages, KB ids, usage,
 * etc.) shouldn't need more than this; caps abuse/runaway row growth. */
export const MAX_THREAD_PAYLOAD_BYTES = 1_000_000;
export const MAX_THREAD_TITLE_LENGTH = 300;

export class ThreadValidationError extends Error {
  status = 400;
}

export class ThreadPayloadTooLargeError extends Error {
  status = 413;
}

/** Validates and normalizes a `PUT /threads/:id` body. `data` is stored and
 * returned opaquely — never interpreted — so this only checks shape/size,
 * not the frontend's `Thread` schema. */
export function serializeThreadPayload(
  body: SaveThreadRequest,
): { title: string; pinned: boolean; data: string } {
  if (!body || typeof body !== 'object') {
    throw new ThreadValidationError('thread body required');
  }
  if (typeof body.title !== 'string' || !body.title.trim()) {
    throw new ThreadValidationError('title required');
  }
  if (body.data === undefined) {
    throw new ThreadValidationError('data required');
  }
  const title = body.title.slice(0, MAX_THREAD_TITLE_LENGTH);
  const data = JSON.stringify(body.data);
  if (Buffer.byteLength(data, 'utf8') > MAX_THREAD_PAYLOAD_BYTES) {
    throw new ThreadPayloadTooLargeError('thread payload too large');
  }
  return { title, pinned: !!body.pinned, data };
}

interface ThreadRow {
  id: string;
  title: string;
  pinned: boolean | number;
  data: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export function mapThreadRow(row: ThreadRow): ThreadRecord {
  let data: unknown = null;
  try {
    data = JSON.parse(row.data);
  } catch {
    data = null;
  }
  return {
    id: row.id,
    title: row.title,
    pinned: !!row.pinned,
    data,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/** Cutoff timestamp before which a thread is considered expired, or `null`
 * when `ttlDays` is 0 (unlimited retention — nothing ever expires). */
export function computeExpiryCutoff(ttlDays: number, now: Date = new Date()): Date | null {
  if (!ttlDays || ttlDays <= 0) return null;
  return new Date(now.getTime() - ttlDays * 24 * 60 * 60 * 1000);
}

export async function listThreads(db: Knex, userRef: string): Promise<ThreadRecord[]> {
  const rows: ThreadRow[] = await db(CHAT_THREADS_TABLE)
    .where('user_ref', userRef)
    .orderBy('updated_at', 'desc');
  return rows.map(mapThreadRow);
}

export async function saveThread(
  db: Knex,
  userRef: string,
  id: string,
  body: SaveThreadRequest,
): Promise<void> {
  if (!id) throw new ThreadValidationError('thread id required');
  const { title, pinned, data } = serializeThreadPayload(body);
  await db(CHAT_THREADS_TABLE)
    .insert({
      id,
      user_ref: userRef,
      title,
      pinned,
      data,
      updated_at: db.fn.now(),
    })
    .onConflict(['id', 'user_ref'])
    .merge({ title, pinned, data, updated_at: db.fn.now() });
}

export async function deleteThread(db: Knex, userRef: string, id: string): Promise<void> {
  await db(CHAT_THREADS_TABLE).where({ id, user_ref: userRef }).del();
}

/** Deletes threads whose last update is older than `ttlDays`. Returns the
 * number of rows deleted. No-ops (returns 0) when `ttlDays` is 0 (unlimited
 * retention) — called from the periodic cleanup task in plugin.ts. */
export async function purgeExpiredThreads(db: Knex, ttlDays: number): Promise<number> {
  const cutoff = computeExpiryCutoff(ttlDays);
  if (!cutoff) return 0;
  return db(CHAT_THREADS_TABLE).where('updated_at', '<', cutoff).del();
}
