"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreadPayloadTooLargeError = exports.ThreadValidationError = exports.MAX_THREAD_TITLE_LENGTH = exports.MAX_THREAD_PAYLOAD_BYTES = exports.CHAT_THREADS_TABLE = void 0;
exports.serializeThreadPayload = serializeThreadPayload;
exports.mapThreadRow = mapThreadRow;
exports.computeExpiryCutoff = computeExpiryCutoff;
exports.listThreads = listThreads;
exports.saveThread = saveThread;
exports.deleteThread = deleteThread;
exports.purgeExpiredThreads = purgeExpiredThreads;
exports.CHAT_THREADS_TABLE = 'chat_threads';
/** Generous but bounded — a thread's JSON payload (messages, KB ids, usage,
 * etc.) shouldn't need more than this; caps abuse/runaway row growth. */
exports.MAX_THREAD_PAYLOAD_BYTES = 1000000;
exports.MAX_THREAD_TITLE_LENGTH = 300;
class ThreadValidationError extends Error {
    constructor() {
        super(...arguments);
        this.status = 400;
    }
}
exports.ThreadValidationError = ThreadValidationError;
class ThreadPayloadTooLargeError extends Error {
    constructor() {
        super(...arguments);
        this.status = 413;
    }
}
exports.ThreadPayloadTooLargeError = ThreadPayloadTooLargeError;
/** Validates and normalizes a `PUT /threads/:id` body. `data` is stored and
 * returned opaquely — never interpreted — so this only checks shape/size,
 * not the frontend's `Thread` schema. */
function serializeThreadPayload(body) {
    if (!body || typeof body !== 'object') {
        throw new ThreadValidationError('thread body required');
    }
    if (typeof body.title !== 'string' || !body.title.trim()) {
        throw new ThreadValidationError('title required');
    }
    if (body.data === undefined) {
        throw new ThreadValidationError('data required');
    }
    const title = body.title.slice(0, exports.MAX_THREAD_TITLE_LENGTH);
    const data = JSON.stringify(body.data);
    if (Buffer.byteLength(data, 'utf8') > exports.MAX_THREAD_PAYLOAD_BYTES) {
        throw new ThreadPayloadTooLargeError('thread payload too large');
    }
    return { title, pinned: !!body.pinned, data };
}
function mapThreadRow(row) {
    let data = null;
    try {
        data = JSON.parse(row.data);
    }
    catch {
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
function computeExpiryCutoff(ttlDays, now = new Date()) {
    if (!ttlDays || ttlDays <= 0)
        return null;
    return new Date(now.getTime() - ttlDays * 24 * 60 * 60 * 1000);
}
async function listThreads(db, userRef) {
    const rows = await db(exports.CHAT_THREADS_TABLE)
        .where('user_ref', userRef)
        .orderBy('updated_at', 'desc');
    return rows.map(mapThreadRow);
}
async function saveThread(db, userRef, id, body) {
    if (!id)
        throw new ThreadValidationError('thread id required');
    const { title, pinned, data } = serializeThreadPayload(body);
    await db(exports.CHAT_THREADS_TABLE)
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
async function deleteThread(db, userRef, id) {
    await db(exports.CHAT_THREADS_TABLE).where({ id, user_ref: userRef }).del();
}
/** Deletes threads whose last update is older than `ttlDays`. Returns the
 * number of rows deleted. No-ops (returns 0) when `ttlDays` is 0 (unlimited
 * retention) — called from the periodic cleanup task in plugin.ts. */
async function purgeExpiredThreads(db, ttlDays) {
    const cutoff = computeExpiryCutoff(ttlDays);
    if (!cutoff)
        return 0;
    return db(exports.CHAT_THREADS_TABLE).where('updated_at', '<', cutoff).del();
}
