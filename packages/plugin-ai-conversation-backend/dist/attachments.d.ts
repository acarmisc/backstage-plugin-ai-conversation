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
export declare class AttachmentValidationError extends Error {
}
/** Base64 data-URL length cap, sized generously above the ~4MB/image most
 * multimodal providers accept once base64 overhead (~33%) is applied. */
export declare const MAX_ATTACHMENT_DATA_URL_LENGTH = 6000000;
export declare const MAX_ATTACHMENTS_PER_MESSAGE = 4;
export declare function isLikelyMultimodal(model: string, configuredModels: string[] | undefined): boolean;
/**
 * Validates every file part across all messages in one request. Throws
 * `AttachmentValidationError` with a client-safe message on the first
 * violation found — mime type, url scheme, size, and per-message count.
 * Does not check model capability (see `isLikelyMultimodal`) — that's a
 * separate, model-specific check the caller applies once, since it's the
 * same answer for every attachment in the request.
 */
export declare function validateAttachments(messages: IncomingUIMessage[]): void;
/** Extracts the plain-text content of a message (its text parts joined),
 * ignoring file/tool/reasoning parts — used to feed the existing
 * persona/tone/#url system-prompt composition helpers, which only care
 * about role/content structure, never attachment content. */
export declare function extractText(message: IncomingUIMessage): string;
export type OpenAIMessageContent = string | Array<{
    type: 'text';
    text: string;
} | {
    type: 'image_url';
    image_url: {
        url: string;
    };
}>;
/** Converts one incoming UIMessage into LiteLLM/OpenAI wire-format
 * `content` — a plain string when there are no attachments (the common
 * case, keeps the upstream payload identical to before Phase 18), or a
 * content-parts array with `image_url` entries when there are. */
export declare function toOpenAIMessageContent(message: IncomingUIMessage): OpenAIMessageContent;
