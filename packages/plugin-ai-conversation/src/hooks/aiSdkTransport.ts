import { DefaultChatTransport } from 'ai';
import type { FetchApi } from '@backstage/core-plugin-api';
import type { ReasoningEffort } from '../types';
import type { AiConversationUIMessage } from './messageShape';

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

const BASE_PATH = '/api/ai-conversation';

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
export function createAiConversationTransport(
  fetchApi: FetchApi,
  getSettings: () => ChatRequestSettings,
): DefaultChatTransport<AiConversationUIMessage> {
  return new DefaultChatTransport<AiConversationUIMessage>({
    api: `${BASE_PATH}/chat/stream/v2`,
    fetch: fetchApi.fetch.bind(fetchApi) as typeof fetch,
    prepareSendMessagesRequest: ({ messages, body }) => {
      const s = getSettings();
      const contextUrl = (body as { context_url?: string } | undefined)?.context_url;
      return {
        body: {
          model: s.model,
          messages,
          thread_id: s.threadId,
          vector_store_ids: s.vectorStoreIds.length ? s.vectorStoreIds : undefined,
          persona_id: s.personaId || undefined,
          custom_system_prompt: s.customSystemPrompt || undefined,
          tone_id: s.toneId || undefined,
          focus_id: s.focusId || undefined,
          verbosity_id: s.verbosityId || undefined,
          reasoning_effort: s.reasoningEffort || undefined,
          context_url: contextUrl,
          web_search: s.webSearch || undefined,
          top_k: s.topK,
          user_key: s.userKey,
        },
      };
    },
  });
}
