/**
 * Attachment handling for /chat/stream/v2 (HANDOFF-ai-sdk-migration.md
 * Phase 18). The route accepts AI SDK `UIMessage[]`-shaped request
 * messages (text + file parts) instead of the old flat `ChatMessage[]`;
 * this module converts those into LiteLLM/OpenAI wire-format content and
 * validates attachments before anything is forwarded upstream.
 */

/** Minimal shape of an incoming UIMessage part this module cares about —
 * deliberately not importing `ai`'s `UIMessagePart` union so this stays
 * decoupled from parts (tool calls, reasoning, etc.) we never touch here. */
export interface IncomingUIPart {
  type: string;
  text?: string;
  mediaType?: string;
  url?: string;
  filename?: string;
}

export interface IncomingUIMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  parts: IncomingUIPart[];
}

export class AttachmentValidationError extends Error {}

/** Only image types are forwarded — LiteLLM's OpenAI-compatible
 * `/v1/chat/completions` only accepts `image_url` content parts; other
 * file types have no equivalent to forward to today. */
const ALLOWED_ATTACHMENT_MEDIA_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

/** Base64 data-URL length cap, sized generously above the ~4MB/image most
 * multimodal providers accept once base64 overhead (~33%) is applied. */
export const MAX_ATTACHMENT_DATA_URL_LENGTH = 6_000_000;

export const MAX_ATTACHMENTS_PER_MESSAGE = 4;

/**
 * LiteLLM's own model registry (models.yaml in the litellm repo) carries
 * no vision/multimodal capability metadata — confirmed by reading it
 * directly (HANDOFF-ai-sdk-migration.md Open risk #3). There is no
 * authoritative source to check against at request time, so this is a
 * best-effort heuristic on well-known model-family naming, overridable via
 * `litellm.aiConversation.multimodalModels` in app-config.yaml for
 * operators who know their actual registered models.
 */
const DEFAULT_MULTIMODAL_MODEL_PATTERNS: RegExp[] = [
  /^claude-/i,
  /^gpt-4/i,
  /^gpt-5/i,
  /gemini/i,
  /-vl(\b|[-:])/i,
  /vision/i,
];

export function isLikelyMultimodal(
  model: string,
  configuredModels: string[] | undefined,
): boolean {
  if (configuredModels?.length) {
    return configuredModels.some(m => m.toLowerCase() === model.toLowerCase());
  }
  return DEFAULT_MULTIMODAL_MODEL_PATTERNS.some(re => re.test(model));
}

function isHttpOrDataUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || /^data:/i.test(url);
}

/**
 * Validates every file part across all messages in one request. Throws
 * `AttachmentValidationError` with a client-safe message on the first
 * violation found — mime type, url scheme, size, and per-message count.
 * Does not check model capability (see `isLikelyMultimodal`) — that's a
 * separate, model-specific check the caller applies once, since it's the
 * same answer for every attachment in the request.
 */
export function validateAttachments(messages: IncomingUIMessage[]): void {
  for (const message of messages) {
    const fileParts = message.parts.filter(p => p.type === 'file');
    if (fileParts.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      throw new AttachmentValidationError(
        `too many attachments on one message (max ${MAX_ATTACHMENTS_PER_MESSAGE})`,
      );
    }
    for (const part of fileParts) {
      if (!part.mediaType || !ALLOWED_ATTACHMENT_MEDIA_TYPES.has(part.mediaType)) {
        throw new AttachmentValidationError(
          `unsupported attachment type: ${part.mediaType ?? 'unknown'}`,
        );
      }
      if (!part.url || !isHttpOrDataUrl(part.url)) {
        throw new AttachmentValidationError('attachment url must be http(s) or a data URL');
      }
      if (part.url.length > MAX_ATTACHMENT_DATA_URL_LENGTH) {
        throw new AttachmentValidationError('attachment too large');
      }
    }
  }
}

/** Extracts the plain-text content of a message (its text parts joined),
 * ignoring file/tool/reasoning parts — used to feed the existing
 * persona/tone/#url system-prompt composition helpers, which only care
 * about role/content structure, never attachment content. */
export function extractText(message: IncomingUIMessage): string {
  return message.parts
    .filter(p => p.type === 'text')
    .map(p => p.text ?? '')
    .join('');
}

export type OpenAIMessageContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

/** Converts one incoming UIMessage into LiteLLM/OpenAI wire-format
 * `content` — a plain string when there are no attachments (the common
 * case, keeps the upstream payload identical to before Phase 18), or a
 * content-parts array with `image_url` entries when there are. */
export function toOpenAIMessageContent(message: IncomingUIMessage): OpenAIMessageContent {
  const fileParts = message.parts.filter(p => p.type === 'file');
  const text = extractText(message);
  if (fileParts.length === 0) return text;

  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
  if (text) content.push({ type: 'text', text });
  for (const part of fileParts) {
    content.push({ type: 'image_url', image_url: { url: part.url! } });
  }
  return content;
}
