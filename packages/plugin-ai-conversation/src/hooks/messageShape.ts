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
  attachedUrl?: { url: string; title: string };
}

export type AiConversationUIMessage = UIMessage<AiConversationMessageMetadata>;

export function chatMessageToUIMessage(m: ChatMessage): AiConversationUIMessage {
  return {
    id: m.id,
    role: m.role,
    metadata: {
      feedback: m.feedback,
      attachedUrl: m.attachedUrl,
    },
    parts: [{ type: 'text', text: m.content }],
  };
}

export function chatMessagesToUIMessages(messages: ChatMessage[]): AiConversationUIMessage[] {
  return messages.map(chatMessageToUIMessage);
}

/** Joins every text part's content, ignoring file/tool/reasoning/data
 * parts — those aren't representable in `ChatMessage.content` yet (Phase
 * 21 renders them directly off `UIMessage.parts` instead). */
export function uiMessageToChatMessage(m: AiConversationUIMessage): ChatMessage {
  const content = m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('');
  return {
    id: m.id,
    role: m.role,
    content,
    feedback: m.metadata?.feedback,
    attachedUrl: m.metadata?.attachedUrl,
  };
}

export function uiMessagesToChatMessages(messages: AiConversationUIMessage[]): ChatMessage[] {
  return messages.map(uiMessageToChatMessage);
}
