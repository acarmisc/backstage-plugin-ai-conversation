/**
 * Mock FetchApi implementation for the dev harness. Routes `/api/ai-conversation/...`
 * URLs to deterministic JSON responses so the real AiConversationApi from ../src/api
 * can be used unchanged without a running backend.
 */
import type { FetchApi } from '@backstage/core-plugin-api';

const now = Date.now();
const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(now - offsetDays * day).toISOString();

// Mock data
const vectorStores = [
  { id: 'vs-engineering-handbook', name: 'Engineering Handbook', file_count: 147, status: 'ready' },
  { id: 'vs-platform-runbooks', name: 'Platform Runbooks', file_count: 89, status: 'ready' },
  { id: 'vs-hr-policies', name: 'HR Policies', file_count: 34, status: 'ready' },
  { id: 'vs-product-docs', name: 'Product Documentation', file_count: 256, status: 'ready' },
];

const skills = [
  {
    id: 'component:default/code-reviewer-skill',
    title: 'Code Reviewer',
    description: 'Expert code review and architecture feedback',
    tags: ['development', 'code-quality'],
    defaultModel: 'gpt-4o',
    defaultVectorStoreIds: ['vs-engineering-handbook'],
  },
  {
    id: 'component:default/incident-commander-skill',
    title: 'Incident Commander',
    description: 'Incident response coordination and escalation',
    tags: ['operations', 'incident-response'],
    defaultModel: 'gpt-4o',
    defaultVectorStoreIds: ['vs-platform-runbooks'],
  },
  {
    id: 'component:default/technical-writer-skill',
    title: 'Technical Writer',
    description: 'Documentation and knowledge base author',
    tags: ['documentation', 'content'],
    defaultModel: 'claude-sonnet-4',
    defaultVectorStoreIds: [],
  },
  {
    id: 'component:default/data-analyst-skill',
    title: 'Data Analyst',
    description: 'SQL queries, data exploration, and reporting',
    tags: ['analytics', 'data'],
    defaultModel: 'claude-sonnet-4',
    defaultVectorStoreIds: [],
  },
  {
    id: 'component:default/hr-advisor-skill',
    title: 'HR Advisor',
    description: 'HR policies, benefits, and employee guidance',
    tags: ['hr', 'people'],
    defaultModel: 'gpt-4o-mini',
    defaultVectorStoreIds: ['vs-hr-policies'],
  },
];

const traits = {
  tones: [
    { id: 'friendly', label: 'Friendly' },
    { id: 'professional', label: 'Professional' },
    { id: 'casual', label: 'Casual' },
    { id: 'formal', label: 'Formal' },
  ],
  focuses: [
    { id: 'concise', label: 'Concise' },
    { id: 'detailed', label: 'Detailed' },
    { id: 'practical', label: 'Practical' },
    { id: 'theoretical', label: 'Theoretical' },
  ],
  verbosities: [
    { id: 'brief', label: 'Brief' },
    { id: 'normal', label: 'Normal' },
    { id: 'verbose', label: 'Verbose' },
  ],
};

