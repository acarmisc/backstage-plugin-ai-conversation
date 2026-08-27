import { FetchApi } from '@backstage/core-plugin-api';
import type { VectorStore, Persona, ChatRequest, ChatFeedbackRequest, ChatStreamChunk, ChatResult, ChatConfig, ChatTraits, KeySpend, UrlContextPreview, FeedbackSummary, UsageSummaryRow, PersistedThread, Thread } from './types';
export interface AiConversationApiInterface {
    listVectorStores(): Promise<VectorStore[]>;
    listPersonas(): Promise<Persona[]>;
    getChatConfig(): Promise<ChatConfig>;
    getChatTraits(): Promise<ChatTraits>;
    fetchUrlContext(url: string): Promise<UrlContextPreview>;
    getFeedbackSummary(filters?: {
        personaId?: string;
        model?: string;
    }): Promise<FeedbackSummary>;
    getUsageSummary(groupBy: 'persona' | 'model', range?: string): Promise<UsageSummaryRow[]>;
    chatStream(req: ChatRequest, onToken: (chunk: ChatStreamChunk) => void, onDone: () => void, onError: (err: Error) => void): AbortController;
    chatCompletions(req: ChatRequest): Promise<ChatResult>;
    mintChatKey(opts?: {
        models?: string[];
        max_budget?: number;
    }): Promise<ChatKey>;
    deleteChatKey(key: string): Promise<{
        success: boolean;
    }>;
    getKeySpend(alias: string): Promise<KeySpend | null>;
    sendFeedback(req: ChatFeedbackRequest): Promise<{
        success: boolean;
    }>;
    listThreads(): Promise<PersistedThread[]>;
    saveThread(thread: Thread): Promise<void>;
    deleteThread(id: string): Promise<void>;
}
export interface ChatKey {
    key: string;
    key_alias: string;
    expires_at?: string;
    max_budget?: number;
}
export declare const aiConversationApiRef: import("@backstage/core-plugin-api").ApiRef<AiConversationApiInterface>;
export declare class AiConversationApi implements AiConversationApiInterface {
    private fetchApi;
    constructor(fetchApi: FetchApi);
    listVectorStores(): Promise<VectorStore[]>;
    listPersonas(): Promise<Persona[]>;
    getChatConfig(): Promise<ChatConfig>;
    getChatTraits(): Promise<ChatTraits>;
    fetchUrlContext(url: string): Promise<UrlContextPreview>;
    getFeedbackSummary(filters?: {
        personaId?: string;
        model?: string;
    }): Promise<FeedbackSummary>;
    getUsageSummary(groupBy: 'persona' | 'model', range?: string): Promise<UsageSummaryRow[]>;
    chatStream(req: ChatRequest, onToken: (chunk: ChatStreamChunk) => void, onDone: () => void, onError: (err: Error) => void): AbortController;
    chatCompletions(req: ChatRequest): Promise<ChatResult>;
    mintChatKey(opts?: {
        models?: string[];
        max_budget?: number;
    }): Promise<ChatKey>;
    deleteChatKey(key: string): Promise<{
        success: boolean;
    }>;
    getKeySpend(alias: string): Promise<KeySpend | null>;
    sendFeedback(req: ChatFeedbackRequest): Promise<{
        success: boolean;
    }>;
    listThreads(): Promise<PersistedThread[]>;
    saveThread(thread: Thread): Promise<void>;
    deleteThread(id: string): Promise<void>;
}
