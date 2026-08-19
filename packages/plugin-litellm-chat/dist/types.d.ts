export interface VectorStore {
    id: string;
    name: string;
    file_count?: number;
    status?: string;
}
/**
 * Persona metadata for the picker, sourced from `chat-persona` catalog
 * entities (see the `ces-ai-personas` repo). Deliberately excludes the
 * system prompt text — the backend resolves it server-side from
 * `persona_id` so it never round-trips through the browser.
 */
export interface Persona {
    /** Catalog entity ref, e.g. "component:default/oo-business-analyst". */
    id: string;
    title: string;
    description?: string;
    defaultModel?: string;
    defaultVectorStoreIds?: string[];
    tags?: string[];
}
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    feedback?: 'up' | 'down';
    /** Set when this user message was sent with a `#https://...` ad-hoc
     * context attachment — display-only, the fetched page text itself is
     * never stored client-side (see UrlContextPreview / #url command). */
    attachedUrl?: {
        url: string;
        title: string;
    };
    /** Groups a user message with its assistant reply/replies from the same
     * send — in compare mode, several assistant messages share one turnId
     * and are rendered as side-by-side columns instead of stacked. */
    turnId?: string;
    /** Set on assistant messages produced in compare mode: which of
     * Thread.compareModels generated this particular reply. */
    compareModel?: string;
}
export interface UrlContextPreview {
    url: string;
    title: string;
    snippet: string;
    charCount: number;
}
export interface ChatFeedbackRequest {
    threadId: string;
    messageId: string;
    vote: 'up' | 'down';
    comment?: string;
    question: string;
    answer: string;
    model: string;
    personaId?: string;
    vectorStoreIds?: string[];
    toneId?: string;
    focusId?: string;
    verbosityId?: string;
}
/** id/label pair for a tone/focus/verbosity option — the prompt text stays
 * server-side (see `/chat/traits` and traits.ts on the backend). */
export interface TraitOption {
    id: string;
    label: string;
}
export interface ChatTraits {
    tones: TraitOption[];
    focuses: TraitOption[];
    verbosities: TraitOption[];
}
/** Not fetched from the backend — a fixed, provider-agnostic enum with no
 * prompt text attached, so there's nothing for the server to own here. */
export type ReasoningEffort = 'low' | 'medium' | 'high';
export interface ChatRequest {
    model: string;
    messages: ChatMessage[];
    vector_store_ids?: string[];
    top_k?: number;
    user_key: string;
    /** Thread id, logged server-side for usage analytics only (see
     * chat_events / GET /usage/summary) — never used to reconstruct or
     * persist message content. */
    thread_id?: string;
    persona_id?: string;
    /** Free-text system prompt supplied by the user. Combined with the
     * persona's system prompt (if any) rather than replacing it. */
    custom_system_prompt?: string;
    /** URL typed as `#https://...` in the composer, resolved server-side and
     * injected as one-off context for this turn only. */
    context_url?: string;
    /** Requests LiteLLM's native web search alongside (not instead of) any
     * selected knowledge bases. Passed through as-is — see AGENTS.md for the
     * "verify LiteLLM has a native web_search tool first" caveat. */
    web_search?: boolean;
    /** Ids into ChatTraits — resolved server-side into prompt fragments. */
    tone_id?: string;
    focus_id?: string;
    verbosity_id?: string;
    /** Native passthrough — not composed into the system prompt. */
    reasoning_effort?: ReasoningEffort;
}
export interface SearchResult {
    filename: string;
    score: number;
    text: string;
    /** 'web' for web-search results, 'kb' for vector-store hits. Inferred
     * client-side from shape (a `url` field implies a web result) — LiteLLM
     * doesn't currently tag these explicitly, so treat this as best-effort. */
    source?: 'kb' | 'web';
    url?: string;
}
export interface UsageInfo {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}
/**
 * Normalized SSE chunk shape emitted by the backend stream and consumed
 * by the frontend. LiteLLM emits OpenAI-shaped chunks
 * `{ choices: [{ delta: { content } }], search_results?, usage? }` — the
 * api.ts SSE reader normalizes them into this shape.
 */
export interface ChatStreamChunk {
    delta?: string;
    error?: string;
    search_results?: SearchResult[];
    usage?: UsageInfo;
}
export interface Citation {
    filename: string;
    score: number;
    snippet: string;
    source?: 'kb' | 'web';
    url?: string;
}
export interface ChatResult {
    content: string;
    citations: Citation[];
}
export interface ChatPersistenceConfig {
    enabled: boolean;
    /** 0 means unlimited (never auto-deleted). */
    ttlDays: number;
}
export interface ChatConfig {
    defaultModel: string | null;
    defaultVectorStoreIds: string[] | null;
    maxRequestBudget: number | null;
    persistence: ChatPersistenceConfig;
}
/** A thread as persisted server-side (see `litellm.chat.persistence` config).
 * `data` mirrors `ThreadExport['thread']` — the same portable shape used by
 * export/import, deliberately excluding the live `keyToken`/`keyAlias`
 * credential, which never leaves the browser it was minted in. */
export interface PersistedThread {
    id: string;
    title: string;
    pinned: boolean;
    createdAt: string;
    updatedAt: string;
    data: Omit<Thread, 'keyToken' | 'keyAlias'>;
}
export interface KeySpend {
    spend: number;
    max_budget: number | null;
}
export interface FeedbackSummary {
    up: number;
    down: number;
}
export interface UsageSummaryRow {
    key: string;
    count: number;
}
export interface Thread {
    id: string;
    title: string;
    messages: ChatMessage[];
    model: string;
    vectorStoreIds: string[];
    personaId: string;
    customSystemPrompt: string;
    keyAlias: string;
    keyToken: string;
    createdAt: number;
    updatedAt: number;
    totalTokens: number;
    lastTurnUsage: UsageInfo | null;
    pinned?: boolean;
    /** 'compare' sends the same prompt to every model in compareModels in
     * parallel instead of the single selected model. Missing/'single' is
     * the default for every thread created before this field existed. */
    mode?: 'single' | 'compare';
    compareModels?: string[];
    webSearch?: boolean;
    toneId?: string;
    focusId?: string;
    verbosityId?: string;
    reasoningEffort?: ReasoningEffort;
}
/** Portable export shape written by exportThread() / read by importThread().
 * Deliberately excludes keyToken/keyAlias — a chat key is a live credential
 * scoped to its minting user and must never be written to a shared file. */
export interface ThreadExport {
    version: 1;
    thread: Omit<Thread, 'keyToken' | 'keyAlias'>;
}