// Realistic multi-turn conversation with markdown
const sampleThread1Messages = [
  {
    id: 'msg-1',
    role: 'user' as const,
    parts: [{ type: 'text' as const, text: 'Can you help me review this function signature for performance implications?' }],
    metadata: { turnId: 'turn-1' },
  },
  {
    id: 'msg-2',
    role: 'assistant' as const,
    parts: [
      {
        type: 'text' as const,
        text: `# Function Review Analysis

I'd be happy to help review the function signature. Here are the key performance considerations:

## Current Best Practices
- **Type hints**: Use full type annotations
- **Async/await**: Prefer async for I/O-bound operations
- **Memory efficiency**: Consider iterators for large datasets

## Optimization Opportunities
1. Add caching for repeated calculations
2. Use connection pooling for database queries
3. Consider lazy loading for heavy dependencies

### Example Implementation
\`\`\`typescript
async function processData(items: T[]): Promise<Result[]> {
  const cache = new Map();
  return Promise.all(
    items.map(item => computeWithCache(item, cache))
  );
}
\`\`\`

Would you like me to review your specific function?`,
      },
      { type: 'data-citations' as const, data: [
        { filename: 'engineering-handbook/performance.md', score: 0.92, snippet: 'Function signature optimization patterns...', source: 'kb' },
        { filename: 'engineering-handbook/async-patterns.md', score: 0.88, snippet: 'Async function best practices...', source: 'kb' },
      ] },
      { type: 'data-usage' as const, data: { prompt_tokens: 145, completion_tokens: 287, total_tokens: 432 } },
    ],
    metadata: { turnId: 'turn-1' },
  },
  {
    id: 'msg-3',
    role: 'user' as const,
    parts: [{ type: 'text' as const, text: 'What about memory usage for large arrays?' }],
    metadata: { turnId: 'turn-2' },
  },
  {
    id: 'msg-4',
    role: 'assistant' as const,
    parts: [
      {
        type: 'text' as const,
        text: `## Memory Usage Optimization

For large arrays, consider these approaches:

| Approach | Memory | Speed | Use Case |
|----------|--------|-------|----------|
| Array allocation | High | Fast | Small datasets |
| Generator functions | Low | Slower | Streaming data |
| Chunked processing | Medium | Medium | Large files |

**Recommendation**: Use generators for arrays >100MB to avoid heap exhaustion.`,
      },
      { type: 'data-usage' as const, data: { prompt_tokens: 89, completion_tokens: 156, total_tokens: 245 } },
    ],
    metadata: { turnId: 'turn-2' },
  },
];

const sampleThread2Messages = [
  {
    id: 'msg-1',
    role: 'user' as const,
    parts: [{ type: 'text' as const, text: 'What are the incident response procedures?' }],
    metadata: { turnId: 'turn-1' },
  },
  {
    id: 'msg-2',
    role: 'assistant' as const,
    parts: [
      {
        type: 'text' as const,
        text: `# Incident Response Procedures

## Escalation Path
1. **Severity P1**: Immediate VP notification
2. **Severity P2**: Manager notification within 5 min
3. **Severity P3**: Email summary at end of day`,
      },
      { type: 'data-citations' as const, data: [
        { filename: 'platform-runbooks/incident-procedures.md', score: 0.95, snippet: 'Follow this escalation path...', source: 'kb' },
      ] },
      { type: 'data-usage' as const, data: { prompt_tokens: 78, completion_tokens: 134, total_tokens: 212 } },
    ],
    metadata: { turnId: 'turn-1' },
  },
];

interface MockResponseInit {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: BodyInit;
}

// A native Response, so streamed bodies reach the AI SDK reader unchanged.
class MockResponse extends Response {
  constructor(body: string | null, init: MockResponseInit = {}) {
    super(init.body ?? body, {
      status: init.status ?? 200,
      statusText: init.statusText ?? 'OK',
      headers: init.headers ?? { 'content-type': 'application/json' },
    });
  }
}

const encoder = new TextEncoder();
const sse = (chunk: unknown) => encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`);

function mockAnswer(model: string, question: string, grounded: boolean): string {
  const topic = question.length > 80 ? `${question.slice(0, 77)}…` : question;
  return [
    `Here is how I would approach **${topic || 'this'}**${grounded ? ', based on the selected knowledge bases' : ''}.`,
    '',
    '### Summary',
    '',
    '1. **Start from the golden path.** The platform template already wires CI, observability and the service catalog entry.',
    '2. **Keep secrets out of the repo.** Use the secret manager integration and reference secrets by name.',
    '3. **Ship behind a flag.** Roll out progressively and watch the error budget on the service dashboard.',
    '',
    '```yaml',
    'apiVersion: backstage.io/v1alpha1',
    'kind: Component',
    'metadata:',
    '  name: payments-api',
    'spec:',
    '  type: service',
    '  lifecycle: production',
    '  owner: group:platform-engineering',
    '```',
    '',
    `| Step | Owner | Typical time |`,
    `| --- | --- | --- |`,
    `| Scaffold | You | 5 min |`,
    `| Review | Platform team | 1 day |`,
    `| Go live | You | 30 min |`,
    '',
    `_Answered by ${model} in the dev harness — no LiteLLM proxy involved._`,
  ].join('\n');
}

