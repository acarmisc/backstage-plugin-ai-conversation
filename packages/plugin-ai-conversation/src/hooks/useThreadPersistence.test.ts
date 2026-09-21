import { loadThreads, newThreadsOnly, saveThreads } from './useThreadPersistence';
import type { Thread } from '../types';

function thread(id: string, extra: Partial<Thread> = {}): Thread {
  return {
    id,
    title: id,
    messages: [],
    model: 'm',
    vectorStoreIds: [],
    customSystemPrompt: '',
    keyAlias: '',
    keyToken: '',
    createdAt: 1,
    updatedAt: 1,
    totalTokens: 0,
    lastTurnUsage: null,
    ...extra,
  };
}

describe('loadThreads / saveThreads', () => {
  beforeEach(() => localStorage.clear());

  it('returns [] when nothing is stored', () => {
    expect(loadThreads('oidc')).toEqual([]);
  });

  it('round-trips a thread list', () => {
    saveThreads('oidc', [thread('t1')]);
    expect(loadThreads('oidc')).toEqual([thread('t1')]);
  });

  it('isolates buckets per userId', () => {
    saveThreads('oidc', [thread('t1')]);
    expect(loadThreads('other')).toEqual([]);
  });

  it('migrates legacy flat-content messages on load', () => {
    const legacy = {
      ...thread('t1'),
      messages: [{ id: 'm1', role: 'user', content: 'hi' }],
    };
    localStorage.setItem('ai-conversation:threads:oidc', JSON.stringify([legacy]));
    const [loaded] = loadThreads('oidc');
    expect(loaded.messages).toEqual([
      { id: 'm1', role: 'user', metadata: {}, parts: [{ type: 'text', text: 'hi' }] },
    ]);
  });

  it('returns [] rather than throwing on corrupt JSON', () => {
    localStorage.setItem('ai-conversation:threads:oidc', '{not json');
    expect(loadThreads('oidc')).toEqual([]);
  });
});

describe('newThreadsOnly', () => {
  it('keeps only entries whose id is not already present', () => {
    const prev = [thread('t1'), thread('t2')];
    const incoming = [thread('t2'), thread('t3')];
    expect(newThreadsOnly(prev, incoming).map(t => t.id)).toEqual(['t3']);
  });

  it('returns [] when everything is already present', () => {
    expect(newThreadsOnly([thread('t1')], [thread('t1')])).toEqual([]);
  });

  it('returns everything when prev is empty', () => {
    expect(newThreadsOnly([], [thread('t1')]).map(t => t.id)).toEqual(['t1']);
  });
});
