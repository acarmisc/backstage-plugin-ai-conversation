import React from 'react';
import { Box, IconButton } from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '../types';

export interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onFeedback?: (messageId: string, vote: 'up' | 'down') => void;
}

const blink = {
  '@keyframes blink': {
    '0%, 50%': { opacity: 1 },
    '51%, 100%': { opacity: 0 },
  },
};

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isStreaming,
  onFeedback,
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
        const showFeedback =
          !isUser && !!msg.content && !(isStreaming && isLast) && !!onFeedback;

        return (
          <Box
            key={msg.id}
            sx={{
              alignSelf: isUser ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
            }}
          >
            <Box
              sx={{
                bgcolor: isUser ? 'primary.main' : 'background.paper',
                color: isUser ? 'primary.contrastText' : 'text.primary',
                border: isUser ? 'none' : 1,
                borderColor: 'divider',
                borderRadius: 2,
                px: 1.5,
                py: 1,
                wordBreak: 'break-word',
                '& p': { margin: 0 },
                '& pre': { overflowX: 'auto', maxWidth: '100%' },
                '& code': {
                  fontFamily: 'monospace',
                  fontSize: '0.85em',
                  bgcolor: isUser ? 'transparent' : 'action.hover',
                  px: 0.5,
                  borderRadius: 0.5,
                },
                '& pre code': { bgcolor: 'transparent', px: 0 },
              }}
            >
              {isUser ? (
                <Box sx={{ whiteSpace: 'pre-wrap' }}>{msg.content}</Box>
              ) : msg.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              ) : isStreaming && isLast ? (
                <Box
                  component="span"
                  sx={{
                    display: 'inline-block',
                    width: 8,
                    height: 16,
                    bgcolor: 'text.primary',
                    animation: 'blink 1s step-end infinite',
                    verticalAlign: 'text-bottom',
                    ...blink,
                  }}
                />
              ) : null}
            </Box>
            {showFeedback && (
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
                <IconButton
                  size="small"
                  aria-label="Good response"
                  color={msg.feedback === 'up' ? 'primary' : 'default'}
                  onClick={() => onFeedback!(msg.id, 'up')}
                >
                  {msg.feedback === 'up' ? (
                    <ThumbUpIcon fontSize="small" />
                  ) : (
                    <ThumbUpOutlinedIcon fontSize="small" />
                  )}
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Bad response"
                  color={msg.feedback === 'down' ? 'primary' : 'default'}
                  onClick={() => onFeedback!(msg.id, 'down')}
                >
                  {msg.feedback === 'down' ? (
                    <ThumbDownIcon fontSize="small" />
                  ) : (
                    <ThumbDownOutlinedIcon fontSize="small" />
                  )}
                </IconButton>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};