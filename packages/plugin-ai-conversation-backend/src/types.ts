import type { IncomingUIMessage } from './attachments';

export interface VectorStore {
  id: string;
  name: string;
  file_count?: number;
  status?: string;
}

/** Value of `spec.type` that marks a catalog Component as a chat skill. */
export const CHAT_SKILL_TYPE = 'chat-skill';

/** Annotation namespace for skill-specific fields on a catalog entity. */
export const CHAT_SKILL_ANNOTATION_PREFIX = 'chat-skill.acarmisc.org';

/** Backwards compatibility: old persona type/annotation names. */
export const CHAT_PERSONA_TYPE = CHAT_SKILL_TYPE;
export const CHAT_PERSONA_ANNOTATION_PREFIX = CHAT_SKILL_ANNOTATION_PREFIX;

/**
 * Public skill metadata returned to the frontend picker. Deliberately
 * excludes the system prompt text — that's resolved server-side by
 * `skill_id` when a chat request comes in, so it never has to round-trip
 * through the browser and can't be tampered with client-side.
 */
export interface SkillSummary {
  /** Catalog entity ref, e.g. "component:default/data-analyst-skill". */
  id: string;
  title: string;
  description?: string;
  defaultModel?: string;
  defaultVectorStoreIds?: string[];
  tags?: string[];
}

/** Backwards compatibility: old persona interface name. */
export type PersonaSummary = SkillSummary;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatFeedbackRequest {
  threadId: string;
  messageId: string;
  vote: 'up' | 'down';
  comment?: string;
  question: string;
  answer: string;
  model: string;
  skillId?: string;
  vectorStoreIds?: string[];
  toneId?: string;
  focusId?: string;
  verbosityId?: string;
}

/** Reasoning-effort levels forwarded as-is to LiteLLM's `reasoning_effort`
 * param. Only models/providers that support it use it (LiteLLM maps it to
 * the right native mechanism per provider, e.g. Anthropic extended
 * thinking); others may ignore or reject it depending on `drop_params`. */
export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface ChatStreamRequest {
  model: string;
  messages: ChatMessage[];
  vector_store_ids?: string[];
  top_k?: number;
  user_key: string;
  /** Thread id, logged server-side for usage analytics only — see
   * chat_events / GET /usage/summary. Never used to reconstruct or persist
   * message content. */
  thread_id?: string;
  /** Catalog entity ref of a chat-skill, e.g. "component:default/data-analyst-skill". */
  skill_id?: string;
  /** Free-text system prompt supplied by the user. Combined with the
   * skill's system prompt (if any) rather than replacing it. */
  custom_system_prompt?: string;
  /** URL typed as `#https://...` in the composer. Fetched server-side
   * (SSRF-guarded, see urlContext.ts) and injected as one-off context for
   * this turn only — never registered as a vector store. */
  context_url?: string;
  /** Passed through as LiteLLM's `web_search_options` when set — assumes
   * the proxy has a native web-search-capable model/tool. If the target
   * LiteLLM deployment doesn't, this is a silent no-op upstream rather
   * than an error; verify against the live proxy before relying on it. */
  web_search?: boolean;
  /** Ids into TONE_OPTIONS/FOCUS_OPTIONS/VERBOSITY_OPTIONS (see traits.ts).
   * Resolved server-side into prompt fragments composed alongside the
   * skill's system prompt — see composeSystemPrompt in router.ts. */
  tone_id?: string;
  focus_id?: string;
  verbosity_id?: string;
  /** Native passthrough — not composed into the system prompt. */
  reasoning_effort?: ReasoningEffort;
}

/** Request body for POST /chat/stream/v2 (HANDOFF-ai-sdk-migration.md
 * Phase 17/18) — same fields as `ChatStreamRequest`, but `messages` is
 * AI SDK `UIMessage[]`-shaped (text + file parts) instead of the old flat
 * `ChatMessage[]`, since attachments arrive as file parts on a message. */
export interface ChatStreamRequestV2 extends Omit<ChatStreamRequest, 'messages'> {
  messages: IncomingUIMessage[];
}

export interface FetchContextRequest {
  url: string;
}

export interface FetchContextResult {
  url: string;
  title: string;
  snippet: string;
  charCount: number;
}

export interface SearchResult {
  filename: string;
  score: number;
  text: string;
  /** Source URI from Bedrock KB metadata (_source_uri), if present. */
  url?: string;
}

export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface FeedbackSummary {
  up: number;
  down: number;
}

export interface UsageSummaryRow {
  key: string;
  count: number;
}

export interface ChatPersistenceConfig {
  enabled: boolean;
  /** 0 means unlimited (never auto-deleted). */
  ttlDays: number;
}

export interface AiConversationConfig {
  baseUrl: string;
  defaultModel?: string;
  defaultVectorStoreIds?: string[];
  maxRequestBudget?: number;
  fetchContextMaxChars?: number;
  persistence: ChatPersistenceConfig;
  /** Model ids known to accept image attachments. Overrides the built-in
   * naming-pattern heuristic (see `attachments.ts`) when set — see that
   * file's comment on why there's no authoritative source for this. */
  multimodalModels?: string[];
}

/** Body of `PUT /threads/:id`. `data` is stored and returned opaquely — the
 * backend never interprets its shape, so it doesn't need to duplicate the
 * frontend's `Thread` type. */
export interface SaveThreadRequest {
  title: string;
  pinned?: boolean;
  data: unknown;
}

/** A persisted thread row as returned to the frontend. */
export interface ThreadRecord {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  data: unknown;
}