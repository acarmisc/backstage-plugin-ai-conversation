import { computeRegenerateTarget, computeEditTarget, attachedFiles } from './chatTruncation';
import type { AiConversationUIMessage } from '../types';

function msg(opts: {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  turnId?: string;
  compareModel?: string;
}): AiConversationUIMessage {
  return {
    id: opts.id,
    role: opts.role,
    parts: [{ type: 'text', text: opts.text }],
    metadata: { turnId: opts.turnId, compareModel: opts.compareModel },
  };
}

describe('attachedFiles', () => {
  it('returns file parts with non-empty urls', () => {
    const message: AiConversationUIMessage = {
      id: 'm1',
      role: 'user',
      parts: [
        { type: 'text', text: 'Look' },
        { type: 'file', mediaType: 'image/png', filename: 'pic.png', url: 'https://example.com/img.png' },
      ],
    };
    const files = attachedFiles(message);
    expect(files).toHaveLength(1);
    expect(files[0]).toEqual({
      type: 'file',
      mediaType: 'image/png',
      filename: 'pic.png',
      url: 'https://example.com/img.png',
    });
  });

  it('excludes file parts with empty urls (dropped attachments)', () => {
    const message: AiConversationUIMessage = {
      id: 'm1',
      role: 'user',
      parts: [
        { type: 'file', mediaType: 'image/png', filename: 'dropped.png', url: '' },
        { type: 'file', mediaType: 'image/jpeg', filename: 'kept.jpg', url: 'https://example.com/img.jpg' },
      ],
    };
    const files = attachedFiles(message);
    expect(files).toHaveLength(1);
    expect((files[0] as any).filename).toBe('kept.jpg');
  });

  it('returns empty array when there are no file parts', () => {
    const message: AiConversationUIMessage = {
      id: 'm1',
      role: 'user',
      parts: [{ type: 'text', text: 'Just text' }],
    };
    const files = attachedFiles(message);
    expect(files).toHaveLength(0);
  });

  it('returns empty array when all file parts have empty urls', () => {
    const message: AiConversationUIMessage = {
      id: 'm1',
      role: 'user',
      parts: [
        { type: 'file', mediaType: 'image/png', filename: 'dropped1.png', url: '' },
        { type: 'file', mediaType: 'image/jpeg', filename: 'dropped2.jpg', url: '' },
      ],
    };
    const files = attachedFiles(message);
    expect(files).toHaveLength(0);
  });

  it('preserves file part order', () => {
    const message: AiConversationUIMessage = {
      id: 'm1',
      role: 'user',
      parts: [
        { type: 'file', mediaType: 'image/png', filename: 'first.png', url: 'https://example.com/1.png' },
        { type: 'file', mediaType: 'image/jpeg', filename: 'second.jpg', url: 'https://example.com/2.jpg' },
      ],
    };
    const files = attachedFiles(message);
    expect(files).toHaveLength(2);
    expect((files[0] as any).filename).toBe('first.png');
    expect((files[1] as any).filename).toBe('second.jpg');
  });
});

