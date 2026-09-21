import { EventEmitter } from 'events';
import { proxyUIMessageStream } from './uiMessageStream';

/**
 * Minimal stand-in for an express Response: `pipeUIMessageStreamToResponse`
 * writes SSE text through it via `write`/`end`, and it must be an
 * EventEmitter for the `res.on('close')` client-disconnect hook.
 */
class FakeResponse extends EventEmitter {
  statusCode = 200;
  headers: Record<string, string> = {};
  chunks: string[] = [];
  ended = false;
  private resolveEnd!: () => void;
  readonly finished: Promise<void>;

  constructor() {
    super();
    this.finished = new Promise(resolve => {
      this.resolveEnd = resolve;
    });
  }

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
  writeHead(_status: number, headers?: Record<string, string>) {
    if (headers) {
      for (const [k, v] of Object.entries(headers)) this.setHeader(k, v);
    }
    return this;
  }
  write(chunk: unknown) {
    this.chunks.push(decodeChunk(chunk));
    return true;
  }
  end() {
    this.ended = true;
    this.resolveEnd();
  }
  flushHeaders() {}
  get body() {
    return this.chunks.join('');
  }
}

const silentLogger = { error: () => {}, warn: () => {}, debug: () => {}, info: () => {} };

/** The AI SDK's response writer may hand us strings or Uint8Array/byte
 * arrays depending on the code path; normalize both to text so the captured
 * body is assertable as SSE. */
function decodeChunk(chunk: unknown): string {
  if (typeof chunk === 'string') return chunk;
  if (chunk instanceof Uint8Array) return new TextDecoder().decode(chunk);
  if (Array.isArray(chunk)) return new TextDecoder().decode(Uint8Array.from(chunk));
  return String(chunk);
}

/** Builds a Response whose body emits the given SSE frames, optionally
 * pausing between them (to exercise the idle timer). */
function sseResponse(
  frames: string[],
  opts: { delayMs?: number } = {},
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const frame of frames) {
        if (opts.delayMs) await new Promise(r => setTimeout(r, opts.delayMs));
        controller.enqueue(encoder.encode(frame));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function textFrame(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}

describe('proxyUIMessageStream', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('streams text deltas through as UI message chunks', async () => {
    globalThis.fetch = jest.fn(async () =>
      sseResponse([textFrame('Hello'), textFrame(' world'), 'data: [DONE]\n\n']),
    ) as any;

    const res = new FakeResponse();
    await proxyUIMessageStream({
      upstreamUrl: 'http://upstream/v1/chat/completions',
      upstreamBody: { model: 'm' },
      userKey: 'sk-test',
      res: res as any,
      logger: silentLogger,
    });
    await res.finished;

    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    expect(res.body).toContain('"text-delta"');
    expect(res.body).toContain('Hello');
    expect(res.body).toContain('world');
    expect(res.ended).toBe(true);
  });

  it('writes the prelude before contacting upstream', async () => {
    globalThis.fetch = jest.fn(async () => sseResponse([textFrame('hi')])) as any;

    const res = new FakeResponse();
    await proxyUIMessageStream({
      upstreamUrl: 'http://upstream',
      upstreamBody: {},
      userKey: 'k',
      res: res as any,
      logger: silentLogger,
      prelude: [{ type: 'data-citations', data: [{ filename: 'a.md', score: 1, text: 't' }] } as any],
    });
    await res.finished;

    expect(res.body).toContain('data-citations');
    expect(res.body).toContain('a.md');
  });

  it('surfaces a non-ok upstream response as an error chunk', async () => {
    globalThis.fetch = jest.fn(
      async () => new Response('bad key', { status: 401 }),
    ) as any;

    const res = new FakeResponse();
    await proxyUIMessageStream({
      upstreamUrl: 'http://upstream',
      upstreamBody: {},
      userKey: 'k',
      res: res as any,
      logger: silentLogger,
    });
    await res.finished;

    expect(res.body).toContain('upstream 401');
    expect(res.body).toContain('bad key');
  });

  it('does NOT cap total stream duration — a slow-but-progressing stream completes', async () => {
    // Each frame arrives well inside the (short) idle timeout, but the total
    // stream takes far longer than any single timeout window. This is the
    // regression the connect/idle split exists to prevent: a whole-request
    // timeout would kill this mid-answer.
    const frames = Array.from({ length: 6 }, (_, i) => textFrame(`t${i}`));
    globalThis.fetch = jest.fn(async () => sseResponse(frames, { delayMs: 40 })) as any;

    const res = new FakeResponse();
    await proxyUIMessageStream({
      upstreamUrl: 'http://upstream',
      upstreamBody: {},
      userKey: 'k',
      res: res as any,
      logger: silentLogger,
      connectTimeoutMs: 25,
      idleTimeoutMs: 100,
    });
    await res.finished;

    for (let i = 0; i < 6; i++) expect(res.body).toContain(`t${i}`);
    expect(res.body).not.toContain('timed out');
  });

  it('reports an idle timeout when upstream goes quiet mid-stream', async () => {
    const encoder = new TextEncoder();
    let release: () => void = () => {};
    const stalled = new Promise<void>(resolve => {
      release = resolve;
    });
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(textFrame('partial')));
        await stalled; // never resolves within the test's idle window
        controller.close();
      },
      cancel() {
        release();
      },
    });
    globalThis.fetch = jest.fn(
      async () => new Response(stream, { status: 200 }),
    ) as any;

    const res = new FakeResponse();
    await proxyUIMessageStream({
      upstreamUrl: 'http://upstream',
      upstreamBody: {},
      userKey: 'k',
      res: res as any,
      logger: silentLogger,
      connectTimeoutMs: 50,
      idleTimeoutMs: 40,
    });
    await res.finished;

    expect(res.body).toContain('partial');
    expect(res.body).toContain('timed out');
    release();
  });

  it('reports a connect timeout when upstream never responds', async () => {
    globalThis.fetch = jest.fn(
      (_url: any, init: any) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
    ) as any;

    const res = new FakeResponse();
    await proxyUIMessageStream({
      upstreamUrl: 'http://upstream',
      upstreamBody: {},
      userKey: 'k',
      res: res as any,
      logger: silentLogger,
      connectTimeoutMs: 30,
      idleTimeoutMs: 1000,
    });
    await res.finished;

    expect(res.body).toContain('upstream request timed out');
  });

  it('stays silent when the client disconnects during the connect phase', async () => {
    globalThis.fetch = jest.fn(
      (_url: any, init: any) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
    ) as any;

    const res = new FakeResponse();
    const pending = proxyUIMessageStream({
      upstreamUrl: 'http://upstream',
      upstreamBody: {},
      userKey: 'k',
      res: res as any,
      logger: silentLogger,
      connectTimeoutMs: 5000,
      idleTimeoutMs: 5000,
    });
    // Client goes away before upstream ever answers.
    res.emit('close');
    await pending;
    await res.finished;

    expect(res.body).not.toContain('timed out');
  });
});
