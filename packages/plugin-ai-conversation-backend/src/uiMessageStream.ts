import type { Response } from 'express';
import { Readable } from 'stream';
import {
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  UIMessageChunk,
} from 'ai';
import type { SearchResult, UsageInfo } from './types';

/** Bounds how long the *connection* (and first byte) may take. Deliberately
 * not applied to the whole response: attaching a timeout signal to `fetch`
 * makes it abort the body stream too, so a single long generation (or a
 * slow-to-first-token model) would be killed mid-answer at this mark. See
 * IDLE_TIMEOUT_MS for the between-tokens guard. */
const UPSTREAM_CONNECT_TIMEOUT_MS = 30_000;

/** Bounds the gap *between* stream chunks, so a wedged upstream is still
 * detected without capping total generation length. Reset on every chunk. */
const IDLE_TIMEOUT_MS = 120_000;

/**
 * LiteLLM's OpenAI-shaped SSE `data:` payload, normalized down to the
 * fields this adapter turns into UI Message Stream Protocol chunks.
 */
export interface NormalizedLiteLLMChunk {
  delta?: string;
  searchResults?: SearchResult[];
  usage?: UsageInfo;
  error?: string;
}

/** LiteLLM reports errors in several shapes — a string, `{ message }`, or a
 * full OpenAI error envelope. `String(err)` on the object form yields the
 * useless "[object Object]", hiding the actual reason from the user. */
export function errorToString(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const e = error as Record<string, any>;
    const nested = e.error ?? e;
    if (typeof nested === 'string') return nested;
    if (nested && typeof nested === 'object' && typeof nested.message === 'string') {
      return nested.message;
    }
  }
  return 'upstream error';
}

/**
 * Parses one LiteLLM OpenAI-shaped `data:` JSON payload. Returns `null` for
 * chunks with nothing worth emitting (e.g. role-only deltas).
 */
export function parseLiteLLMChunk(raw: any): NormalizedLiteLLMChunk | null {
  if (raw && typeof raw === 'object' && 'error' in raw) {
    return { error: errorToString(raw.error) };
  }

  const chunk: NormalizedLiteLLMChunk = {};
  const delta = raw?.choices?.[0]?.delta;
  const content = delta?.content ?? delta?.reasoning_content;
  if (typeof content === 'string') chunk.delta = content;

  if (Array.isArray(raw?.search_results)) {
    chunk.searchResults = raw.search_results.map((r: any): SearchResult => ({
      filename: r.filename ?? r.file_name ?? r.title ?? r.source ?? r.name ?? '',
      score: typeof r.score === 'number' ? r.score : 0,
      text: r.text ?? r.snippet ?? r.content ?? '',
    }));
  }

  if (raw?.usage && typeof raw.usage === 'object') {
    chunk.usage = {
      prompt_tokens: raw.usage.prompt_tokens ?? 0,
      completion_tokens: raw.usage.completion_tokens ?? 0,
      total_tokens: raw.usage.total_tokens ?? 0,
    };
  }

  const hasContent = chunk.delta || chunk.searchResults || chunk.usage;
  return hasContent ? chunk : null;
}

export interface UIMessageStreamState {
  textId: string;
  textStarted: boolean;
}

/**
 * Turns one normalized LiteLLM chunk into the AI SDK `UIMessageChunk`(s) it
 * maps to, given running stream state (whether the text part has been
 * opened yet). Pure and independently unit-testable. Mutates `state` to
 * track whether `text-start` has already been emitted.
 */
export function toUIMessageChunks(
  chunk: NormalizedLiteLLMChunk,
  state: UIMessageStreamState,
): UIMessageChunk[] {
  const out: UIMessageChunk[] = [];

  if (chunk.error) {
    out.push({ type: 'error', errorText: chunk.error });
    return out;
  }

  if (chunk.delta) {
    if (!state.textStarted) {
      out.push({ type: 'text-start', id: state.textId });
      state.textStarted = true;
    }
    out.push({ type: 'text-delta', id: state.textId, delta: chunk.delta });
  }

  if (chunk.searchResults) {
    out.push({
      type: 'data-citations',
      data: chunk.searchResults,
    } as UIMessageChunk);
  }

  if (chunk.usage) {
    out.push({
      type: 'data-usage',
      data: chunk.usage,
    } as UIMessageChunk);
  }

  return out;
}

