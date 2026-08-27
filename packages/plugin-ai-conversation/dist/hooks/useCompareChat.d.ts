import type { ChatStatus, ChatTransport } from 'ai';
import type { AiConversationUIMessage } from '../types';
/**
 * Compare mode: N models replying to the same prompt in parallel, side by
 * side (HANDOFF-ai-sdk-migration.md Phase 19 design decision). There's no
 * direct SDK equivalent for this — `@ai-sdk/react`'s `useChat` is one
 * instance per hook call, and the set of selected models is dynamic, so it
 * can't be N `useChat()` calls (that would violate the Rules of Hooks: a
 * variable number of hook calls). Instead this uses the SDK's underlying
 * `Chat` class directly — the plain (non-hook) primitive `useChat` itself
 * is built on — one instance per model, held in a ref-backed `Map` and
 * subscribed to via `useSyncExternalStore` so column updates still drive
 * React re-renders.
 *
 * This is the single highest-risk piece of the whole migration per the
 * handoff doc ("no direct SDK equivalent... budget real design time").
 * Behavioral parity with the old `runCompareSend`/`Map<msgId,
 * AbortController>` implementation has NOT been verified against a live
 * LiteLLM backend or in a browser — only type-checked. Treat as unverified
 * until smoke-tested for real.
 */
export interface CompareColumn {
    model: string;
    messages: AiConversationUIMessage[];
    status: ChatStatus;
    error: Error | undefined;
}
export interface UseCompareChatOptions {
    /** Builds a fresh Transport for one column, with `model` already baked
     * into the request settings that Transport reads on every send. */
    createTransport: (model: string) => ChatTransport<AiConversationUIMessage>;
    onFinishColumn?: (model: string) => void;
}
export interface UseCompareChatResult {
    columns: CompareColumn[];
    isStreaming: boolean;
    /** Starts every model in `models` on the same prompt, replacing whatever
     * columns previously existed. `baseMessages` is the conversation so far
     * (shared across all columns); each column appends its own reply to it. */
    sendToAll: (models: string[], baseMessages: AiConversationUIMessage[]) => void;
    stopAll: () => void;
    /** Clears all columns — e.g. on thread switch, so a stale compare-mode
     * render doesn't leak into the next thread. */
    reset: () => void;
}
export declare function useCompareChat(options: UseCompareChatOptions): UseCompareChatResult;
