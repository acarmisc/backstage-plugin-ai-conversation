import { citationsFromLastAssistant } from './citations';
import type { AiConversationUIMessage } from '../types';

const msg = (
  role: 'user' | 'assistant',
  parts: AiConversationUIMessage['parts'],
): AiConversationUIMessage => ({ id: Math.random().toString(36), role, parts });

describe('citationsFromLastAssistant', () => {
  it('maps the data-citations part of the last assistant message', () => {
    const messages = [
      msg('user', [{ type: 'text', text: 'q1' }]),
      msg('assistant', [
        { type: 'text', text: 'a1' },
        { type: 'data-citations', data: [{ filename: 'old.md', score: 0.5, text: 'old' }] } as any,
      ]),
      msg('user', [{ type: 'text', text: 'q2' }]),
      msg('assistant', [
        { type: 'text', text: 'a2' },
        {
          type: 'data-citations',
          data: [
            { filename: 'kb.md', score: 0.9, text: 'from the backend' },
            { filename: 'page', score: 0.4, snippet: 'web', url: 'https://example.com' },
          ],
        } as any,
      ]),
    ];

    expect(citationsFromLastAssistant(messages)).toEqual([
      { filename: 'kb.md', score: 0.9, snippet: 'from the backend', source: 'kb', url: undefined },
      { filename: 'page', score: 0.4, snippet: 'web', source: 'web', url: 'https://example.com' },
    ]);
  });

  it('skips a last answer without sources and uses the previous one', () => {
    const messages = [
      msg('assistant', [{ type: 'data-citations', data: [{ filename: 'a.md', score: 1, text: 'x' }] } as any]),
      msg('assistant', [{ type: 'text', text: 'no sources' }]),
    ];
    expect(citationsFromLastAssistant(messages).map(c => c.filename)).toEqual(['a.md']);
  });

  it('returns nothing when no answer has sources', () => {
    expect(citationsFromLastAssistant([msg('user', [{ type: 'text', text: 'hi' }])])).toEqual([]);
  });
});
