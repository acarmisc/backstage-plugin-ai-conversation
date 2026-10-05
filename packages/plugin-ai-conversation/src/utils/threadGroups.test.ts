import { threadMatchesQuery, groupThreadsByDate } from './threadGroups';
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
    createdAt: Date.now(),
    updatedAt: Date.now(),
    totalTokens: 0,
    lastTurnUsage: null,
    ...overrides,
  };
}

describe('threadMatchesQuery', () => {
  it('returns true when query is empty', () => {
    const thread = createTestThread({ title: 'any title' });
    expect(threadMatchesQuery(thread, '')).toBe(true);
    expect(threadMatchesQuery(thread, '   ')).toBe(true);
  });

  it('matches title case-insensitively', () => {
    const thread = createTestThread({ title: 'Hello World' });
    expect(threadMatchesQuery(thread, 'hello')).toBe(true);
    expect(threadMatchesQuery(thread, 'HELLO')).toBe(true);
    expect(threadMatchesQuery(thread, 'world')).toBe(true);
  });

  it('matches message content case-insensitively', () => {
    const thread = createTestThread({
      messages: [
        {
          id: 'm1',
          role: 'user',
          parts: [{ type: 'text', text: 'Tell me about React' }],
        },
      ],
    });
    expect(threadMatchesQuery(thread, 'react')).toBe(true);
    expect(threadMatchesQuery(thread, 'REACT')).toBe(true);
  });

  it('returns false when query does not match', () => {
    const thread = createTestThread({ title: 'Hello World' });
    expect(threadMatchesQuery(thread, 'notfound')).toBe(false);
  });

  it('searches across multiple messages', () => {
    const thread = createTestThread({
      messages: [
        { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'first' }] },
        { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'second' }] },
        { id: 'm3', role: 'user', parts: [{ type: 'text', text: 'third with keyword' }] },
      ],
    });
    expect(threadMatchesQuery(thread, 'keyword')).toBe(true);
  });
});

describe('groupThreadsByDate', () => {
  it('returns empty array for empty thread list', () => {
    const groups = groupThreadsByDate([]);
    expect(groups).toEqual([]);
  });

  it('groups pinned threads first regardless of date', () => {
    const now = Date.now();
    const oldDate = now - 60 * 24 * 60 * 60 * 1000; // 60 days ago

    const threads = [
      createTestThread({ id: 't1', title: 'Old unpinned', updatedAt: oldDate }),
      createTestThread({ id: 't2', title: 'Pinned old', pinned: true, updatedAt: oldDate }),
      createTestThread({ id: 't3', title: 'Today unpinned', updatedAt: now }),
    ];

    const groups = groupThreadsByDate(threads, now);
    const pinnedGroup = groups.find(g => g.key === 'pinned');
    const todayGroup = groups.find(g => g.key === 'today');

    expect(pinnedGroup?.threads[0].id).toBe('t2');
    expect(todayGroup?.threads[0].id).toBe('t3');
  });

  it('groups threads by today/yesterday/week/month/older', () => {
    const now = new Date();
    now.setHours(15, 30, 0, 0);
    const nowMs = now.getTime();

    const today = new Date(nowMs);
    today.setHours(10, 0, 0, 0);

    const yesterday = new Date(nowMs);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(10, 0, 0, 0);

    const threeDaysAgo = new Date(nowMs);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(10, 0, 0, 0);

    const fifteenDaysAgo = new Date(nowMs);
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    fifteenDaysAgo.setHours(10, 0, 0, 0);

    const sixtyDaysAgo = new Date(nowMs);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    sixtyDaysAgo.setHours(10, 0, 0, 0);

    const threads = [
      createTestThread({ id: 't1', title: 'Today', updatedAt: today.getTime() }),
      createTestThread({ id: 't2', title: 'Yesterday', updatedAt: yesterday.getTime() }),
      createTestThread({ id: 't3', title: 'Week', updatedAt: threeDaysAgo.getTime() }),
      createTestThread({ id: 't4', title: 'Month', updatedAt: fifteenDaysAgo.getTime() }),
      createTestThread({ id: 't5', title: 'Older', updatedAt: sixtyDaysAgo.getTime() }),
    ];

    const groups = groupThreadsByDate(threads, nowMs);
    const groupKeys = groups.map(g => g.key);

    expect(groupKeys).toContain('today');
    expect(groupKeys).toContain('yesterday');
    expect(groupKeys).toContain('week');
    expect(groupKeys).toContain('month');
    expect(groupKeys).toContain('older');
  });

  it('omits empty groups', () => {
    const now = Date.now();
    const threads = [createTestThread({ id: 't1', updatedAt: now })];

    const groups = groupThreadsByDate(threads, now);
    const keys = groups.map(g => g.key);

    expect(keys).toContain('today');
    expect(keys).not.toContain('yesterday');
    expect(keys).not.toContain('week');
    expect(keys).not.toContain('month');
    expect(keys).not.toContain('older');
  });

  it('sorts each group by updatedAt descending', () => {
    const now = Date.now();
    const time1 = now - 1000;
    const time2 = now - 2000;
    const time3 = now - 3000;

    const threads = [
      createTestThread({ id: 't1', updatedAt: time2 }),
      createTestThread({ id: 't2', updatedAt: time3 }),
      createTestThread({ id: 't3', updatedAt: time1 }),
    ];

    const groups = groupThreadsByDate(threads, now);
    const todayGroup = groups.find(g => g.key === 'today');

    expect(todayGroup?.threads.map(t => t.id)).toEqual(['t3', 't1', 't2']);
  });

  it('has correct labels for each group', () => {
    const now = Date.now();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(10, 0, 0, 0);

    const threads = [
      createTestThread({ id: 't1', updatedAt: now }),
      createTestThread({ id: 't2', updatedAt: yesterday.getTime() }),
    ];

    const groups = groupThreadsByDate(threads, now);
    const labels = groups.map(g => g.label);

    expect(labels).toContain('Today');
    expect(labels).toContain('Yesterday');
  });

  it('uses provided now parameter', () => {
    const baseDate = new Date(2025, 0, 15); // Jan 15, 2025
    baseDate.setHours(0, 0, 0, 0);
    const baseMs = baseDate.getTime();

    // One day before the provided 'now'
    const yesterday = new Date(baseDate);
    yesterday.setDate(yesterday.getDate() - 1);

    const threads = [createTestThread({ id: 't1', updatedAt: yesterday.getTime() })];

    const groups = groupThreadsByDate(threads, baseMs);
    const keys = groups.map(g => g.key);

    expect(keys).toContain('yesterday');
  });
});
