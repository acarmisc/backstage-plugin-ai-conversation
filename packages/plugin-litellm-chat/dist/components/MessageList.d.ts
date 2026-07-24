import React from 'react';
import type { ChatMessage } from '../types';
export interface MessageListProps {
    messages: ChatMessage[];
    isStreaming: boolean;
}
export declare const MessageList: React.FC<MessageListProps>;
