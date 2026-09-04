import type { ChatMessage, SearchResult } from './types';
/**
 * Server-side retrieval for grounding. Two-step RAG against LiteLLM:
 * search each selected vector store, then inject the chunks as a system
 * message before the conversation. Replaces the old pass-through of
 * `vector_store_ids` on /v1/chat/completions — LiteLLM forwards that param
 * to Bedrock verbatim, and Bedrock managed KBs reject it ("Extra inputs are
 * not permitted"), as does /v1/rag/query (it builds
 * retrievalConfiguration.vectorSearchConfiguration, which Bedrock managed
 * KBs refuse in favor of managedSearchConfiguration). The OpenAI-style
 * /v1/vector_stores/{id}/search endpoint works on managed KBs when the
 * numberOfResults rides in extra_body retrievalConfiguration.
 * managedSearchConfiguration — LiteLLM's own `max_num_results` param injects
 * the vectorSearchConfiguration form instead and gets rejected, so it must
 * NOT be sent alongside the extra_body.
 */
export declare function retrieveContext(opts: {
    baseUrl: string;
    userKey: string;
    vectorStoreIds: string[];
    query: string;
    topK: number;
}): Promise<SearchResult[]>;
/** Builds the grounding system message: one numbered block per chunk, so
 * the model can cite [n] and the frontend's SourcesPanel can list the same
 * filenames. */
export declare function buildContextMessage(results: SearchResult[]): ChatMessage;
