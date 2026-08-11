import React, { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ReplayIcon from '@mui/icons-material/Replay';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { PersonaAvatar } from './PersonaAvatar';
import { CodeBlock } from './CodeBlock';
import type { ChatMessage } from '../types';

export interface AssistantMessageProps {
  message: ChatMessage;
  isStreaming: boolean;
  avatarLabel?: string;
  onFeedback?: (messageId: string, vote: 'up' | 'down') => void;
  onRegenerate?: (messageId: string) => void;
}

const blink = {
  '@keyframes blink': {
    '0%, 50%': { opacity: 1 },
    '51%, 100%': { opacity: 0 },
  },
};

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  isStreaming,
  avatarLabel = 'AI',
  onFeedback,
  onRegenerate,
}) => {
  const [copied, setCopied] = useState(false);
  const showActions = !!message.content && !isStreaming;

  const handleCopy = () => {
    navigator.clipboard?.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        alignSelf: 'flex-start',
        maxWidth: '85%',
        '&:hover .litellm-actions': { opacity: 1 },
      }}
    >
      <PersonaAvatar label={avatarLabel.slice(0, 2).toUpperCase()} isStreaming={isStreaming} size={28} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box
          sx={{
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: '12px',
            px: 1.5,
            py: 1,
            wordBreak: 'break-word',
            '& p': { m: 0, mb: '0.5em' },
            '& p:last-child': { mb: 0 },
            '& pre': { overflowX: 'auto', maxWidth: '100%' },
            '& code': { fontSize: '0.85em' },
            '& pre code': { bgcolor: 'transparent', px: 0 },
          }}
        >
          {message.content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{ code: CodeBlock }}
            >
              {message.content}
            </ReactMarkdown>
          ) : isStreaming ? (
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
        {showActions && (
          <Box
            className="litellm-actions"
            sx={{ display: 'flex', gap: 0.25, mt: 0.25, opacity: 0, transition: 'opacity 0.15s' }}
          >
            {onFeedback && (
              <>
                <IconButton
                  size="small"
                  aria-label="Good response"
                  color={message.feedback === 'up' ? 'primary' : 'default'}
                  onClick={() => onFeedback(message.id, 'up')}
                >
                  {message.feedback === 'up' ? (
                    <ThumbUpIcon fontSize="small" />
                  ) : (
                    <ThumbUpOutlinedIcon fontSize="small" />
                  )}
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Bad response"
                  color={message.feedback === 'down' ? 'primary' : 'default'}
                  onClick={() => onFeedback(message.id, 'down')}
                >
                  {message.feedback === 'down' ? (
                    <ThumbDownIcon fontSize="small" />
                  ) : (
                    <ThumbDownOutlinedIcon fontSize="small" />
                  )}
                </IconButton>
              </>
            )}
            {onRegenerate && (
              <Tooltip title="Regenerate">
                <IconButton size="small" aria-label="Regenerate" onClick={() => onRegenerate(message.id)}>
                  <ReplayIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={copied ? 'Copied' : 'Copy'}>
              <IconButton size="small" aria-label="Copy" onClick={handleCopy}>
                {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );
};
