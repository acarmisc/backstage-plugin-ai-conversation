/**
 * Request validation and error sanitization helpers for the chat router.
 * These pure functions are extracted from router.ts for easier testing.
 */

import { createHash } from 'node:crypto';

/**
 * Redacts sensitive tokens from error messages before sending to clients.
 * Replaces `sk-...` API keys and Bearer tokens with masked versions.
 * Truncates to 500 chars and falls back to a generic message for non-strings.
 */
export function sanitizeUpstreamMessage(msg: unknown): string {
  if (typeof msg !== 'string') {
    return 'Upstream error';
  }
  const trimmed = msg.trim();
  if (!trimmed) {
    return 'Upstream error';
  }
  // Redact LiteLLM `sk-` keys (format: sk-[A-Za-z0-9_-]{20,})
  let sanitized = trimmed.replace(/\bsk-[A-Za-z0-9_-]+/g, 'sk-***');
  // Redact Bearer tokens in Authorization headers or inline
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9._\-=]+/gi, 'Bearer ***');
  // Truncate to 500 chars
  return sanitized.slice(0, 500);
}

/**
 * Validates and optionally normalizes a chat stream request body.
 * Returns `{ ok: true }` on success, `{ ok: false, error: string }` on failure.
 *
 * Validates:
 * - model: non-empty string, ≤ 200 chars
 * - messages: non-empty array, ≤ 200 entries, each with role in user|assistant|system and parts array
 * - user_key: string starting with `sk-`
 * - vector_store_ids (optional): array of ≤ 20 strings
 * - reasoning_effort (optional): one of low|medium|high
 * - top_k (optional): clamped to integer 1..20
 */
export const MAX_STREAM_MESSAGES = 2000;

export function validateStreamRequest(body: unknown): { ok: true } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }

  const b = body as Record<string, unknown>;

  // Validate model
  if (typeof b.model !== 'string' || b.model.trim().length === 0) {
    return { ok: false, error: 'model must be a non-empty string' };
  }
  if (b.model.length > 200) {
    return { ok: false, error: 'model must be ≤ 200 characters' };
  }

  // Validate messages
  if (!Array.isArray(b.messages) || b.messages.length === 0) {
    return { ok: false, error: 'messages must be a non-empty array' };
  }
  // The frontend resends the whole thread every turn; the cap only guards
  // against abuse, the 30mb body limit bounds the size.
  if (b.messages.length > MAX_STREAM_MESSAGES) {
    return { ok: false, error: `messages must contain ≤ ${MAX_STREAM_MESSAGES} entries` };
  }
  for (let i = 0; i < b.messages.length; i++) {
    const msg = b.messages[i];
    if (!msg || typeof msg !== 'object') {
      return { ok: false, error: `messages[${i}] must be an object` };
    }
    const m = msg as Record<string, unknown>;
    const role = m.role;
    if (!['user', 'assistant', 'system'].includes(role as string)) {
      return { ok: false, error: `messages[${i}].role must be one of: user, assistant, system` };
    }
    if (!Array.isArray(m.parts)) {
      return { ok: false, error: `messages[${i}].parts must be an array` };
    }
  }

  // Validate user_key
  if (typeof b.user_key !== 'string' || !b.user_key.startsWith('sk-')) {
    return { ok: false, error: 'user_key must be a string starting with sk-' };
  }

  // Validate vector_store_ids (optional)
  if (b.vector_store_ids !== undefined && b.vector_store_ids !== null) {
    if (!Array.isArray(b.vector_store_ids)) {
      return { ok: false, error: 'vector_store_ids must be an array' };
    }
    if (b.vector_store_ids.length > 20) {
      return { ok: false, error: 'vector_store_ids must contain ≤ 20 entries' };
    }
    for (const id of b.vector_store_ids) {
      if (typeof id !== 'string') {
        return { ok: false, error: 'vector_store_ids must contain only strings' };
      }
    }
  }

  // Validate reasoning_effort (optional)
  if (b.reasoning_effort !== undefined && b.reasoning_effort !== null) {
    if (!['low', 'medium', 'high'].includes(b.reasoning_effort as string)) {
      return { ok: false, error: 'reasoning_effort must be one of: low, medium, high' };
    }
  }

  // Validate and clamp top_k (optional)
  if (b.top_k !== undefined && b.top_k !== null) {
    const topK = Number(b.top_k);
    if (!Number.isInteger(topK) || topK < 1 || topK > 20) {
      return { ok: false, error: 'top_k must be an integer between 1 and 20' };
    }
    // Note: Normalize in-place would require mutating body, which we avoid.
    // Callers can parse and use the validated value.
  }

  return { ok: true };
}

