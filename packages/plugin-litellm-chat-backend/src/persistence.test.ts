import {
  computeExpiryCutoff,
  deleteThread,
  listThreads,
  mapThreadRow,
  MAX_THREAD_PAYLOAD_BYTES,
  MAX_THREAD_TITLE_LENGTH,
  purgeExpiredThreads,
  saveThread,
  serializeThreadPayload,
  ThreadPayloadTooLargeError,
  ThreadValidationError,
} from './persistence';

const CHAT_TABLE = 'chat_threads';

/** Minimal fake Knex query builder: enough chainable surface for
 * persistence.ts's insert/onConflict/merge, where/orderBy, and where/del
 * call shapes, without pulling in a real sqlite driver. */
function makeFakeDb(rows: unknown[] = []) {
  const calls: Record<string, unknown[][]> = {
    table: [],
    where: [],
    orderBy: [],
    insert: [],
    onConflict: [],
    merge: [],
    del: [],
  };
  const builder: any = {
    where: (...args: unknown[]) => {
      calls.where.push(args);
      return builder;
    },
    orderBy: (...args: unknown[]) => {
      calls.orderBy.push(args);
      return Promise.resolve(rows);
    },
    insert: (...args: unknown[]) => {
      calls.insert.push(args);
      return builder;
    },
    onConflict: (...args: unknown[]) => {
      calls.onConflict.push(args);
      return builder;
    },
    merge: (...args: unknown[]) => {
      calls.merge.push(args);
      return Promise.resolve();
    },
    del: (...args: unknown[]) => {
      calls.del.push(args);
      return Promise.resolve(rows.length);
    },
  };
  const db: any = (table: string) => {
    calls.table.push([table]);
    return builder;
  };
  db.fn = { now: () => 'NOW()' };
  db.__calls = calls;
  return db;
}

describe('serializeThreadPayload', () => {
  it('normalizes a valid body', () => {
    const result = serializeThreadPayload({
      title: '  My thread  ',
      pinned: true,
      data: { messages: [] },
    });
    expect(result.title).toBe('  My thread  '.slice(0, MAX_THREAD_TITLE_LENGTH));
    expect(result.pinned).toBe(true);
    expect(JSON.parse(result.data)).toEqual({ messages: [] });
  });

  it('defaults pinned to false when omitted', () => {
    const result = serializeThreadPayload({ title: 'x', data: {} });
    expect(result.pinned).toBe(false);
  });

  it('truncates an over-long title', () => {
    const longTitle = 'a'.repeat(MAX_THREAD_TITLE_LENGTH + 50);
    const result = serializeThreadPayload({ title: longTitle, data: {} });
    expect(result.title).toHaveLength(MAX_THREAD_TITLE_LENGTH);
  });

  it('rejects a missing body', () => {
    expect(() => serializeThreadPayload(undefined as any)).toThrow(ThreadValidationError);
  });

  it('rejects a missing/blank title', () => {
    expect(() => serializeThreadPayload({ title: '', data: {} } as any)).toThrow(
      ThreadValidationError,
    );
    expect(() => serializeThreadPayload({ title: '   ', data: {} } as any)).toThrow(
      ThreadValidationError,
    );
  });

  it('rejects a missing data field', () => {
    expect(() => serializeThreadPayload({ title: 'x' } as any)).toThrow(ThreadValidationError);
  });

  it('rejects a payload over the size cap', () => {
    const data = { blob: 'x'.repeat(MAX_THREAD_PAYLOAD_BYTES + 1) };
    expect(() => serializeThreadPayload({ title: 'x', data })).toThrow(
      ThreadPayloadTooLargeError,
    );
  });
});

