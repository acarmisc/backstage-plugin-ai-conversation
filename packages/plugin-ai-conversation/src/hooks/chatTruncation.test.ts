import { computeRegenerateTarget, computeEditTarget } from './chatTruncation';
import type { ChatMessage } from '../types';

function msg(partial: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'role' | 'content'>): ChatMessage {
  return partial;
}

describe('computeRegenerateTarget', () => {
  it('returns null for an unknown message id', () => {
    const messages = [msg({ id: 'u1', role: 'user', content: 'hi' })];
    expect(computeRegenerateTarget(messages, 'missing')).toBeNull();
  });

  it('truncates through (inclusive) a user message target and resends its content', () => {
    const messages: ChatMessage[] = [
      msg({ id: 'u1', role: 'user', content: 'first' }),
      msg({ id: 'a1', role: 'assistant', content: 'reply 1' }),
      msg({ id: 'u2', role: 'user', content: 'second' }),
      msg({ id: 'a2', role: 'assistant', content: 'reply 2' }),
    ];
    const target = computeRegenerateTarget(messages, 'u2');
    expect(target).not.toBeNull();
    expect(target!.text).toBe('second');
    expect(target!.baseMessages).toEqual([messages[0], messages[1]]);
    expect(target!.isCompareEligible).toBe(true);
  });

  it('truncates through (exclusive) an assistant message target, keeping its preceding user message out of baseMessages and resending its content', () => {
    const messages: ChatMessage[] = [
      msg({ id: 'u1', role: 'user', content: 'first' }),
      msg({ id: 'a1', role: 'assistant', content: 'reply 1' }),
      msg({ id: 'u2', role: 'user', content: 'second' }),
      msg({ id: 'a2', role: 'assistant', content: 'reply 2' }),
    ];
    const target = computeRegenerateTarget(messages, 'a2');
    expect(target).not.toBeNull();
    expect(target!.text).toBe('second');
    expect(target!.baseMessages).toEqual([messages[0], messages[1]]);
  });

  it('walks back to the user message sharing turnId, skipping other compare-mode assistant columns', () => {
    const messages: ChatMessage[] = [
      msg({ id: 'u1', role: 'user', content: 'compare this' , turnId: 't1' }),
      msg({ id: 'a1', role: 'assistant', content: 'model A reply', turnId: 't1', compareModel: 'model-a' }),
      msg({ id: 'a2', role: 'assistant', content: 'model B reply', turnId: 't1', compareModel: 'model-b' }),
    ];
    const target = computeRegenerateTarget(messages, 'a2');
    expect(target).not.toBeNull();
    expect(target!.text).toBe('compare this');
    expect(target!.baseMessages).toEqual([]);
    expect(target!.isCompareEligible).toBe(true);
  });

  it('marks a plain (non-compare) assistant target as not compare-eligible', () => {
    const messages: ChatMessage[] = [
      msg({ id: 'u1', role: 'user', content: 'hello' }),
      msg({ id: 'a1', role: 'assistant', content: 'hi there' }),
    ];
    const target = computeRegenerateTarget(messages, 'a1');
    expect(target!.isCompareEligible).toBe(false);
  });

  it('returns null when an assistant message has no preceding user message', () => {
    const messages: ChatMessage[] = [msg({ id: 'a1', role: 'assistant', content: 'orphan reply' })];
    expect(computeRegenerateTarget(messages, 'a1')).toBeNull();
  });
});

describe('computeEditTarget', () => {
  it('truncates through (inclusive) the edited user message', () => {
    const messages: ChatMessage[] = [
      msg({ id: 'u1', role: 'user', content: 'first' }),
      msg({ id: 'a1', role: 'assistant', content: 'reply 1' }),
      msg({ id: 'u2', role: 'user', content: 'second' }),
      msg({ id: 'a2', role: 'assistant', content: 'reply 2' }),
    ];
    const target = computeEditTarget(messages, 'u2');
    expect(target).not.toBeNull();
    expect(target!.baseMessages).toEqual([messages[0], messages[1]]);
  });

  it('returns null when the target is an assistant message', () => {
    const messages: ChatMessage[] = [
      msg({ id: 'u1', role: 'user', content: 'first' }),
      msg({ id: 'a1', role: 'assistant', content: 'reply 1' }),
    ];
    expect(computeEditTarget(messages, 'a1')).toBeNull();
  });

  it('returns null for an unknown message id', () => {
    const messages: ChatMessage[] = [msg({ id: 'u1', role: 'user', content: 'first' })];
    expect(computeEditTarget(messages, 'missing')).toBeNull();
  });
});
