import {
  parseLiteLLMChunk,
  toUIMessageChunks,
} from './uiMessageStream';

describe('parseLiteLLMChunk', () => {
  describe('delta parsing', () => {
    it('extracts content from choices[0].delta.content', () => {
      const raw = {
        choices: [{ delta: { content: 'hello' } }],
      };
      const result = parseLiteLLMChunk(raw);
      expect(result).toEqual({ delta: 'hello' });
    });

    it('falls back to reasoning_content when content is missing', () => {
      const raw = {
        choices: [{ delta: { reasoning_content: 'thinking...' } }],
      };
      const result = parseLiteLLMChunk(raw);
      expect(result).toEqual({ delta: 'thinking...' });
    });

    it('prefers content over reasoning_content when both present', () => {
      const raw = {
        choices: [{ delta: { content: 'text', reasoning_content: 'thinking' } }],
      };
      const result = parseLiteLLMChunk(raw);
      expect(result).toEqual({ delta: 'text' });
    });

    it('returns null for role-only delta (no content)', () => {
      const raw = {
        choices: [{ delta: { role: 'assistant' } }],
      };
      const result = parseLiteLLMChunk(raw);
      expect(result).toBeNull();
    });

    it('returns null for missing choices', () => {
      const raw = {};
      const result = parseLiteLLMChunk(raw);
      expect(result).toBeNull();
    });

    it('returns null for null/undefined delta', () => {
      const raw = {
        choices: [{ delta: null }],
      };
      const result = parseLiteLLMChunk(raw);
      expect(result).toBeNull();
    });
  });

  describe('search_results parsing', () => {
    it('parses search results array with all fields', () => {
      const raw = {
        search_results: [
          { filename: 'doc.md', score: 0.95, text: 'some text' },
          { filename: 'doc2.md', score: 0.8, text: 'more text' },
        ],
      };
      const result = parseLiteLLMChunk(raw);
      expect(result).toEqual({
        searchResults: [
          { filename: 'doc.md', score: 0.95, text: 'some text' },
          { filename: 'doc2.md', score: 0.8, text: 'more text' },
        ],
      });
    });

    it('falls back to file_name when filename missing', () => {
      const raw = {
        search_results: [
          { file_name: 'doc.md', score: 0.95, text: 'text' },
        ],
      };
      const result = parseLiteLLMChunk(raw);
      expect(result.searchResults[0].filename).toBe('doc.md');
    });

    it('falls back to title then source then name for filename', () => {
      const raw = {
        search_results: [
          { title: 'Article', score: 0.95, text: 'text' },
          { source: 'http://example.com', score: 0.8, text: 'text' },
          { name: 'resource', score: 0.7, text: 'text' },
        ],
      };
      const result = parseLiteLLMChunk(raw);
      expect(result.searchResults[0].filename).toBe('Article');
      expect(result.searchResults[1].filename).toBe('http://example.com');
      expect(result.searchResults[2].filename).toBe('resource');
    });

    it('defaults to empty string for missing filename and fallbacks', () => {
      const raw = {
        search_results: [
          { score: 0.95, text: 'text' },
        ],
      };
      const result = parseLiteLLMChunk(raw);
      expect(result.searchResults[0].filename).toBe('');
    });

    it('falls back to snippet then content for text', () => {
      const raw = {
        search_results: [
          { filename: 'doc.md', score: 0.95, snippet: 'snippet text' },
          { filename: 'doc2.md', score: 0.8, content: 'content text' },
        ],
      };
      const result = parseLiteLLMChunk(raw);
      expect(result.searchResults[0].text).toBe('snippet text');
      expect(result.searchResults[1].text).toBe('content text');
    });

    it('defaults to empty string for missing text and fallbacks', () => {
      const raw = {
        search_results: [
          { filename: 'doc.md', score: 0.95 },
        ],
      };
      const result = parseLiteLLMChunk(raw);
      expect(result.searchResults[0].text).toBe('');
    });

    it('defaults score to 0 for non-numeric score', () => {
      const raw = {
        search_results: [
          { filename: 'doc.md', score: 'not-a-number', text: 'text' },
        ],
      };
      const result = parseLiteLLMChunk(raw);
      expect(result.searchResults[0].score).toBe(0);
    });

    it('ignores non-array search_results', () => {
      const raw = {
        search_results: { filename: 'doc.md', score: 0.95, text: 'text' },
      };
      const result = parseLiteLLMChunk(raw);
      // No other content on this chunk either, so the whole chunk is dropped
      // (matches "role-only delta" behavior — nothing worth emitting).
      expect(result).toBeNull();
    });
  });

  describe('usage parsing', () => {
    it('parses usage info with all fields', () => {
      const raw = {
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };
      const result = parseLiteLLMChunk(raw);
      expect(result).toEqual({
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      });
    });

    it('defaults missing usage fields to 0', () => {
      const raw = {
        usage: {
          prompt_tokens: 5,
        },
      };
      const result = parseLiteLLMChunk(raw);
      expect(result).toEqual({
        usage: {
          prompt_tokens: 5,
          completion_tokens: 0,
          total_tokens: 0,
        },
      });
    });

    it('ignores non-object usage', () => {
      const raw = {
        usage: 'not-an-object',
      };
      const result = parseLiteLLMChunk(raw);
      expect(result).toBeNull();
    });

    it('ignores null usage', () => {
      const raw = {
        usage: null,
      };
      const result = parseLiteLLMChunk(raw);
      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('extracts error from top-level error field', () => {
      const raw = {
        error: 'Something went wrong',
      };
      const result = parseLiteLLMChunk(raw);
      expect(result).toEqual({ error: 'Something went wrong' });
    });

    it('coerces non-string error to string', () => {
      const raw = {
        error: { message: 'Error object' },
      };
      const result = parseLiteLLMChunk(raw);
      expect(result.error).toBe('[object Object]');
    });

    it('returns early with error, ignoring other fields', () => {
      const raw = {
        error: 'Failed',
        choices: [{ delta: { content: 'this should be ignored' } }],
        search_results: [{ filename: 'doc.md', score: 0.95, text: 'also ignored' }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      };
      const result = parseLiteLLMChunk(raw);
      expect(result).toEqual({ error: 'Failed' });
    });
  });

  describe('combined/mixed chunks', () => {
    it('combines delta, search_results, and usage', () => {
      const raw = {
        choices: [{ delta: { content: 'text' } }],
        search_results: [{ filename: 'doc.md', score: 0.9, text: 'content' }],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      };
      const result = parseLiteLLMChunk(raw);
      expect(result).toEqual({
        delta: 'text',
        searchResults: [{ filename: 'doc.md', score: 0.9, text: 'content' }],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      });
    });

    it('returns null when nothing worth emitting', () => {
      const raw = {
        choices: [{ delta: {} }],
      };
      const result = parseLiteLLMChunk(raw);
      expect(result).toBeNull();
    });

    it('handles delta only without search_results or usage', () => {
      const raw = {
        choices: [{ delta: { content: 'hello' } }],
      };
      const result = parseLiteLLMChunk(raw);
      expect(result).toEqual({ delta: 'hello' });
    });
  });
});

describe('toUIMessageChunks', () => {
  describe('delta handling', () => {
    it('emits text-start and text-delta for first chunk with delta', () => {
      const chunk = { delta: 'hello' };
      const state = { textId: 'msg-0', textStarted: false };
      const result = toUIMessageChunks(chunk, state);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: 'text-start', id: 'msg-0' });
      expect(result[1]).toEqual({ type: 'text-delta', id: 'msg-0', delta: 'hello' });
      expect(state.textStarted).toBe(true);
    });

    it('emits only text-delta for subsequent chunks with delta', () => {
      const chunk = { delta: 'world' };
      const state = { textId: 'msg-0', textStarted: true };
      const result = toUIMessageChunks(chunk, state);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'text-delta', id: 'msg-0', delta: 'world' });
      expect(state.textStarted).toBe(true);
    });

    it('does not emit text chunks for chunk without delta', () => {
      const chunk = { searchResults: [] };
      const state = { textId: 'msg-0', textStarted: false };
      const result = toUIMessageChunks(chunk, state);

      expect(result.filter(c => c.type === 'text-start' || c.type === 'text-delta')).toHaveLength(0);
      expect(state.textStarted).toBe(false);
    });
  });

  describe('error handling', () => {
    it('emits only error and returns early', () => {
      const chunk = { error: 'Something failed' };
      const state = { textId: 'msg-0', textStarted: false };
      const result = toUIMessageChunks(chunk, state);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'error', errorText: 'Something failed' });
    });

    it('ignores delta and data when error is set', () => {
      const chunk = {
        error: 'Error message',
        delta: 'this should be ignored',
        searchResults: [{ filename: 'doc.md', score: 0.9, text: 'ignored' }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      };
      const state = { textId: 'msg-0', textStarted: false };
      const result = toUIMessageChunks(chunk, state);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('error');
    });

    it('does not mutate state when error occurs', () => {
      const chunk = { error: 'Error' };
      const state = { textId: 'msg-0', textStarted: false };
      toUIMessageChunks(chunk, state);

      expect(state.textStarted).toBe(false);
    });
  });

  describe('search results handling', () => {
    it('emits data-citations for searchResults', () => {
      const searchResults = [
        { filename: 'doc1.md', score: 0.95, text: 'content 1' },
        { filename: 'doc2.md', score: 0.85, text: 'content 2' },
      ];
      const chunk = { searchResults };
      const state = { textId: 'msg-0', textStarted: false };
      const result = toUIMessageChunks(chunk, state);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'data-citations',
        data: searchResults,
      });
    });

    it('emits data-citations for empty searchResults array', () => {
      const chunk = { searchResults: [] };
      const state = { textId: 'msg-0', textStarted: false };
      const result = toUIMessageChunks(chunk, state);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'data-citations',
        data: [],
      });
    });
  });

  describe('usage handling', () => {
    it('emits data-usage for usage info', () => {
      const usage = {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      };
      const chunk = { usage };
      const state = { textId: 'msg-0', textStarted: false };
      const result = toUIMessageChunks(chunk, state);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'data-usage',
        data: usage,
      });
    });
  });

  describe('mixed chunk types', () => {
    it('emits delta, citations, and usage in order', () => {
      const searchResults = [
        { filename: 'doc.md', score: 0.9, text: 'text' },
      ];
      const usage = {
        prompt_tokens: 5,
        completion_tokens: 10,
        total_tokens: 15,
      };
      const chunk = {
        delta: 'response text',
        searchResults,
        usage,
      };
      const state = { textId: 'msg-0', textStarted: false };
      const result = toUIMessageChunks(chunk, state);

      expect(result).toHaveLength(4);
      expect(result[0].type).toBe('text-start');
      expect(result[1].type).toBe('text-delta');
      expect(result[2].type).toBe('data-citations');
      expect(result[3].type).toBe('data-usage');
      expect(state.textStarted).toBe(true);
    });

    it('emits citations and usage without delta', () => {
      const searchResults = [
        { filename: 'doc.md', score: 0.9, text: 'text' },
      ];
      const usage = {
        prompt_tokens: 5,
        completion_tokens: 10,
        total_tokens: 15,
      };
      const chunk = {
        searchResults,
        usage,
      };
      const state = { textId: 'msg-0', textStarted: false };
      const result = toUIMessageChunks(chunk, state);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('data-citations');
      expect(result[1].type).toBe('data-usage');
      expect(state.textStarted).toBe(false);
    });
  });

  describe('empty chunk', () => {
    it('returns empty array for chunk with no fields set', () => {
      const chunk = {};
      const state = { textId: 'msg-0', textStarted: false };
      const result = toUIMessageChunks(chunk, state);

      expect(result).toEqual([]);
      expect(state.textStarted).toBe(false);
    });
  });

  describe('state mutation', () => {
    it('sets textStarted to true only on first delta chunk', () => {
      const state = { textId: 'msg-0', textStarted: false };

      // First delta chunk
      toUIMessageChunks({ delta: 'part 1' }, state);
      expect(state.textStarted).toBe(true);

      // Second delta chunk
      toUIMessageChunks({ delta: 'part 2' }, state);
      expect(state.textStarted).toBe(true);

      // Non-delta chunk
      toUIMessageChunks({ usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } }, state);
      expect(state.textStarted).toBe(true);
    });

    it('does not mutate state for error-only chunks', () => {
      const state = { textId: 'msg-0', textStarted: false };
      toUIMessageChunks({ error: 'Something failed' }, state);
      expect(state.textStarted).toBe(false);
    });

    it('does not mutate state for data-only chunks', () => {
      const state = { textId: 'msg-0', textStarted: false };
      toUIMessageChunks(
        {
          searchResults: [{ filename: 'doc.md', score: 0.9, text: 'text' }],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
        },
        state,
      );
      expect(state.textStarted).toBe(false);
    });
  });

  describe('textId handling', () => {
    it('uses correct textId for all text chunks', () => {
      const chunk = { delta: 'hello' };
      const state = { textId: 'custom-id-123', textStarted: false };
      const result = toUIMessageChunks(chunk, state);

      expect(result[0]).toEqual({ type: 'text-start', id: 'custom-id-123' });
      expect(result[1]).toEqual({ type: 'text-delta', id: 'custom-id-123', delta: 'hello' });
    });
  });
});
