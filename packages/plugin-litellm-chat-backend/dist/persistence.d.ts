import type { Knex } from 'knex';
import type { SaveThreadRequest, ThreadRecord } from './types';
export declare const CHAT_THREADS_TABLE = "chat_threads";
/** Generous but bounded — a thread's JSON payload (messages, KB ids, usage,
 * etc.) shouldn't need more than this; caps abuse/runaway row growth. */
export declare const MAX_THREAD_PAYLOAD_BYTES = 1000000;
export declare const MAX_THREAD_TITLE_LENGTH = 300;
export declare class ThreadValidationError extends Error {
    status: number;
}
export declare class ThreadPayloadTooLargeError extends Error {
    status: number;
}
/** Validates and normalizes a `PUT /threads/:id` body. `data` is stored and
 * returned opaquely — never interpreted — so this only checks shape/size,
 * not the frontend's `Thread` schema. */
export declare function serializeThreadPayload(body: SaveThreadRequest): {
    title: string;
    pinned: boolean;
    data: string;
};
interface ThreadRow {
    id: string;
    title: string;
    pinned: boolean | number;
    data: string;
    created_at: Date | string;
    updated_at: Date | string;
}
export declare function mapThreadRow(row: ThreadRow): ThreadRecord;
/** Cutoff timestamp before which a thread is considered expired, or `null`
 * when `ttlDays` is 0 (unlimited retention — nothing ever expires). */
export declare function computeExpiryCutoff(ttlDays: number, now?: Date): Date | null;
export declare function listThreads(db: Knex, userRef: string): Promise<ThreadRecord[]>;
export declare function saveThread(db: Knex, userRef: string, id: string, body: SaveThreadRequest): Promise<void>;
export declare function deleteThread(db: Knex, userRef: string, id: string): Promise<void>;
/** Deletes threads whose last update is older than `ttlDays`. Returns the
 * number of rows deleted. No-ops (returns 0) when `ttlDays` is 0 (unlimited
 * retention) — called from the periodic cleanup task in plugin.ts. */
export declare function purgeExpiredThreads(db: Knex, ttlDays: number): Promise<number>;
export {};
