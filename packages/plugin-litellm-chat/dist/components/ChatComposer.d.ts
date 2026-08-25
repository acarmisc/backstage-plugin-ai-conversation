import React from 'react';
export interface ChatComposerProps {
    /**
     * URL preview chip (React.ReactNode already computed in ChatPage)
     */
    urlPreviewChip: React.ReactNode;
    /**
     * Whether URL preview is loading
     */
    urlPreviewLoading: boolean;
    /**
     * URL preview data (null if not loaded or dismissed)
     */
    urlPreview: {
        url: string;
        title: string;
    } | null;
    /**
     * URL preview error message (null if no error)
     */
    urlPreviewError: string | null;
    /**
     * Current input text
     */
    input: string;
    /**
     * Called when input text changes
     */
    onInputChange: (value: string) => void;
    /**
     * Called on keydown (handles Enter to send)
     */
    onKeyDown: (e: React.KeyboardEvent) => void;
    /**
     * Current key value with alias and token
     */
    keyVal: {
        alias: string;
        token: string;
    };
    /**
     * Whether a message is currently streaming
     */
    isStreaming: boolean;
    /**
     * Called when Stop button is clicked
     */
    onStop: () => void;
    /**
     * Called when Send button is clicked
     */
    onSend: () => void;
    /**
     * Whether the Send button should be disabled
     */
    sendDisabled: boolean;
    /**
     * Status parts to display (tokens, budget, etc.)
     */
    statusParts: string[];
}
export declare const ChatComposer: React.FC<ChatComposerProps>;
