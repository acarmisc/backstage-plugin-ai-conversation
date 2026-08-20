import type { Thread, Citation, KeySpend, ReasoningEffort } from '../types';
export interface UseChatOptions {
    userId: string;
    model: string;
    vectorStoreIds: string[];
    personaId: string;
    customSystemPrompt: string;
    toneId: string;
    focusId: string;
    verbosityId: string;
    reasoningEffort: ReasoningEffort | '';
    keyAlias: string;
    keyToken: string;
    topK?: number;
    webSearch?: boolean;
    /** Mirrors `litellm.chat.persistence.enabled` (see config.d.ts). When
     * true, threads are synced to the backend in addition to localStorage —
     * on enable, the backend's thread list replaces local state (server is
     * authoritative once persistence is on). When false (default), behavior
     * is unchanged from client-side-only threads. */
    persistenceEnabled?: boolean;
}
export interface UseChatResult {
    threads: Thread[];
    activeThread: Thread | null;
    newThread: () => void;
    selectThread: (id: string) => void;
    deleteThread: (id: string) => void;
    sendMessage: (text: string, attachedUrl?: {
        url: string;
        title: string;
    }, compareModelsOverride?: string[]) => void;
    regenerateFrom: (messageId: string) => void;
    editAndResend: (messageId: string, newContent: string) => void;
    stopGeneration: () => void;
    submitFeedback: (messageId: string, vote: 'up' | 'down') => void;
    togglePin: (id: string) => void;
    exportThread: (id: string) => void;
    importThread: (file: File) => Promise<void>;
    setCompareMode: (enabled: boolean, models?: string[]) => void;
    isStreaming: boolean;
    /** IDs of assistant messages currently receiving tokens — in compare
     * mode several are streaming at once, one per model column. */
    streamingMessageIds: Set<string>;
    error: string | null;
    citations: Citation[];
    keySpend: KeySpend | null;
}
export declare function useChat(opts: UseChatOptions): UseChatResult;
