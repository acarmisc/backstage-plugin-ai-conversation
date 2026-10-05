import { threadToMarkdown, downloadFile } from './threadMarkdown';
import type { Thread } from '../types';

function createTestThread(overrides?: Partial<Thread>): Thread {
  return {
    id: 't1',
    title: 'Test Thread',
    messages: [],
    model: 'claude-3-5-sonnet',
    vectorStoreIds: [],
    customSystemPrompt: '',
    keyAlias: 'alias',
    keyToken: 'token',
    createdAt: 1640000000000, // 2021-12-20
    updatedAt: 1640000000000,
    totalTokens: 0,
    lastTurnUsage: null,
    ...overrides,
  };
}

describe('threadToMarkdown', () => {
  it('includes title as h1', () => {
    const thread = createTestThread();
    const md = threadToMarkdown(thread);
    expect(md).toContain('# Test Thread');
  });

  it('includes model and date in metadata line', () => {
    const thread = createTestThread();
    const md = threadToMarkdown(thread);
    expect(md).toContain('**Model:** claude-3-5-sonnet');
    expect(md).toContain('**Date:**');
  });

  it('formats user messages as **You:**', () => {
    const thread = createTestThread({
      messages: [
        {
          id: 'm1',
          role: 'user',
          parts: [{ type: 'text', text: 'hello' }],
        },
      ],
    });
    const md = threadToMarkdown(thread);
    expect(md).toContain('**You:** hello');
  });

  it('formats assistant messages with model label', () => {
    const thread = createTestThread({
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'hi there' }],
        },
      ],
    });
    const md = threadToMarkdown(thread);
    expect(md).toContain('**Assistant (claude-3-5-sonnet):** hi there');
  });

  it('includes compare model in label when present', () => {
    const thread = createTestThread({
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'response' }],
          metadata: { compareModel: 'gpt-4o' },
        },
      ],
    });
    const md = threadToMarkdown(thread);
    expect(md).toContain('**Assistant (gpt-4o):** response');
  });

  it('includes sources section after assistant message with citations', () => {
    const thread = createTestThread({
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'here is the answer' },
            {
              type: 'data-citations',
              data: [
                { filename: 'doc1.md', score: 0.9, snippet: 'relevant excerpt' },
                { filename: 'doc2.md', score: 0.8, snippet: 'another excerpt' },
              ],
            } as any,
          ],
        },
      ],
    });
    const md = threadToMarkdown(thread);
    expect(md).toContain('**Sources:**');
    expect(md).toContain('doc1.md');
    expect(md).toContain('relevant excerpt');
    expect(md).toContain('doc2.md');
    expect(md).toContain('another excerpt');
  });

  it('deduplicates sources by filename', () => {
    const thread = createTestThread({
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'answer' },
            {
              type: 'data-citations',
              data: [
                { filename: 'doc.md', score: 0.9, snippet: 'excerpt 1' },
                { filename: 'doc.md', score: 0.8, snippet: 'excerpt 2' },
              ],
            } as any,
          ],
        },
      ],
    });
    const md = threadToMarkdown(thread);
    const docMatches = md.match(/doc\.md/g);
    expect(docMatches?.length).toBe(1);
  });

  it('includes source labels (kb/web) when present', () => {
    const thread = createTestThread({
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'answer' },
            {
              type: 'data-citations',
              data: [
                { filename: 'doc.md', score: 0.9, snippet: 'excerpt', source: 'kb' },
                { filename: 'https://example.com', score: 0.8, snippet: 'web excerpt', source: 'web' },
              ],
            } as any,
          ],
        },
      ],
    });
    const md = threadToMarkdown(thread);
    expect(md).toContain('(kb)');
    expect(md).toContain('(web)');
  });

  it('handles multiple turns correctly', () => {
    const thread = createTestThread({
      messages: [
        { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'first question' }] },
        { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'first answer' }] },
        { id: 'm3', role: 'user', parts: [{ type: 'text', text: 'follow up' }] },
        { id: 'm4', role: 'assistant', parts: [{ type: 'text', text: 'second answer' }] },
      ],
    });
    const md = threadToMarkdown(thread);
    const userMatches = md.match(/\*\*You:\*\*/g);
    const assistantMatches = md.match(/\*\*Assistant/g);
    expect(userMatches?.length).toBe(2);
    expect(assistantMatches?.length).toBe(2);
  });
});

describe('downloadFile', () => {
  it('creates and triggers download via anchor element', () => {
    const createObjectURLSpy = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = jest.spyOn(URL, 'revokeObjectURL');

    // Create a real anchor element to test with
    const originalCreateElement = document.createElement.bind(document);
    const anchorElements: HTMLAnchorElement[] = [];

    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === 'a') {
        // Track created anchor elements
        const clickSpy = jest.spyOn(el, 'click');
        anchorElements.push(el);
      }
      return el;
    });

    downloadFile('test.txt', 'text/plain', 'hello world');

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    expect(anchorElements.length).toBeGreaterThan(0);

    const anchor = anchorElements[0];
    expect(anchor.download).toBe('test.txt');
    expect(anchor.href).toBe('blob:mock-url');

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    (document.createElement as any).mockRestore();
  });
});
