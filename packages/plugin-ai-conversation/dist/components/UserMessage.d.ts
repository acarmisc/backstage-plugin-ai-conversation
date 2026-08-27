import React from 'react';
import type { AiConversationUIMessage } from '../types';
export interface UserMessageProps {
    message: AiConversationUIMessage;
    onEditAndResend?: (messageId: string, newContent: string) => void;
}
export declare const UserMessage: React.FC<UserMessageProps>;
