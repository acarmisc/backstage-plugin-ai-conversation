import React from 'react';
import { Box } from '@mui/material';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import type { AiConversationUIMessage } from '../types';

export interface MessageListProps {
  messages: AiConversationUIMessage[];
  streamingMessageIds: Set<string>;
  avatarLabel?: string;
  modelLabel?: string;
  onFeedback?: (messageId: string, vote: 'up' | 'down') => void;
  onRegenerate?: (messageId: string) => void;
  onEditAndResend?: (messageId: string, newContent: string) => void;
  onShowSources?: () => void;
}

interface MessageGroup {
  user?: AiConversationUIMessage;
  assistants: AiConversationUIMessage[];
}

// Groups messages into turns — a user message plus the assistant reply(ies)
// that immediately follow it. In compare mode a turn has several assistant
// messages (one per model, sharing turnId) and renders as side-by-side
// columns instead of a single stacked reply.
function groupMessages(messages: AiConversationUIMessage[]): MessageGroup[] {
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
  modelLabel,
  onFeedback,
  onRegenerate,
  onEditAndResend,
  onShowSources,
}) => {
  const groups = groupMessages(messages);

  return (
    <Box
      sx={{
        flex: 1,
        overflowY: 'auto',
        px: 2,
        py: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      {groups.map((group, gi) => (
        <React.Fragment key={group.user?.id ?? `g${gi}`}>
          {group.user && <UserMessage message={group.user} onEditAndResend={onEditAndResend} />}
          {group.assistants.length > 1 ? (
            <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', width: '100%' }}>
              {group.assistants.map(msg => (
                <Box key={msg.id} sx={{ flex: '1 1 320px', minWidth: 280, maxWidth: 'none' }}>
                  <AssistantMessage
                    message={msg}
                    isStreaming={streamingMessageIds.has(msg.id)}
                    avatarLabel={msg.metadata?.compareModel ?? avatarLabel}
                    modelLabel={msg.metadata?.compareModel ?? modelLabel}
                    onFeedback={onFeedback}
                    onRegenerate={onRegenerate}
                    onShowSources={onShowSources}
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
                modelLabel={modelLabel}
                onFeedback={onFeedback}
                onRegenerate={onRegenerate}
                onShowSources={onShowSources}
              />
            ))
          )}
        </React.Fragment>
      ))}
    </Box>
  );
};
