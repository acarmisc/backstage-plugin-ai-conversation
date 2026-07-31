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

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  vector_store_ids?: string[];
  top_k?: number;
  user_key: string;
  persona_id?: string;
  /** Free-text system prompt supplied by the user. Combined with the
   * persona's system prompt (if any) rather than replacing it. */
  custom_system_prompt?: string;
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
}

export interface ChatResult {
  content: string;
  citations: Citation[];
}

export interface ChatConfig {
  defaultModel: string | null;
  defaultVectorStoreIds: string[] | null;
  maxRequestBudget: number | null;
}

export interface KeySpend {
  spend: number;
  max_budget: number | null;
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
}