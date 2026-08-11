import React from 'react';
import type { ChatMessage } from '../types';
export interface UserMessageProps {
    message: ChatMessage;
    onEditAndResend?: (messageId: string, newContent: string) => void;
}
export declare const UserMessage: React.FC<UserMessageProps>;
