import type { UIMessage } from 'ai';
export interface VectorStore {
    id: string;
    name: string;
    file_count?: number;
    status?: string;
}
/**
 * Skill metadata for the picker, sourced from `chat-skill` catalog
 * entities. Deliberately excludes the system prompt text — the backend
 * resolves it server-side from `skill_id` so it never round-trips through
 * the browser.
 */
export interface Skill {
    /** Catalog entity ref, e.g. "component:default/data-analyst-skill". */
    id: string;
    title: string;
    description?: string;
    defaultModel?: string;
    defaultVectorStoreIds?: string[];
    tags?: string[];
}
/** @deprecated Use Skill instead */
export type Persona = Skill;
/**
 * Legacy flat-content message shape. Kept only for `threadPersistence.ts`'s
 * migration function, as the "old shape" it converts *from* — pre-AI-SDK
 * threads (localStorage or `chat_threads` rows) still on disk from before
 * the Phase 20 migration. `Thread.messages` itself moved to
 * `AiConversationUIMessage[]` — see that type below.
 */
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
/**
 * Custom metadata carried on every `AiConversationUIMessage` — the fields
 * `ChatMessage` used to carry as top-level properties, now on
 * `UIMessage.metadata` since `UIMessage`'s own shape is fixed
 * (id/role/parts). `turnId`/`compareModel` only matter for compare mode's
 * column grouping (see `useCompareChat.ts`); `feedback`/`attachedUrl`
 * apply to any message.
 */
export interface AiConversationMessageMetadata {
    feedback?: 'up' | 'down';
    attachedUrl?: {
        url: string;
        title: string;
    };
    turnId?: string;
    compareModel?: string;
}
/** The AI SDK's `UIMessage`, parameterized with this plugin's metadata
 * shape. This is what `Thread.messages` is made of (Phase 20) and what
 * `@ai-sdk/react`'s `useChat`/`Chat` instances operate on directly. */
export type AiConversationUIMessage = UIMessage<AiConversationMessageMetadata>;
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
export interface UsageInfo {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}
export interface Citation {
    filename: string;
    score: number;
    snippet: string;
    source?: 'kb' | 'web';
    url?: string;
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
/** A thread as persisted server-side (see `litellm.aiConversation.persistence` config).
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
    messages: AiConversationUIMessage[];
    model: string;
    vectorStoreIds: string[];
    customSystemPrompt: string;
    keyAlias: string;
    keyToken: string;
    /** Epoch ms when `keyToken` expires (LiteLLM mints chat keys with a
     * short TTL — see mintChatKey). Used to re-mint proactively before a
     * send rather than letting the turn fail with an upstream 401. Absent
     * on threads created before this field, and on server-restored threads
     * (the key itself is never persisted). */
    keyExpiresAt?: number;
    createdAt: number;
    updatedAt: number;
    totalTokens: number;
    lastTurnUsage: UsageInfo | null;
    pinned?: boolean;
    /** Catalog entity ref of the selected chat-skill, e.g.
     * "component:default/data-analyst". Sent as `skill_id`; the backend
     * resolves and prepends its system prompt. */
    skillId?: string;
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
 * scoped to its minting user and must never be written to a shared file.
 *
 * Version 2 (Phase 20): `thread.messages` is `AiConversationUIMessage[]`
 * instead of the old flat `ChatMessage[]`. `importThread` still accepts a
 * version-1 export and migrates it on the fly — see
 * `threadPersistence.ts`'s `migrateChatMessagesToUIMessages`. */
export interface ThreadExport {
    version: 1 | 2;
    thread: Omit<Thread, 'keyToken' | 'keyAlias'> | LegacyThreadV1;
}
/** Shape of a version-1 export's `thread` field — `Thread` but with the
 * old flat-content `messages: ChatMessage[]`. Only used as the migration
 * function's input type. */
export type LegacyThreadV1 = Omit<Thread, 'keyToken' | 'keyAlias' | 'messages'> & {
    messages: ChatMessage[];
};
