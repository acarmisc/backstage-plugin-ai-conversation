import { fromPersisted, toSaveThreadBody } from './threadPersistence';
import type { PersistedThread, Thread } from '../types';

function makeThread(partial: Partial<Thread> = {}): Thread {
  return {
    id: 't1',
    title: 'My thread',
    messages: [{ id: 'm1', role: 'user', content: 'hi' }],
    model: 'claude-3-5-sonnet',
    vectorStoreIds: ['vs1'],
    personaId: '',
    customSystemPrompt: '',
    keyAlias: 'chat-jane-123',
    keyToken: 'sk-secret',
    createdAt: 1000,
    updatedAt: 2000,
    totalTokens: 42,
    lastTurnUsage: null,
    pinned: true,
    ...partial,
  };
}

describe('toSaveThreadBody', () => {
  it('strips the live keyToken/keyAlias credential', () => {
    const body = toSaveThreadBody(makeThread());
    expect(body.data).not.toHaveProperty('keyToken');
    expect(body.data).not.toHaveProperty('keyAlias');
  });

  it('surfaces title/pinned at the top level for the backend to index on', () => {
    const body = toSaveThreadBody(makeThread({ title: 'Hello', pinned: false }));
    expect(body.title).toBe('Hello');
    expect(body.pinned).toBe(false);
  });

  it('coerces a missing pinned to false', () => {
    const thread = makeThread();
    delete (thread as any).pinned;
    const body = toSaveThreadBody(thread);
    expect(body.pinned).toBe(false);
  });

  it('preserves the rest of the thread payload (messages, model, KBs, usage)', () => {
    const thread = makeThread();
    const body = toSaveThreadBody(thread);
    expect(body.data).toMatchObject({
      id: thread.id,
      messages: thread.messages,
      model: thread.model,
      vectorStoreIds: thread.vectorStoreIds,
      totalTokens: thread.totalTokens,
    });
  });
});

describe('fromPersisted', () => {
  it('restores the thread with empty keyToken/keyAlias', () => {
    const thread = makeThread();
    const { keyToken: _t, keyAlias: _a, ...data } = thread;
    const persisted: PersistedThread = {
      id: thread.id,
      title: thread.title,
      pinned: !!thread.pinned,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      data,
    };
    const restored = fromPersisted(persisted);
    expect(restored.keyToken).toBe('');
    expect(restored.keyAlias).toBe('');
    expect(restored.messages).toEqual(thread.messages);
    expect(restored.model).toBe(thread.model);
  });

  it('round-trips through toSaveThreadBody/fromPersisted (minus the live key)', () => {
    const original = makeThread();
    const body = toSaveThreadBody(original);
    const persisted: PersistedThread = {
      id: original.id,
      title: body.title,
      pinned: body.pinned,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      data: body.data,
    };
    const restored = fromPersisted(persisted);
    expect(restored).toEqual({ ...original, keyToken: '', keyAlias: '' });
  });

  it('survives a null data payload (corrupt DB row) instead of crashing', () => {
    const restored = fromPersisted({
      id: 't1',
      title: 'Recoverable title',
      pinned: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      data: null as any,
    });
    expect(restored.id).toBe('t1');
    expect(restored.title).toBe('Recoverable title');
    expect(restored.pinned).toBe(true);
    expect(restored.messages).toEqual([]);
    expect(restored.keyToken).toBe('');
    expect(restored.keyAlias).toBe('');
    expect(typeof restored.updatedAt).toBe('number');
  });

  it('survives a non-object data payload without leaking its keys', () => {
    const restored = fromPersisted({
      id: 't1',
      title: 'Fallback',
      pinned: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      data: 'garbage' as any,
    });
    expect(restored.title).toBe('Fallback');
    expect(restored.messages).toEqual([]);
    expect(restored.model).toBe('');
    expect((restored as any)['0']).toBeUndefined();
  });

  it('rejects a blank title by falling back to the row title', () => {
    const restored = fromPersisted({
      id: 't1',
      title: 'Fallback',
      pinned: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      data: { id: 't1', title: '', messages: [] } as any,
    });
    expect(restored.title).toBe('Fallback');
  });
});