export interface ProxyUIMessageStreamOptions {
  upstreamUrl: string;
  upstreamBody: unknown;
  userKey: string;
  res: Response;
  logger: any;
  /** UIMessageChunks written right after `start`, before the upstream is
   * contacted — e.g. this turn's retrieval results as `data-citations`. */
  prelude?: UIMessageChunk[];
  /** Injectable for tests; defaults to UPSTREAM_CONNECT_TIMEOUT_MS. */
  connectTimeoutMs?: number;
  /** Injectable for tests; defaults to IDLE_TIMEOUT_MS. */
  idleTimeoutMs?: number;
}

/**
 * Fetches LiteLLM's OpenAI-shaped SSE stream and re-emits it to the client
 * as an AI SDK UI Message Stream Protocol response. The sole streaming path
 * — the pre-migration raw-SSE `/chat/stream` passthrough was removed once
 * the frontend moved fully onto `@ai-sdk/react`.
 */
export async function proxyUIMessageStream(
  opts: ProxyUIMessageStreamOptions,
): Promise<void> {
  const {
    upstreamUrl,
    upstreamBody,
    userKey,
    res,
    logger,
    prelude,
    connectTimeoutMs = UPSTREAM_CONNECT_TIMEOUT_MS,
    idleTimeoutMs = IDLE_TIMEOUT_MS,
  } = opts;
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  const state: UIMessageStreamState = { textId: 'msg-0', textStarted: false };

  const stream = createUIMessageStream({
    onError: error => {
      logger.error('ui-message-stream error', error);
      return error instanceof Error ? error.message : 'stream error';
    },
    execute: async ({ writer }) => {
      writer.write({ type: 'start' });
      for (const chunk of prelude ?? []) {
        writer.write(chunk);
      }

      // A manual, cancellable timer rather than AbortSignal.timeout(): the
      // latter can't be cleared, so it would abort the (now open) response
      // body 30s in, reintroducing the very cap this change removes.
      const connectController = new AbortController();
      let connectTimedOut = false;
      const connectTimer = setTimeout(() => {
        connectTimedOut = true;
        connectController.abort();
      }, connectTimeoutMs);

      let upstream: globalThis.Response;
      try {
        upstream = await fetch(upstreamUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userKey}`,
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(upstreamBody),
          signal: AbortSignal.any([controller.signal, connectController.signal]),
        });
      } catch (err: any) {
        // Client went away — nothing to report, and writing would throw.
        if (err.name === 'AbortError' && !connectTimedOut) return;
        const message = connectTimedOut
          ? 'upstream request timed out'
          : err.message || 'upstream fetch failed';
        writer.write({ type: 'error', errorText: message });
        writer.write({ type: 'finish' });
        return;
      } finally {
        // Headers are in (or the fetch failed) — the body read is governed
        // by the idle timer from here on.
        clearTimeout(connectTimer);
      }

      if (!upstream.ok || !upstream.body) {
        const text = await upstream.text().catch(() => '');
        writer.write({
          type: 'error',
          errorText: `upstream ${upstream.status}: ${text || upstream.statusText}`,
        });
        writer.write({ type: 'finish' });
        return;
      }

      const nodeStream = Readable.fromWeb(upstream.body as any);
      const decoder = new TextDecoder();
      let buffer = '';
      // One idle timer for the whole read loop, reset after every chunk.
      // Aborting it ends the loop via the same AbortError path below; the
      // flag distinguishes "upstream went quiet" from "client disconnected".
      let idleTimedOut = false;
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      const resetIdleTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          idleTimedOut = true;
          nodeStream.destroy(new Error('upstream stream idle'));
        }, idleTimeoutMs);
      };

      try {
        resetIdleTimer();
        for await (const chunkBuf of nodeStream) {
          resetIdleTimer();
          buffer += decoder.decode(chunkBuf as Buffer, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') continue;

            let raw: any;
            try {
              raw = JSON.parse(payload);
            } catch {
              continue; // partial JSON — skip, next chunk reassembles
            }

            const normalized = parseLiteLLMChunk(raw);
            if (!normalized) continue;
            for (const uiChunk of toUIMessageChunks(normalized, state)) {
              writer.write(uiChunk);
            }
          }
        }
      } catch (err: any) {
        if (idleTimedOut) {
          writer.write({ type: 'error', errorText: 'upstream stream timed out' });
        } else if (err.name !== 'AbortError') {
          writer.write({ type: 'error', errorText: err.message || 'stream read failed' });
        }
      } finally {
        if (idleTimer) clearTimeout(idleTimer);
      }

      if (state.textStarted) {
        writer.write({ type: 'text-end', id: state.textId });
      }
      writer.write({ type: 'finish' });
    },
  });

  await pipeUIMessageStreamToResponse({ response: res, stream });
}
