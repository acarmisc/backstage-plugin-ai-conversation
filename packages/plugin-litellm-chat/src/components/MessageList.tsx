import React from 'react';
import { Box } from '@mui/material';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import type { ChatMessage } from '../types';

export interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  avatarLabel?: string;
  onFeedback?: (messageId: string, vote: 'up' | 'down') => void;
  onRegenerate?: (messageId: string) => void;
  onEditAndResend?: (messageId: string, newContent: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isStreaming,
  avatarLabel,
  onFeedback,
  onRegenerate,
  onEditAndResend,
}) => {
  return (
    <Box
      sx={{
        flex: 1,
        overflowY: 'auto',
        px: 2,
        py: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';
        const isLast = i === messages.length - 1;
        const messageIsStreaming = isStreaming && isLast && !isUser;

        return isUser ? (
          <UserMessage key={msg.id} message={msg} onEditAndResend={onEditAndResend} />
        ) : (
          <AssistantMessage
            key={msg.id}
            message={msg}
            isStreaming={messageIsStreaming}
            avatarLabel={avatarLabel}
            onFeedback={onFeedback}
            onRegenerate={onRegenerate}
          />
        );
      })}
    </Box>
  );
};
