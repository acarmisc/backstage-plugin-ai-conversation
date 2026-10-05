import { withoutDroppedAttachments } from './aiSdkTransport';
import type { AiConversationUIMessage } from '../types';

describe('withoutDroppedAttachments', () => {
  it('removes file parts with empty url', () => {
    const messages: AiConversationUIMessage[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [
          { type: 'text', text: 'Hello' },
          { type: 'file', mediaType: 'image/png', filename: 'dropped.png', url: '' },
        ],
      },
    ];
    const filtered = withoutDroppedAttachments(messages);
    expect(filtered[0].parts).toHaveLength(1);
    expect(filtered[0].parts[0]).toEqual({ type: 'text', text: 'Hello' });
  });

  it('keeps file parts with non-empty url', () => {
    const messages: AiConversationUIMessage[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [
          { type: 'text', text: 'Hello' },
          { type: 'file', mediaType: 'image/png', filename: 'kept.png', url: 'https://example.com/img.png' },
        ],
      },
    ];
    const filtered = withoutDroppedAttachments(messages);
    expect(filtered[0].parts).toHaveLength(2);
    expect(filtered[0].parts[1]).toEqual({
      type: 'file',
      mediaType: 'image/png',
      filename: 'kept.png',
      url: 'https://example.com/img.png',
    });
  });

  it('returns the same message object when nothing to drop', () => {
    const messages: AiConversationUIMessage[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [
          { type: 'text', text: 'Hello' },
          { type: 'file', mediaType: 'image/png', filename: 'kept.png', url: 'https://example.com/img.png' },
        ],
      },
    ];
    const filtered = withoutDroppedAttachments(messages);
    expect(filtered[0]).toBe(messages[0]);
  });

  it('handles multiple messages with mixed file states', () => {
    const messages: AiConversationUIMessage[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [
          { type: 'file', mediaType: 'image/png', filename: 'dropped.png', url: '' },
          { type: 'file', mediaType: 'image/png', filename: 'kept.png', url: 'https://example.com/img.png' },
        ],
      },
      {
        id: 'm2',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Looking at your images...' },
          { type: 'file', mediaType: 'image/png', filename: 'dropped2.png', url: '' },
        ],
      },
    ];
    const filtered = withoutDroppedAttachments(messages);
    expect(filtered[0].parts).toHaveLength(1);
    expect(filtered[0].parts[0].type).toBe('file');
    expect((filtered[0].parts[0] as any).filename).toBe('kept.png');
    expect(filtered[1].parts).toHaveLength(1);
    expect(filtered[1].parts[0].type).toBe('text');
  });

  it('returns same message object when there are no file parts at all', () => {
    const messages: AiConversationUIMessage[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [{ type: 'text', text: 'Just text' }],
      },
    ];
    const filtered = withoutDroppedAttachments(messages);
    expect(filtered[0]).toBe(messages[0]);
  });

  it('removes all file parts if they all have empty urls', () => {
    const messages: AiConversationUIMessage[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [
          { type: 'file', mediaType: 'image/png', filename: 'dropped1.png', url: '' },
          { type: 'file', mediaType: 'image/jpeg', filename: 'dropped2.jpg', url: '' },
        ],
      },
    ];
    const filtered = withoutDroppedAttachments(messages);
    expect(filtered[0].parts).toHaveLength(0);
  });

  it('preserves text parts exactly', () => {
    const messages: AiConversationUIMessage[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [
          { type: 'text', text: 'First line' },
          { type: 'file', mediaType: 'image/png', filename: 'dropped.png', url: '' },
          { type: 'text', text: 'Second line' },
        ],
      },
    ];
    const filtered = withoutDroppedAttachments(messages);
    expect(filtered[0].parts).toHaveLength(2);
    expect((filtered[0].parts[0] as any).text).toBe('First line');
    expect((filtered[0].parts[1] as any).text).toBe('Second line');
  });

  it('handles data: URL file parts as if they have content', () => {
    const messages: AiConversationUIMessage[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [
          { type: 'file', mediaType: 'image/png', filename: 'inline.png', url: 'data:image/png;base64,ABC' },
        ],
      },
    ];
    const filtered = withoutDroppedAttachments(messages);
    expect(filtered[0].parts).toHaveLength(1);
    expect((filtered[0].parts[0] as any).url).toBe('data:image/png;base64,ABC');
  });

  it('preserves message metadata and other properties', () => {
    const messages: AiConversationUIMessage[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [
          { type: 'file', mediaType: 'image/png', filename: 'dropped.png', url: '' },
        ],
        metadata: { feedback: 'up', turnId: 't1' },
      },
    ];
    const filtered = withoutDroppedAttachments(messages);
    expect(filtered[0].metadata).toEqual({ feedback: 'up', turnId: 't1' });
  });
});
