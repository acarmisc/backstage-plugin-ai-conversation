import type { Thread, Citation, KeySpend } from '../types';
export interface UseChatOptions {
    userId: string;
    model: string;
    vectorStoreIds: string[];
    personaId: string;
    customSystemPrompt: string;
    keyAlias: string;
    keyToken: string;
    topK?: number;
}
export interface UseChatResult {
    threads: Thread[];
    activeThread: Thread | null;
    newThread: () => void;
    selectThread: (id: string) => void;
    deleteThread: (id: string) => void;
    sendMessage: (text: string) => void;
    stopGeneration: () => void;
    submitFeedback: (messageId: string, vote: 'up' | 'down') => void;
    isStreaming: boolean;
    error: string | null;
    citations: Citation[];
    keySpend: KeySpend | null;
}
export declare function useChat(opts: UseChatOptions): UseChatResult;
