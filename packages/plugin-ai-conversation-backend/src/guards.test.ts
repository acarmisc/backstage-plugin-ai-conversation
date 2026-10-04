import {
  sanitizeUpstreamMessage,
  validateStreamRequest,
  validateSpendAlias,
  computeEffectiveBudget,
  validateModelsField,
  keyMatches,
  isChatKeyAlias,
} from './guards';
import { createHash } from 'node:crypto';

describe('sanitizeUpstreamMessage', () => {
  it('redacts sk-* API keys', () => {
    const msg = 'Error from LiteLLM with key sk-1234567890abcdefghij';
    const result = sanitizeUpstreamMessage(msg);
    expect(result).not.toContain('sk-1234567890abcdefghij');
    expect(result).toContain('sk-***');
  });

  it('redacts multiple sk-* keys', () => {
    const msg = 'Keys sk-aaa111 and sk-bbb222 both failed';
    const result = sanitizeUpstreamMessage(msg);
    expect(result).not.toContain('sk-aaa111');
    expect(result).not.toContain('sk-bbb222');
    expect(result.match(/sk-\*\*\*/g)).toHaveLength(2);
  });

  it('redacts Bearer tokens', () => {
    const msg = 'Auth failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const result = sanitizeUpstreamMessage(msg);
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(result).toContain('Bearer ***');
  });

  it('redacts Bearer tokens case-insensitively', () => {
    const msg = 'Failed with bearer token123';
    const result = sanitizeUpstreamMessage(msg);
    expect(result).toContain('Bearer ***');
  });

  it('truncates to 500 chars', () => {
    const longMsg = 'x'.repeat(600);
    const result = sanitizeUpstreamMessage(longMsg);
    expect(result.length).toBe(500);
  });

  it('returns Upstream error for non-string input', () => {
    expect(sanitizeUpstreamMessage(null)).toBe('Upstream error');
    expect(sanitizeUpstreamMessage(undefined)).toBe('Upstream error');
    expect(sanitizeUpstreamMessage(123)).toBe('Upstream error');
    expect(sanitizeUpstreamMessage({ msg: 'test' })).toBe('Upstream error');
  });

  it('returns Upstream error for empty string', () => {
    expect(sanitizeUpstreamMessage('')).toBe('Upstream error');
    expect(sanitizeUpstreamMessage('   ')).toBe('Upstream error');
  });

  it('handles messages with multiple redactions', () => {
    const msg = 'Error: sk-abc123 failed, bearer token123 also failed';
    const result = sanitizeUpstreamMessage(msg);
    expect(result).toContain('sk-***');
    expect(result).toContain('Bearer ***');
    expect(result).not.toContain('abc123');
    expect(result).not.toContain('token123');
  });
});

