import React from 'react';
import type { AiConversationUIMessage } from '../types';
export interface AssistantMessageProps {
    message: AiConversationUIMessage;
    isStreaming: boolean;
    avatarLabel?: string;
    onFeedback?: (messageId: string, vote: 'up' | 'down') => void;
    onRegenerate?: (messageId: string) => void;
}
export declare const AssistantMessage: React.FC<AssistantMessageProps>;
