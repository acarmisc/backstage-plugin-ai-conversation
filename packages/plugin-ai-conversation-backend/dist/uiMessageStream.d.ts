import type { Response } from 'express';
import { UIMessageChunk } from 'ai';
import type { SearchResult, UsageInfo } from './types';
/**
 * LiteLLM's OpenAI-shaped SSE `data:` payload, normalized down to the
 * fields this adapter turns into UI Message Stream Protocol chunks. Mirrors
 * the frontend's `normalizeChunk` in api.ts — HANDOFF-ai-sdk-migration.md
 * Phase 17 moves that parsing server-side so it can be shared by both the
 * legacy `/chat/stream` passthrough and this protocol adapter.
 */
export interface NormalizedLiteLLMChunk {
    delta?: string;
    searchResults?: SearchResult[];
    usage?: UsageInfo;
    error?: string;
}
/**
 * Parses one LiteLLM OpenAI-shaped `data:` JSON payload. Returns `null` for
 * chunks with nothing worth emitting (e.g. role-only deltas) — same
 * skip-empty-chunks behavior as the frontend's `normalizeChunk`.
 */
export declare function parseLiteLLMChunk(raw: any): NormalizedLiteLLMChunk | null;
export interface UIMessageStreamState {
    textId: string;
    textStarted: boolean;
}
/**
 * Turns one normalized LiteLLM chunk into the AI SDK `UIMessageChunk`(s) it
 * maps to, given running stream state (whether the text part has been
 * opened yet). Pure and independently unit-testable — the one piece of new
 * wire-protocol logic in this adapter, and the part most likely to get
 * subtly wrong per HANDOFF-ai-sdk-migration.md Phase 17. Mutates `state` to
 * track whether `text-start` has already been emitted.
 */
export declare function toUIMessageChunks(chunk: NormalizedLiteLLMChunk, state: UIMessageStreamState): UIMessageChunk[];
export interface ProxyUIMessageStreamOptions {
    upstreamUrl: string;
    upstreamBody: unknown;
    userKey: string;
    res: Response;
    logger: any;
    /** UIMessageChunks written right after `start`, before the upstream is
     * contacted — e.g. this turn's retrieval results as `data-citations`. */
    prelude?: UIMessageChunk[];
}
/**
 * Fetches LiteLLM's OpenAI-shaped SSE stream and re-emits it to the client
 * as an AI SDK UI Message Stream Protocol response (HANDOFF-ai-sdk-migration.md
 * Phase 17). Additive by design: this is a new response shape served from a
 * new opt-in route — the existing `/chat/stream` byte-for-byte passthrough
 * (`stream.ts`'s `proxySSE`) is untouched, so no existing frontend behavior
 * changes until something is deliberately migrated to consume this instead.
 */
export declare function proxyUIMessageStream(opts: ProxyUIMessageStreamOptions): Promise<void>;
