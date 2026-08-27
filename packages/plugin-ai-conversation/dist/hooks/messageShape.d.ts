import type { UIMessage } from 'ai';
import type { ChatMessage } from '../types';
/**
 * Compatibility shim between the old flat `ChatMessage` shape and the AI
 * SDK's `UIMessage`/parts shape (HANDOFF-ai-sdk-migration.md Phase 19).
 *
 * `Thread.messages` stays `ChatMessage[]` for now — deliberately, so this
 * phase can swap the streaming engine without also having to touch every
 * UI component that renders `message.content` (that's Phase 20/21's job,
 * once the persisted shape itself moves to `UIMessage[]`). This module is
 * the round-trip: `useThreads`/`useCompareChat` hydrate an `@ai-sdk/react`
 * `useChat` instance from `ChatMessage[]` on thread switch, then mirror its
 * `UIMessage[]` back into `ChatMessage[]` on every update.
 *
 * `turnId`/`compareModel` are NOT carried through here — they only matter
 * for compare-mode's column grouping, which `useCompareChat` tracks itself
 * in its own bookkeeping rather than round-tripping through SDK message
 * metadata.
 */
export interface AiConversationMessageMetadata {
    feedback?: 'up' | 'down';
    attachedUrl?: {
        url: string;
        title: string;
    };
}
export type AiConversationUIMessage = UIMessage<AiConversationMessageMetadata>;
export declare function chatMessageToUIMessage(m: ChatMessage): AiConversationUIMessage;
export declare function chatMessagesToUIMessages(messages: ChatMessage[]): AiConversationUIMessage[];
/** Joins every text part's content, ignoring file/tool/reasoning/data
 * parts — those aren't representable in `ChatMessage.content` yet (Phase
 * 21 renders them directly off `UIMessage.parts` instead). */
export declare function uiMessageToChatMessage(m: AiConversationUIMessage): ChatMessage;
export declare function uiMessagesToChatMessages(messages: AiConversationUIMessage[]): ChatMessage[];
