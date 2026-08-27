import { DefaultChatTransport } from 'ai';
import type { FetchApi } from '@backstage/core-plugin-api';
import type { ReasoningEffort, AiConversationUIMessage } from '../types';
/**
 * Everything the backend's /chat/stream/v2 needs alongside `messages` —
 * the same request fields the old `api.ts` `chatStream` built (see
 * ChatStreamRequest in the backend's types.ts). Read fresh on every send
 * via `getSettings()` rather than baked into the Transport at construction
 * time, since these change on every render (model picker, persona picker,
 * etc.) but the Transport instance itself should stay stable — recreating
 * it on every settings change would tear down and rebuild the underlying
 * `useChat` machinery for no reason.
 */
export interface ChatRequestSettings {
    model: string;
    vectorStoreIds: string[];
    personaId: string;
    customSystemPrompt: string;
    toneId: string;
    focusId: string;
    verbosityId: string;
    reasoningEffort: ReasoningEffort | '';
    webSearch?: boolean;
    topK?: number;
    userKey: string;
    threadId: string;
}
/**
 * Builds the custom Transport `useChat` streams through — points at the
 * new opt-in `/chat/stream/v2` protocol-adapter route (Phase 17), using
 * Backstage's `fetchApi` (not the global `fetch`) so auth headers are
 * attached the same way `AiConversationApi` already does it.
 *
 * `getSettings` is called fresh on every send; `getContextUrl` reads the
 * one-off `#url` context for the message currently being sent (set via
 * `sendMessage`'s per-call `options.body`, not a stable setting — see
 * `useThreads.sendMessage`).
 */
export declare function createAiConversationTransport(fetchApi: FetchApi, getSettings: () => ChatRequestSettings): DefaultChatTransport<AiConversationUIMessage>;
