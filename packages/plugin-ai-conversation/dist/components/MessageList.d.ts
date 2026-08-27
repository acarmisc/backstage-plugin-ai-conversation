import React from 'react';
import type { AiConversationUIMessage } from '../types';
export interface MessageListProps {
    messages: AiConversationUIMessage[];
    streamingMessageIds: Set<string>;
    avatarLabel?: string;
    onFeedback?: (messageId: string, vote: 'up' | 'down') => void;
    onRegenerate?: (messageId: string) => void;
    onEditAndResend?: (messageId: string, newContent: string) => void;
}
export declare const MessageList: React.FC<MessageListProps>;