describe('mapThreadRow', () => {
  it('parses JSON data and normalizes types', () => {
    const record = mapThreadRow({
      id: 't1',
      title: 'Thread 1',
      pinned: 1,
      data: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    });
    expect(record).toEqual({
      id: 't1',
      title: 'Thread 1',
      pinned: true,
      data: { messages: [{ role: 'user', content: 'hi' }] },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('falls back to null data on corrupt JSON rather than throwing', () => {
    const record = mapThreadRow({
      id: 't1',
      title: 'Thread 1',
      pinned: 0,
      data: '{not json',
      created_at: new Date(),
      updated_at: new Date(),
    });
    expect(record.data).toBeNull();
    expect(record.pinned).toBe(false);
  });
});

describe('computeExpiryCutoff', () => {
  const now = new Date('2026-08-19T00:00:00.000Z');

  it('returns null for ttlDays 0 (unlimited retention)', () => {
    expect(computeExpiryCutoff(0, now)).toBeNull();
  });

  it('returns null for a negative ttlDays', () => {
    expect(computeExpiryCutoff(-5, now)).toBeNull();
  });

  it('computes now-minus-N-days for a positive ttlDays', () => {
    const cutoff = computeExpiryCutoff(30, now);
    expect(cutoff).toEqual(new Date('2026-07-20T00:00:00.000Z'));
  });
});

describe('listThreads', () => {
  it('queries by user_ref, orders by updated_at desc, and maps rows', async () => {
    const rows = [
      {
        id: 't1',
        title: 'Thread 1',
        pinned: 0,
        data: '{"a":1}',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ];
    const db = makeFakeDb(rows);
    const result = await listThreads(db, 'user:default/jane');

    expect(db.__calls.table).toEqual([[CHAT_TABLE]]);
    expect(db.__calls.where).toEqual([['user_ref', 'user:default/jane']]);
    expect(db.__calls.orderBy).toEqual([['updated_at', 'desc']]);
    expect(result).toEqual([
      {
        id: 't1',
        title: 'Thread 1',
        pinned: false,
        data: { a: 1 },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
  });
});

describe('saveThread', () => {
  it('upserts on (id, user_ref) via onConflict/merge', async () => {
    const db = makeFakeDb();
    await saveThread(db, 'user:default/jane', 't1', { title: 'Hi', pinned: true, data: { x: 1 } });

    expect(db.__calls.table).toEqual([[CHAT_TABLE]]);
    expect(db.__calls.insert[0][0]).toMatchObject({
      id: 't1',
      user_ref: 'user:default/jane',
      title: 'Hi',
      pinned: true,
    });
    expect(db.__calls.onConflict).toEqual([[['id', 'user_ref']]]);
    expect(db.__calls.merge[0][0]).toMatchObject({ title: 'Hi', pinned: true });
  });

  it('rejects an empty id', async () => {
    const db = makeFakeDb();
    await expect(saveThread(db, 'user:default/jane', '', { title: 'Hi', data: {} })).rejects.toThrow(
      ThreadValidationError,
    );
  });

  it('propagates payload validation errors', async () => {
    const db = makeFakeDb();
    await expect(
      saveThread(db, 'user:default/jane', 't1', { title: '', data: {} } as any),
    ).rejects.toThrow(ThreadValidationError);
  });
});

describe('deleteThread', () => {
  it('deletes scoped to (id, user_ref)', async () => {
    const db = makeFakeDb();
    await deleteThread(db, 'user:default/jane', 't1');

    expect(db.__calls.table).toEqual([[CHAT_TABLE]]);
    expect(db.__calls.where).toEqual([[{ id: 't1', user_ref: 'user:default/jane' }]]);
    expect(db.__calls.del).toHaveLength(1);
  });
});

describe('purgeExpiredThreads', () => {
  it('no-ops and issues no delete when ttlDays is 0', async () => {
    const db = makeFakeDb();
    const count = await purgeExpiredThreads(db, 0);
    expect(count).toBe(0);
    expect(db.__calls.table).toHaveLength(0);
  });

  it('deletes rows older than the cutoff when ttlDays is positive', async () => {
    const db = makeFakeDb([{}, {}]);
    const count = await purgeExpiredThreads(db, 30);
    expect(count).toBe(2);
    expect(db.__calls.table).toEqual([[CHAT_TABLE]]);
    expect(db.__calls.where[0][0]).toBe('updated_at');
    expect(db.__calls.where[0][1]).toBe('<');
    expect(db.__calls.where[0][2]).toBeInstanceOf(Date);
  });
});