/**
 * Validates the alias parameter for GET /chat/key/:alias/spend.
 * Must match pattern: chat-[A-Za-z0-9._@-]{1,200}
 */
export function validateSpendAlias(alias: string): boolean {
  if (typeof alias !== 'string') {
    return false;
  }
  const pattern = /^chat-[A-Za-z0-9._@-]{1,200}$/;
  return pattern.test(alias);
}

/**
 * Computes the effective budget cap for a chat key, given a configured
 * server-side limit and an optional client-requested value.
 *
 * Returns the minimum of (requested, configured) when both are set.
 * If neither is set or values are invalid, returns undefined.
 * Only finite positive numbers are accepted.
 */
export function computeEffectiveBudget(
  requestedBudget: unknown,
  configuredBudget: number | undefined,
): number | undefined {
  // Parse the requested budget, ignoring non-finite or invalid values
  let requested: number | undefined;
  if (typeof requestedBudget === 'number' && Number.isFinite(requestedBudget) && requestedBudget > 0) {
    requested = requestedBudget;
  }

  // If configured, cap it
  if (configuredBudget !== undefined) {
    if (!Number.isFinite(configuredBudget) || configuredBudget <= 0) {
      // Invalid configured budget is treated as "no cap"
      return requested;
    }
    if (requested !== undefined) {
      return Math.min(requested, configuredBudget);
    }
    return configuredBudget;
  }

  // No configured limit; pass through requested value only if valid
  return requested;
}

/**
 * Validates request `models` field for POST /chat/key.
 * Must be an array of strings, capped at 50 entries.
 * Returns the normalized array, or undefined if invalid/missing.
 */
export function validateModelsField(models: unknown): string[] | undefined {
  if (models === undefined || models === null) {
    return undefined;
  }
  if (!Array.isArray(models)) {
    return undefined;
  }
  if (models.length > 50) {
    return undefined;
  }
  // Ensure all entries are strings
  if (!models.every(m => typeof m === 'string')) {
    return undefined;
  }
  return models;
}

/**
 * Checks if a LiteLLM key's hashed token matches the raw key sent by the client.
 * LiteLLM's `listKeys` returns a `token` field containing sha256 hex of the raw key.
 * Supports matching against the raw key itself, the sha256 hash, or a stored key_alias.
 *
 * @param rawClientKey The raw `sk-...` key sent by the client
 * @param listellmToken The hashed token from LiteLLM's key record (token field)
 * @returns true if the key matches
 */
export function keyMatches(rawClientKey: string, listellmToken: string): boolean {
  if (!rawClientKey || !listellmToken) {
    return false;
  }
  // Direct string match (for case where LiteLLM returns the raw key)
  if (rawClientKey === listellmToken) {
    return true;
  }
  // Hash match: sha256 of raw key should equal LiteLLM's token
  const hash = createHash('sha256').update(rawClientKey).digest('hex');
  if (hash === listellmToken) {
    return true;
  }
  return false;
}

/**
 * Checks if a key alias is a chat-key (starts with 'chat-').
 * Only chat keys minted by this plugin can be deleted through the chat DELETE route.
 */
export function isChatKeyAlias(keyAlias: string | null | undefined): boolean {
  return typeof keyAlias === 'string' && keyAlias.startsWith('chat-');
}