describe('computeRegenerateTarget', () => {
  it('returns null for an unknown message id', () => {
    const messages = [msg({ id: 'u1', role: 'user', text: 'hi' })];
    expect(computeRegenerateTarget(messages, 'missing')).toBeNull();
  });

  it('truncates through (inclusive) a user message target and resends its content', () => {
    const messages: AiConversationUIMessage[] = [
      msg({ id: 'u1', role: 'user', text: 'first' }),
      msg({ id: 'a1', role: 'assistant', text: 'reply 1' }),
      msg({ id: 'u2', role: 'user', text: 'second' }),
      msg({ id: 'a2', role: 'assistant', text: 'reply 2' }),
    ];
    const target = computeRegenerateTarget(messages, 'u2');
    expect(target).not.toBeNull();
    expect(target!.text).toBe('second');
    expect(target!.baseMessages).toEqual([messages[0], messages[1]]);
    expect(target!.isCompareEligible).toBe(true);
    expect(target!.files).toEqual([]);
  });

  it('includes file attachments from the user message target', () => {
    const userMsg: AiConversationUIMessage = {
      id: 'u1',
      role: 'user',
      parts: [
        { type: 'text', text: 'Look at this' },
        { type: 'file', mediaType: 'image/png', filename: 'pic.png', url: 'https://example.com/img.png' },
      ],
    };
    const messages: AiConversationUIMessage[] = [
      userMsg,
      msg({ id: 'a1', role: 'assistant', text: 'I see it' }),
    ];
    const target = computeRegenerateTarget(messages, 'u1');
    expect(target!.files).toHaveLength(1);
    expect((target!.files[0] as any).filename).toBe('pic.png');
  });

  it('excludes dropped attachments from regenerate files', () => {
    const userMsg: AiConversationUIMessage = {
      id: 'u1',
      role: 'user',
      parts: [
        { type: 'file', mediaType: 'image/png', filename: 'dropped.png', url: '' },
        { type: 'file', mediaType: 'image/jpeg', filename: 'kept.jpg', url: 'https://example.com/img.jpg' },
      ],
    };
    const messages: AiConversationUIMessage[] = [userMsg];
    const target = computeRegenerateTarget(messages, 'u1');
    expect(target!.files).toHaveLength(1);
    expect((target!.files[0] as any).filename).toBe('kept.jpg');
  });

  it('truncates through (exclusive) an assistant message target, keeping its preceding user message out of baseMessages and resending its content', () => {
    const messages: AiConversationUIMessage[] = [
      msg({ id: 'u1', role: 'user', text: 'first' }),
      msg({ id: 'a1', role: 'assistant', text: 'reply 1' }),
      msg({ id: 'u2', role: 'user', text: 'second' }),
      msg({ id: 'a2', role: 'assistant', text: 'reply 2' }),
    ];
    const target = computeRegenerateTarget(messages, 'a2');
    expect(target).not.toBeNull();
    expect(target!.text).toBe('second');
    expect(target!.baseMessages).toEqual([messages[0], messages[1]]);
    expect(target!.files).toEqual([]);
  });

  it('includes files from the user message when regenerating an assistant reply', () => {
    const userMsg: AiConversationUIMessage = {
      id: 'u1',
      role: 'user',
      parts: [
        { type: 'text', text: 'Check this' },
        { type: 'file', mediaType: 'image/png', filename: 'img.png', url: 'https://example.com/img.png' },
      ],
    };
    const messages: AiConversationUIMessage[] = [userMsg, msg({ id: 'a1', role: 'assistant', text: 'Got it' })];
    const target = computeRegenerateTarget(messages, 'a1');
    expect(target!.files).toHaveLength(1);
    expect((target!.files[0] as any).filename).toBe('img.png');
  });

  it('walks back to the user message sharing turnId, skipping other compare-mode assistant columns', () => {
    const messages: AiConversationUIMessage[] = [
      msg({ id: 'u1', role: 'user', text: 'compare this', turnId: 't1' }),
      msg({ id: 'a1', role: 'assistant', text: 'model A reply', turnId: 't1', compareModel: 'model-a' }),
      msg({ id: 'a2', role: 'assistant', text: 'model B reply', turnId: 't1', compareModel: 'model-b' }),
    ];
    const target = computeRegenerateTarget(messages, 'a2');
    expect(target).not.toBeNull();
    expect(target!.text).toBe('compare this');
    expect(target!.baseMessages).toEqual([]);
    expect(target!.isCompareEligible).toBe(true);
  });

  it('marks a plain (non-compare) assistant target as not compare-eligible', () => {
    const messages: AiConversationUIMessage[] = [
      msg({ id: 'u1', role: 'user', text: 'hello' }),
      msg({ id: 'a1', role: 'assistant', text: 'hi there' }),
    ];
    const target = computeRegenerateTarget(messages, 'a1');
    expect(target!.isCompareEligible).toBe(false);
  });

  it('returns null when an assistant message has no preceding user message', () => {
    const messages: AiConversationUIMessage[] = [msg({ id: 'a1', role: 'assistant', text: 'orphan reply' })];
    expect(computeRegenerateTarget(messages, 'a1')).toBeNull();
  });
});

describe('computeEditTarget', () => {
  it('truncates through (inclusive) the edited user message', () => {
    const messages: AiConversationUIMessage[] = [
      msg({ id: 'u1', role: 'user', text: 'first' }),
      msg({ id: 'a1', role: 'assistant', text: 'reply 1' }),
      msg({ id: 'u2', role: 'user', text: 'second' }),
      msg({ id: 'a2', role: 'assistant', text: 'reply 2' }),
    ];
    const target = computeEditTarget(messages, 'u2');
    expect(target).not.toBeNull();
    expect(target!.baseMessages).toEqual([messages[0], messages[1]]);
    expect(target!.files).toEqual([]);
  });

  it('includes file attachments from the edited user message', () => {
    const userMsg: AiConversationUIMessage = {
      id: 'u1',
      role: 'user',
      parts: [
        { type: 'text', text: 'Here is my image' },
        { type: 'file', mediaType: 'image/png', filename: 'screenshot.png', url: 'https://example.com/img.png' },
      ],
    };
    const messages: AiConversationUIMessage[] = [userMsg, msg({ id: 'a1', role: 'assistant', text: 'I see' })];
    const target = computeEditTarget(messages, 'u1');
    expect(target!.files).toHaveLength(1);
    expect((target!.files[0] as any).filename).toBe('screenshot.png');
  });

  it('excludes dropped attachments from edit target files', () => {
    const userMsg: AiConversationUIMessage = {
      id: 'u1',
      role: 'user',
      parts: [
        { type: 'file', mediaType: 'image/png', filename: 'dropped.png', url: '' },
        { type: 'file', mediaType: 'image/jpeg', filename: 'kept.jpg', url: 'https://example.com/kept.jpg' },
      ],
    };
    const messages: AiConversationUIMessage[] = [userMsg];
    const target = computeEditTarget(messages, 'u1');
    expect(target!.files).toHaveLength(1);
    expect((target!.files[0] as any).filename).toBe('kept.jpg');
  });

  it('returns null when the target is an assistant message', () => {
    const messages: AiConversationUIMessage[] = [
      msg({ id: 'u1', role: 'user', text: 'first' }),
      msg({ id: 'a1', role: 'assistant', text: 'reply 1' }),
    ];
    expect(computeEditTarget(messages, 'a1')).toBeNull();
  });

  it('returns null for an unknown message id', () => {
    const messages: AiConversationUIMessage[] = [msg({ id: 'u1', role: 'user', text: 'first' })];
    expect(computeEditTarget(messages, 'missing')).toBeNull();
  });
});
