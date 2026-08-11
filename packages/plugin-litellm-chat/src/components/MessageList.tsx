import React from 'react';
import { Box, Typography } from '@mui/material';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import type { ChatMessage } from '../types';

export interface MessageListProps {
  messages: ChatMessage[];
  streamingMessageIds: Set<string>;
  avatarLabel?: string;
  onFeedback?: (messageId: string, vote: 'up' | 'down') => void;
  onRegenerate?: (messageId: string) => void;
  onEditAndResend?: (messageId: string, newContent: string) => void;
}

interface MessageGroup {
  user?: ChatMessage;
  assistants: ChatMessage[];
}

// Groups messages into turns — a user message plus the assistant reply(ies)
// that immediately follow it. In compare mode a turn has several assistant
// messages (one per model, sharing turnId) and renders as side-by-side
// columns instead of a single stacked reply.
function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let current: MessageGroup | null = null;
  for (const m of messages) {
    if (m.role === 'user') {
      current = { user: m, assistants: [] };
      groups.push(current);
    } else {
      if (!current) {
        current = { assistants: [] };
        groups.push(current);
      }
      current.assistants.push(m);
    }
  }
  return groups;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  streamingMessageIds,
  avatarLabel,
  onFeedback,
  onRegenerate,
  onEditAndResend,
}) => {
  const groups = groupMessages(messages);

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
      {groups.map((group, gi) => (
        <React.Fragment key={group.user?.id ?? `g${gi}`}>
          {group.user && <UserMessage message={group.user} onEditAndResend={onEditAndResend} />}
          {group.assistants.length > 1 ? (
            <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', width: '100%' }}>
              {group.assistants.map(msg => (
                <Box key={msg.id} sx={{ flex: '1 1 320px', minWidth: 280, maxWidth: 'none' }}>
                  {msg.compareModel && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      {msg.compareModel}
                    </Typography>
                  )}
                  <AssistantMessage
                    message={msg}
                    isStreaming={streamingMessageIds.has(msg.id)}
                    avatarLabel={msg.compareModel ?? avatarLabel}
                    onFeedback={onFeedback}
                    onRegenerate={onRegenerate}
                  />
                </Box>
              ))}
            </Box>
          ) : (
            group.assistants.map(msg => (
              <AssistantMessage
                key={msg.id}
                message={msg}
                isStreaming={streamingMessageIds.has(msg.id)}
                avatarLabel={avatarLabel}
                onFeedback={onFeedback}
                onRegenerate={onRegenerate}
              />
            ))
          )}
        </React.Fragment>
      ))}
    </Box>
  );
};