describe('validateStreamRequest', () => {
  const validBody = {
    model: 'claude-3-5-sonnet',
    messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
    user_key: 'sk-1234567890abcdefghij',
  };

  it('accepts valid body', () => {
    const result = validateStreamRequest(validBody);
    expect(result.ok).toBe(true);
  });

  it('rejects non-object body', () => {
    expect(validateStreamRequest(null).ok).toBe(false);
    expect(validateStreamRequest('string').ok).toBe(false);
    expect(validateStreamRequest(123).ok).toBe(false);
  });

  it('rejects missing or empty model', () => {
    const result1 = validateStreamRequest({ ...validBody, model: '' });
    expect(result1.ok).toBe(false);
    expect(result1.error).toContain('model');

    const result2 = validateStreamRequest({ ...validBody, model: undefined });
    expect(result2.ok).toBe(false);
  });

  it('rejects model > 200 chars', () => {
    const result = validateStreamRequest({
      ...validBody,
      model: 'a'.repeat(201),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('200');
  });

  it('rejects missing or empty messages', () => {
    const result1 = validateStreamRequest({ ...validBody, messages: [] });
    expect(result1.ok).toBe(false);

    const result2 = validateStreamRequest({ ...validBody, messages: undefined });
    expect(result2.ok).toBe(false);
  });

  it('rejects messages > 200 entries', () => {
    const result = validateStreamRequest({
      ...validBody,
      messages: Array(201).fill({ id: 'm1', role: 'user', parts: [] }),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('200');
  });

  it('rejects messages with invalid role', () => {
    const result = validateStreamRequest({
      ...validBody,
      messages: [{ id: 'm1', role: 'invalid', parts: [] }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('role');
  });

  it('rejects message without parts array', () => {
    const result = validateStreamRequest({
      ...validBody,
      messages: [{ id: 'm1', role: 'user' }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('parts');
  });

  it('rejects invalid user_key', () => {
    const result1 = validateStreamRequest({ ...validBody, user_key: 'invalid-key' });
    expect(result1.ok).toBe(false);

    const result2 = validateStreamRequest({ ...validBody, user_key: undefined });
    expect(result2.ok).toBe(false);
  });

  it('rejects user_key not starting with sk-', () => {
    const result = validateStreamRequest({
      ...validBody,
      user_key: 'pk-1234567890abcdefghij',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('sk-');
  });

  it('accepts valid vector_store_ids', () => {
    const result = validateStreamRequest({
      ...validBody,
      vector_store_ids: ['vs_123', 'vs_456'],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects vector_store_ids with > 20 entries', () => {
    const result = validateStreamRequest({
      ...validBody,
      vector_store_ids: Array(21)
        .fill(null)
        .map((_, i) => `vs_${i}`),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('20');
  });

  it('rejects vector_store_ids with non-string entries', () => {
    const result = validateStreamRequest({
      ...validBody,
      vector_store_ids: ['vs_123', 456],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('strings');
  });

  it('accepts valid reasoning_effort values', () => {
    for (const effort of ['low', 'medium', 'high']) {
      const result = validateStreamRequest({
        ...validBody,
        reasoning_effort: effort,
      });
      expect(result.ok).toBe(true);
    }
  });

  it('rejects invalid reasoning_effort', () => {
    const result = validateStreamRequest({
      ...validBody,
      reasoning_effort: 'invalid',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('reasoning_effort');
  });

  it('accepts valid top_k values (1-20)', () => {
    for (const topK of [1, 5, 10, 20]) {
      const result = validateStreamRequest({
        ...validBody,
        top_k: topK,
      });
      expect(result.ok).toBe(true);
    }
  });

  it('rejects top_k < 1 or > 20', () => {
    const result1 = validateStreamRequest({
      ...validBody,
      top_k: 0,
    });
    expect(result1.ok).toBe(false);

    const result2 = validateStreamRequest({
      ...validBody,
      top_k: 21,
    });
    expect(result2.ok).toBe(false);
  });

  it('rejects non-integer top_k', () => {
    const result = validateStreamRequest({
      ...validBody,
      top_k: 5.5,
    });
    expect(result.ok).toBe(false);
  });
});

describe('validateSpendAlias', () => {
  it('accepts valid chat key aliases', () => {
    expect(validateSpendAlias('chat-user-1234567890')).toBe(true);
    expect(validateSpendAlias('chat-a')).toBe(true);
    expect(validateSpendAlias('chat-john.doe-2024')).toBe(true);
    expect(validateSpendAlias('chat-user_name@example-1')).toBe(true);
    expect(validateSpendAlias(`chat-${'a'.repeat(200)}`)).toBe(true);
  });

  it('rejects aliases not starting with chat-', () => {
    expect(validateSpendAlias('key-user-1234')).toBe(false);
    expect(validateSpendAlias('user-1234')).toBe(false);
    expect(validateSpendAlias('sk-1234')).toBe(false);
  });

  it('rejects aliases with invalid characters after chat-', () => {
    expect(validateSpendAlias('chat-user#name')).toBe(false);
    expect(validateSpendAlias('chat-user name')).toBe(false);
    expect(validateSpendAlias('chat-user$1234')).toBe(false);
  });

  it('rejects aliases that are too short', () => {
    expect(validateSpendAlias('chat-')).toBe(false);
  });

  it('rejects aliases > 204 chars (chat- prefix + 200 chars)', () => {
    expect(validateSpendAlias(`chat-${'a'.repeat(201)}`)).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(validateSpendAlias(null as unknown as string)).toBe(false);
    expect(validateSpendAlias(undefined as unknown as string)).toBe(false);
    expect(validateSpendAlias(123 as unknown as string)).toBe(false);
  });
});

describe('computeEffectiveBudget', () => {
  it('returns undefined when neither requested nor configured', () => {
    expect(computeEffectiveBudget(undefined, undefined)).toBeUndefined();
    expect(computeEffectiveBudget(null, undefined)).toBeUndefined();
  });

  it('returns configured budget when no request', () => {
    expect(computeEffectiveBudget(undefined, 10)).toBe(10);
    expect(computeEffectiveBudget(null, 5)).toBe(5);
  });

  it('returns requested budget when no configured', () => {
    expect(computeEffectiveBudget(15, undefined)).toBe(15);
    expect(computeEffectiveBudget(20.5, undefined)).toBe(20.5);
  });

  it('returns minimum when both are set', () => {
    expect(computeEffectiveBudget(20, 10)).toBe(10);
    expect(computeEffectiveBudget(5, 10)).toBe(5);
    expect(computeEffectiveBudget(10, 10)).toBe(10);
  });

  it('ignores invalid requested values', () => {
    expect(computeEffectiveBudget('not-a-number', 10)).toBe(10);
    expect(computeEffectiveBudget(-5, 10)).toBe(10);
    expect(computeEffectiveBudget(0, 10)).toBe(10);
    expect(computeEffectiveBudget(Infinity, 10)).toBe(10);
    expect(computeEffectiveBudget(NaN, 10)).toBe(10);
  });

  it('ignores invalid configured budget', () => {
    expect(computeEffectiveBudget(15, -5)).toBe(15);
    expect(computeEffectiveBudget(15, 0)).toBe(15);
    expect(computeEffectiveBudget(15, Infinity)).toBe(15);
    expect(computeEffectiveBudget(15, NaN)).toBe(15);
  });

  it('returns undefined when both are invalid', () => {
    expect(computeEffectiveBudget(-5, -10)).toBeUndefined();
    expect(computeEffectiveBudget(NaN, Infinity)).toBeUndefined();
  });
});

describe('validateModelsField', () => {
  it('returns undefined for missing/null models', () => {
    expect(validateModelsField(undefined)).toBeUndefined();
    expect(validateModelsField(null)).toBeUndefined();
  });

  it('returns undefined for non-array models', () => {
    expect(validateModelsField('string')).toBeUndefined();
    expect(validateModelsField(123)).toBeUndefined();
    expect(validateModelsField({ models: ['a'] })).toBeUndefined();
  });

  it('accepts valid models array', () => {
    const result = validateModelsField(['model-a', 'model-b']);
    expect(result).toEqual(['model-a', 'model-b']);
  });

  it('accepts empty models array', () => {
    const result = validateModelsField([]);
    expect(result).toEqual([]);
  });

  it('returns undefined if models has > 50 entries', () => {
    const models = Array(51)
      .fill(null)
      .map((_, i) => `model-${i}`);
    expect(validateModelsField(models)).toBeUndefined();
  });

  it('returns undefined if any model entry is not a string', () => {
    expect(validateModelsField(['model-a', 123])).toBeUndefined();
    expect(validateModelsField(['model-a', null])).toBeUndefined();
    expect(validateModelsField(['model-a', { name: 'b' }])).toBeUndefined();
  });
});

describe('keyMatches', () => {
  it('matches direct string equality', () => {
    const key = 'sk-1234567890abcdefghij';
    expect(keyMatches(key, key)).toBe(true);
  });

  it('matches sha256 hash', () => {
    const key = 'sk-1234567890abcdefghij';
    const hash = createHash('sha256').update(key).digest('hex');
    expect(keyMatches(key, hash)).toBe(true);
  });

  it('does not match on hash mismatch', () => {
    const key = 'sk-1234567890abcdefghij';
    const wrongHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    expect(keyMatches(key, wrongHash)).toBe(false);
  });

  it('returns false for empty/null inputs', () => {
    expect(keyMatches('', 'hash')).toBe(false);
    expect(keyMatches('key', '')).toBe(false);
    expect(keyMatches('', '')).toBe(false);
    expect(keyMatches(null as unknown as string, 'hash')).toBe(false);
    expect(keyMatches('key', null as unknown as string)).toBe(false);
  });
});

describe('isChatKeyAlias', () => {
  it('returns true for chat- prefixed aliases', () => {
    expect(isChatKeyAlias('chat-user-1234')).toBe(true);
    expect(isChatKeyAlias('chat-alice-0')).toBe(true);
  });

  it('returns false for non-chat- aliases', () => {
    expect(isChatKeyAlias('key-user-1234')).toBe(false);
    expect(isChatKeyAlias('sk-1234')).toBe(false);
    expect(isChatKeyAlias('user-1234')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isChatKeyAlias(null)).toBe(false);
    expect(isChatKeyAlias(undefined)).toBe(false);
  });

  it('returns false for non-string', () => {
    expect(isChatKeyAlias(123 as unknown as string)).toBe(false);
    expect(isChatKeyAlias({} as unknown as string)).toBe(false);
  });
});
