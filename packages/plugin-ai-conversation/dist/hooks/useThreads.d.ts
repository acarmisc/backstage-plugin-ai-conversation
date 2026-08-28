import type { FileUIPart } from 'ai';
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
    persistenceEnabled?: boolean;
}
export interface UseChatResult {
    threads: Thread[];
    activeThread: Thread | null;
    newThread: (overrideKey?: {
        alias: string;
        token: string;
    }) => void;
    selectThread: (id: string) => void;
    deleteThread: (id: string) => void;
    sendMessage: (text: string, attachedUrl?: {
        url: string;
        title: string;
    }, compareModelsOverride?: string[], files?: FileUIPart[]) => void;
    regenerateFrom: (messageId: string) => void;
    editAndResend: (messageId: string, newContent: string) => void;
    stopGeneration: () => void;
    submitFeedback: (messageId: string, vote: 'up' | 'down') => void;
    togglePin: (id: string) => void;
    exportThread: (id: string) => void;
    importThread: (file: File) => Promise<void>;
    setCompareMode: (enabled: boolean, models?: string[]) => void;
    isStreaming: boolean;
    streamingMessageIds: Set<string>;
    error: string | null;
    citations: Citation[];
    keySpend: KeySpend | null;
}
export declare function useThreads(opts: UseChatOptions): UseChatResult;