function streamMockAnswer(text: string, citations: unknown[] | null): ReadableStream<Uint8Array> {
  // Split on whitespace but keep it, so markdown line breaks survive.
  const tokens = text.match(/\S+\s*/g) ?? [text];
  return new ReadableStream({
    start(controller) {
      controller.enqueue(sse({ type: 'start' }));
      if (citations) controller.enqueue(sse({ type: 'data-citations', data: citations }));
      controller.enqueue(sse({ type: 'text-start', id: 'text-0' }));
      let i = 0;
      const tick = () => {
        if (i < tokens.length) {
          const delta = tokens.slice(i, i + 3).join('');
          i += 3;
          controller.enqueue(sse({ type: 'text-delta', id: 'text-0', delta }));
          setTimeout(tick, 25);
          return;
        }
        controller.enqueue(sse({ type: 'text-end', id: 'text-0' }));
        controller.enqueue(
          sse({
            type: 'data-usage',
            data: { prompt_tokens: 812, completion_tokens: 236, total_tokens: 1048 },
          }),
        );
        controller.enqueue(sse({ type: 'finish' }));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      };
      setTimeout(tick, 400);
    },
  });
}

export class MockFetchApi implements FetchApi {
  async fetch(input: string | Request, init?: RequestInit): Promise<Response> {
    // Convert URL to string if it's a Request
    const urlStr = typeof input === 'string' ? input : input.url;
    const url = new URL(urlStr, 'http://localhost');
    const path = url.pathname;
    const method = (typeof input === 'string' ? init?.method : input.method) ?? 'GET';

    // Route based on path
    if (path === '/api/ai-conversation/config' && method === 'GET') {
      return new MockResponse(
        JSON.stringify({
          defaultModel: 'gpt-4o',
          defaultVectorStoreIds: [],
          maxRequestBudget: 5,
          excludedModels: null,
          persistence: { enabled: true, ttlDays: 30 },
          teamRequired: true,
        }),
      );
    }

    if (path === '/api/ai-conversation/vector_stores' && method === 'GET') {
      return new MockResponse(JSON.stringify(vectorStores));
    }

    if (path === '/api/ai-conversation/skills' && method === 'GET') {
      return new MockResponse(JSON.stringify(skills));
    }

    if (path === '/api/ai-conversation/chat/traits' && method === 'GET') {
      return new MockResponse(JSON.stringify(traits));
    }

    if (path === '/api/ai-conversation/chat/key' && method === 'POST') {
      const alias = `chat-${Date.now()}`;
      return new MockResponse(
        JSON.stringify({
          key: `sk-mock-${Math.random().toString(36).slice(2, 20)}`,
          key_alias: alias,
          expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // like the backend's 3h keys
          max_budget: 5,
        }),
      );
    }

    if (path === '/api/ai-conversation/chat/key' && method === 'DELETE') {
      return new MockResponse(JSON.stringify({ success: true }));
    }

    if (path.match(/^\/api\/ai-conversation\/chat\/key\/[^/]+\/spend$/)) {
      return new MockResponse(
        JSON.stringify({
          spend: 0.4123,
          max_budget: 5,
        }),
      );
    }

    if (path === '/api/ai-conversation/fetch-context' && method === 'POST') {
      return new MockResponse(
        JSON.stringify({
          url: 'https://example.com/article',
          title: 'Example Article: Performance Best Practices',
          snippet: 'This article covers key performance optimization techniques for modern applications...',
          charCount: 8492,
        }),
      );
    }

    if (path === '/api/ai-conversation/feedback' && method === 'POST') {
      return new MockResponse(JSON.stringify({ success: true }));
    }

    if (path === '/api/ai-conversation/feedback/summary' && method === 'GET') {
      return new MockResponse(
        JSON.stringify({
          up: 247,
          down: 18,
        }),
      );
    }

    if (path === '/api/ai-conversation/usage/summary' && method === 'GET') {
      const groupBy = url.searchParams.get('groupBy') ?? 'skill';
      if (groupBy === 'skill') {
        return new MockResponse(
          JSON.stringify([
            { key: 'Code Reviewer', count: 94 },
            { key: 'Incident Commander', count: 67 },
            { key: 'Data Analyst', count: 45 },
            { key: 'Technical Writer', count: 38 },
            { key: 'HR Advisor', count: 23 },
          ]),
        );
      }
      return new MockResponse(
        JSON.stringify([
          { key: 'gpt-4o', count: 156 },
          { key: 'claude-sonnet-4', count: 89 },
          { key: 'gpt-4o-mini', count: 62 },
          { key: 'claude-haiku-3-5', count: 41 },
        ]),
      );
    }

    if (path === '/api/ai-conversation/threads' && method === 'GET') {
      return new MockResponse(
        JSON.stringify([
          {
            id: 'thread-1',
            title: 'Performance optimization for async functions',
            pinned: false,
            createdAt: iso(30),
            updatedAt: iso(0), // today
            data: {
              id: 'thread-1',
              title: 'Performance optimization for async functions',
              messages: sampleThread1Messages,
              model: 'gpt-4o',
              vectorStoreIds: ['vs-engineering-handbook'],
              customSystemPrompt: '',
              keyAlias: 'chat-jane-doe-1',
              keyToken: 'sk-mock-abc123',
              createdAt: now - 30 * day,
              updatedAt: now,
              totalTokens: 677,
              lastTurnUsage: { prompt_tokens: 89, completion_tokens: 156, total_tokens: 245 },
            },
          },
          {
            id: 'thread-2',
            title: 'Incident response procedures',
            pinned: true,
            createdAt: iso(7),
            updatedAt: iso(1),
            data: {
              id: 'thread-2',
              title: 'Incident response procedures',
              messages: sampleThread2Messages,
              model: 'gpt-4o',
              vectorStoreIds: ['vs-platform-runbooks'],
              customSystemPrompt: '',
              keyAlias: 'chat-jane-doe-2',
              keyToken: 'sk-mock-def456',
              createdAt: now - 7 * day,
              updatedAt: now - day,
              totalTokens: 290,
              lastTurnUsage: { prompt_tokens: 78, completion_tokens: 134, total_tokens: 212 },
            },
          },
          {
            id: 'thread-3',
            title: 'SQL query optimization',
            pinned: false,
            createdAt: iso(14),
            updatedAt: iso(5),
            data: {
              id: 'thread-3',
              title: 'SQL query optimization',
              messages: [
                {
                  id: 'msg-1',
                  role: 'user' as const,
                  parts: [{ type: 'text' as const, text: 'Help me optimize this slow query' }],
                  metadata: { turnId: 'turn-1' },
                },
              ],
              model: 'claude-sonnet-4',
              vectorStoreIds: [],
              customSystemPrompt: '',
              keyAlias: 'chat-jane-doe-3',
              keyToken: 'sk-mock-ghi789',
              createdAt: now - 14 * day,
              updatedAt: now - 5 * day,
              totalTokens: 156,
              lastTurnUsage: null,
            },
          },
        ]),
      );
    }

    if (path.match(/^\/api\/ai-conversation\/threads\/[^/]+$/) && method === 'PUT') {
      return new MockResponse(JSON.stringify({ success: true }));
    }

    if (path.match(/^\/api\/ai-conversation\/threads\/[^/]+$/) && method === 'DELETE') {
      return new MockResponse(JSON.stringify({ success: true }));
    }

    // Chat streaming endpoint
    if (path === '/api/ai-conversation/chat/stream/v2' && method === 'POST') {
      const body = init?.body ? JSON.parse(typeof init.body === 'string' ? init.body : '') : {};
      const model = body.model ?? 'unknown';

      const lastUser = [...(body.messages ?? [])].reverse().find((m: any) => m.role === 'user');
      const question: string = (lastUser?.parts ?? [])
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join(' ')
        .trim();
      const grounded = Array.isArray(body.vector_store_ids) && body.vector_store_ids.length > 0;
      const citations = grounded
        ? [
            { filename: 'golden-path/service-template.md', score: 0.86, text: 'Every new service starts from the golden-path template: CI, dashboards and the catalog entry are created for you.', source: 'kb' },
            { filename: 'security/secrets.md', score: 0.74, text: 'Never commit secrets. Reference them by name from the secret manager; rotation is automatic.', source: 'kb' },
            { filename: 'runbooks/progressive-delivery.md', score: 0.52, text: 'Roll out behind a feature flag and watch the error budget before ramping to 100%.', source: 'kb' },
          ]
        : null;

      return new MockResponse(null, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'x-vercel-ai-ui-message-stream': 'v1',
          'cache-control': 'no-cache',
        },
        body: streamMockAnswer(mockAnswer(model, question, grounded), citations),
      });
    }

    // Fallback 404
    return new MockResponse(JSON.stringify({ error: `Not found: ${path}` }), { status: 404 });
  }
}
