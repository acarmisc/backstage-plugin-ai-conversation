// Mock the API and core-plugin-api BEFORE importing useChat
jest.mock('@backstage/core-plugin-api', () => ({
  useApi: jest.fn(() => ({
    listThreads: jest.fn(() => Promise.resolve([])),
    chatStream: jest.fn(() => ({ abort: jest.fn() })),
    saveThread: jest.fn(() => Promise.resolve()),
    getKeySpend: jest.fn(() => Promise.resolve({ spend: 0, max_budget: null })),
    deleteChatKey: jest.fn(() => Promise.resolve()),
    deleteThread: jest.fn(() => Promise.resolve()),
  })),
}));

jest.mock('../api', () => ({
  liteLlmChatApiRef: { id: 'mock' },
}));

import { renderHook, act } from '@testing-library/react';
import { useChat, type UseChatOptions } from './useChat';

describe('useChat', () => {
  function makeOpts(partial: Partial<UseChatOptions> = {}): UseChatOptions {
    return {
      userId: 'user-123',
      model: 'claude-3-5-sonnet',
      vectorStoreIds: ['vs1'],
      personaId: 'oo-analyst',
      customSystemPrompt: 'Be helpful',
      toneId: 'tone-professional',
      focusId: 'focus-detail',
      verbosityId: 'verbosity-concise',
      reasoningEffort: 'high',
      keyAlias: 'chat-key-123',
      keyToken: 'sk-chat-secret',
      webSearch: true,
      ...partial,
    };
  }

  it('auto-creates a thread with trait selection fields when key is available', () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useChat(opts));

    const activeThread = result.current.activeThread;
    expect(activeThread).not.toBeNull();
    expect(activeThread?.toneId).toBe('tone-professional');
    expect(activeThread?.focusId).toBe('focus-detail');
    expect(activeThread?.verbosityId).toBe('verbosity-concise');
    expect(activeThread?.reasoningEffort).toBe('high');
    expect(activeThread?.webSearch).toBe(true);
    expect(activeThread?.mode).toBe('single');
    expect(activeThread?.compareModels).toEqual([]);
  });

  it('newThread creates a thread with trait selection fields populated', () => {
    const opts = makeOpts({
      toneId: 'tone-casual',
      focusId: 'focus-summary',
      verbosityId: 'verbosity-verbose',
      reasoningEffort: 'medium',
      webSearch: false,
    });

    const { result } = renderHook(() => useChat(opts));

    act(() => {
      result.current.newThread();
    });

    const activeThread = result.current.activeThread;
    expect(activeThread).not.toBeNull();
    expect(activeThread?.toneId).toBe('tone-casual');
    expect(activeThread?.focusId).toBe('focus-summary');
    expect(activeThread?.verbosityId).toBe('verbosity-verbose');
    expect(activeThread?.reasoningEffort).toBe('medium');
    expect(activeThread?.webSearch).toBe(false);
    expect(activeThread?.mode).toBe('single');
    expect(activeThread?.compareModels).toEqual([]);
  });

  it('includes empty trait values in new thread when they are not set', () => {
    const opts = makeOpts({
      toneId: '',
      focusId: '',
      verbosityId: '',
      reasoningEffort: '',
      webSearch: false,
    });

    const { result } = renderHook(() => useChat(opts));

    act(() => {
      result.current.newThread();
    });

    const activeThread = result.current.activeThread;
    expect(activeThread).not.toBeNull();
    expect(activeThread?.toneId).toBe('');
    expect(activeThread?.focusId).toBe('');
    expect(activeThread?.verbosityId).toBe('');
    expect(activeThread?.reasoningEffort).toBeUndefined();
    expect(activeThread?.webSearch).toBe(false);
  });
});
