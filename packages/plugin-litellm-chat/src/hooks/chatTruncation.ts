import type { ChatMessage } from '../types';

export interface RegenerateTarget {
  baseMessages: ChatMessage[];
  text: string;
  /** Whether this target participated in a compare-mode turn — an
   * assistant message only counts if it actually carries a compareModel
   * tag, guarding against stale/pre-compare-mode thread data. A user
   * message target is always eligible. */
  isCompareEligible: boolean;
}

/**
 * Pure truncation logic behind regenerateFrom: given the full message list
 * and a target message id, returns the message slice to resend against and
 * the text to resend, or null if the target can't be resolved.
 *
 * - user message target: truncate up to (excluding) it, resend its content
 *   — the message and its old reply are dropped and re-sent.
 * - assistant message target: walk back to the nearest preceding user
 *   message in the same turn (or any preceding user message if turnId is
 *   unset — threads created before turnId existed), truncate up to
 *   (excluding) that user message, resend its content — the reply and
 *   anything after it is dropped and reproduced fresh.
 */
export function computeRegenerateTarget(
  messages: ChatMessage[],
  messageId: string,
): RegenerateTarget | null {
  const idx = messages.findIndex(m => m.id === messageId);
  if (idx === -1) return null;
  const target = messages[idx];

  if (target.role === 'user') {
    return { baseMessages: messages.slice(0, idx), text: target.content, isCompareEligible: true };
  }

  const turnId = target.turnId;
  let userIdx = idx - 1;
  while (
    userIdx >= 0 &&
    !(messages[userIdx].role === 'user' && (!turnId || messages[userIdx].turnId === turnId))
  ) {
    userIdx -= 1;
  }
  if (userIdx < 0) return null;

  return {
    baseMessages: messages.slice(0, userIdx),
    text: messages[userIdx].content,
    isCompareEligible: !!target.compareModel,
  };
}

export interface EditTarget {
  baseMessages: ChatMessage[];
}

/** Pure truncation logic behind editAndResend: the target must be a user
 * message; returns the slice to resend against (excluding that message and
 * everything after it), or null if the target isn't a user message. */
export function computeEditTarget(messages: ChatMessage[], messageId: string): EditTarget | null {
  const idx = messages.findIndex(m => m.id === messageId);
  if (idx === -1 || messages[idx].role !== 'user') return null;
  return { baseMessages: messages.slice(0, idx) };
}
