export interface VectorStore {
    id: string;
    name: string;
    file_count?: number;
    status?: string;
}
/** Value of `spec.type` that marks a catalog Component as a chat persona. */
export declare const CHAT_PERSONA_TYPE = "chat-persona";
/** Annotation namespace for persona-specific fields on a catalog entity. */
export declare const CHAT_PERSONA_ANNOTATION_PREFIX = "chat-persona.acarmisc.org";
/**
 * Public persona metadata returned to the frontend picker. Deliberately
 * excludes the system prompt text — that's resolved server-side by
 * `persona_id` when a chat request comes in, so it never has to round-trip
 * through the browser and can't be tampered with client-side.
 */
export interface PersonaSummary {
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
}
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
    /** Catalog entity ref of a chat-persona, e.g. "component:default/oo-business-analyst". */
    persona_id?: string;
    /** Free-text system prompt supplied by the user. Combined with the
     * persona's system prompt (if any) rather than replacing it. */
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
export interface ChatCompletionsRequest extends ChatStreamRequest {
    stream?: false;
}
export interface SearchResult {
    filename: string;
    score: number;
    text: string;
}
export interface UsageInfo {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}
export interface ChatStreamChunk {
    delta?: string;
    error?: string;
    search_results?: SearchResult[];
    usage?: UsageInfo;
}
export interface ChatResult {
    content: string;
    citations: Array<{
        filename: string;
        score: number;
        snippet: string;
    }>;
}
export interface FeedbackSummary {
    up: number;
    down: number;
}
export interface UsageSummaryRow {
    key: string;
    count: number;
}
export interface LiteLLMChatConfig {
    baseUrl: string;
    defaultModel?: string;
    defaultVectorStoreIds?: string[];
    maxRequestBudget?: number;
    fetchContextMaxChars?: number;
}
