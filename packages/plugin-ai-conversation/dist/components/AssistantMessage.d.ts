import React from 'react';
import type { ChatMessage } from '../types';
export interface AssistantMessageProps {
    message: ChatMessage;
    isStreaming: boolean;
    avatarLabel?: string;
    onFeedback?: (messageId: string, vote: 'up' | 'down') => void;
    onRegenerate?: (messageId: string) => void;
}
export declare const AssistantMessage: React.FC<AssistantMessageProps>;
