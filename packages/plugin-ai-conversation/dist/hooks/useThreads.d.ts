import type { FileUIPart } from 'ai';
import type { Thread, Citation, KeySpend, ReasoningEffort } from '../types';
/** True when a stream error is LiteLLM rejecting the chat key — expired,
 * purged (proxy DB reset), or otherwise absent from its token table. The
 * backend surfaces these as `upstream 401: {…}` (see proxyUIMessageStream);
 * LiteLLM's own bodies carry `token_not_found_in_db` / `ExpiredToken` /
 * "Invalid proxy server token". Any of these is recoverable by minting a
 * fresh key and retrying. A 401 from our own backend ("unauthenticated")
 * is deliberately not matched — that's a Backstage session problem, not a
 * chat-key problem, and re-minting wouldn't help. */
export declare function isChatKeyAuthError(message: string | undefined): boolean;
export interface UseChatOptions {
    userId: string;
    model: string;
    vectorStoreIds: string[];
    customSystemPrompt: string;
    toneId: string;
    focusId: string;
    verbosityId: string;
    reasoningEffort: ReasoningEffort | '';
    keyAlias: string;
    keyToken: string;
    keyExpiresAt?: number;
    skillId?: string;
    topK?: number;
    webSearch?: boolean;
    persistenceEnabled?: boolean;
    /** Called when the hook mints a replacement chat key after an upstream
     * 401 (expired/purged key). Lets the owner (ChatPage) update the state
     * it holds `keyAlias`/`keyToken` in, so subsequent sends and the
     * thread-restore effect see the new key rather than reinstating the
     * dead one. */
    onKeyChange?: (key: {
        alias: string;
        token: string;
        expiresAt?: number;
    }) => void;
}
export interface UseChatResult {
    threads: Thread[];
    activeThread: Thread | null;
    newThread: (overrideKey?: {
        alias: string;
        token: string;
        expiresAt?: number;
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
