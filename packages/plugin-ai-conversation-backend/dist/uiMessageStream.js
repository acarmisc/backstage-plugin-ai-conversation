"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLiteLLMChunk = parseLiteLLMChunk;
exports.toUIMessageChunks = toUIMessageChunks;
exports.proxyUIMessageStream = proxyUIMessageStream;
const stream_1 = require("stream");
const ai_1 = require("ai");
/**
 * Parses one LiteLLM OpenAI-shaped `data:` JSON payload. Returns `null` for
 * chunks with nothing worth emitting (e.g. role-only deltas) — same
 * skip-empty-chunks behavior as the frontend's `normalizeChunk`.
 */
function parseLiteLLMChunk(raw) {
    if (raw && typeof raw === 'object' && 'error' in raw) {
        return { error: String(raw.error) };
    }
    const chunk = {};
    const delta = raw?.choices?.[0]?.delta;
    const content = delta?.content ?? delta?.reasoning_content;
    if (typeof content === 'string')
        chunk.delta = content;
    if (Array.isArray(raw?.search_results)) {
        chunk.searchResults = raw.search_results.map((r) => ({
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
/**
 * Turns one normalized LiteLLM chunk into the AI SDK `UIMessageChunk`(s) it
 * maps to, given running stream state (whether the text part has been
 * opened yet). Pure and independently unit-testable — the one piece of new
 * wire-protocol logic in this adapter, and the part most likely to get
 * subtly wrong per HANDOFF-ai-sdk-migration.md Phase 17. Mutates `state` to
 * track whether `text-start` has already been emitted.
 */
function toUIMessageChunks(chunk, state) {
    const out = [];
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
        });
    }
    if (chunk.usage) {
        out.push({
            type: 'data-usage',
            data: chunk.usage,
        });
    }
    return out;
}
/**
 * Fetches LiteLLM's OpenAI-shaped SSE stream and re-emits it to the client
 * as an AI SDK UI Message Stream Protocol response (HANDOFF-ai-sdk-migration.md
 * Phase 17). Additive by design: this is a new response shape served from a
 * new opt-in route — the existing `/chat/stream` byte-for-byte passthrough
 * (`stream.ts`'s `proxySSE`) is untouched, so no existing frontend behavior
 * changes until something is deliberately migrated to consume this instead.
 */
async function proxyUIMessageStream(opts) {
    const { upstreamUrl, upstreamBody, userKey, res, logger } = opts;
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    const state = { textId: 'msg-0', textStarted: false };
    const stream = (0, ai_1.createUIMessageStream)({
        onError: error => {
            logger.error('ui-message-stream error', error);
            return error instanceof Error ? error.message : 'stream error';
        },
        execute: async ({ writer }) => {
            writer.write({ type: 'start' });
            let upstream;
            try {
                upstream = await fetch(upstreamUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${userKey}`,
                        Accept: 'text/event-stream',
                    },
                    body: JSON.stringify(upstreamBody),
                    signal: controller.signal,
                });
            }
            catch (err) {
                if (err.name === 'AbortError')
                    return;
                writer.write({ type: 'error', errorText: err.message || 'upstream fetch failed' });
                writer.write({ type: 'finish' });
                return;
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
            const nodeStream = stream_1.Readable.fromWeb(upstream.body);
            const decoder = new TextDecoder();
            let buffer = '';
            try {
                for await (const chunkBuf of nodeStream) {
                    buffer += decoder.decode(chunkBuf, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? '';
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('data:'))
                            continue;
                        const payload = trimmed.slice(5).trim();
                        if (payload === '[DONE]')
                            continue;
                        let raw;
                        try {
                            raw = JSON.parse(payload);
                        }
                        catch {
                            continue; // partial JSON — skip, next chunk reassembles
                        }
                        const normalized = parseLiteLLMChunk(raw);
                        if (!normalized)
                            continue;
                        for (const uiChunk of toUIMessageChunks(normalized, state)) {
                            writer.write(uiChunk);
                        }
                    }
                }
            }
            catch (err) {
                if (err.name !== 'AbortError') {
                    writer.write({ type: 'error', errorText: err.message || 'stream read failed' });
                }
            }
            if (state.textStarted) {
                writer.write({ type: 'text-end', id: state.textId });
            }
            writer.write({ type: 'finish' });
        },
    });
    await (0, ai_1.pipeUIMessageStreamToResponse)({ response: res, stream });
}
