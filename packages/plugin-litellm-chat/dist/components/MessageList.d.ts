import React from 'react';
import type { ChatMessage } from '../types';
export interface MessageListProps {
    messages: ChatMessage[];
    isStreaming: boolean;
    onFeedback?: (messageId: string, vote: 'up' | 'down') => void;
}
export declare const MessageList: React.FC<MessageListProps>;
