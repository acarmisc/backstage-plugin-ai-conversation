import type { ChatMessage, AiConversationUIMessage } from '../types';
/**
 * `Thread.messages` is `AiConversationUIMessage[]` (HANDOFF-ai-sdk-migration.md
 * Phase 20). The conversion functions here are the building blocks of the
 * old-shape -> new-shape migration in `threadPersistence.ts`
 * (`migrateChatMessagesToUIMessages`) and of `importThread`'s v1-export
 * compatibility path — not a per-render shim anymore (Phase 19 used them
 * that way transitionally; Phase 20 made `Thread.messages` itself
 * `AiConversationUIMessage[]`, so `useThreads`/`useCompareChat` work with
 * `UIMessage`s directly and no longer round-trip through `ChatMessage` on
 * every render).
 */
export declare function chatMessageToUIMessage(m: ChatMessage): AiConversationUIMessage;
export declare function chatMessagesToUIMessages(messages: ChatMessage[]): AiConversationUIMessage[];
/** Joins every text part's content, ignoring file/tool/reasoning/data
 * parts — used wherever a plain-text view of a message is needed (title
 * slicing, search, feedback payloads, regenerate/edit truncation). Actual
 * rendering reads `message.parts` directly instead (see AssistantMessage/
 * UserMessage), so attachments and tool calls aren't lost through this. */
export declare function extractText(message: AiConversationUIMessage): string;
