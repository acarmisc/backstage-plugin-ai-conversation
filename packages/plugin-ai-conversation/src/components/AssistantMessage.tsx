import React, { useState } from 'react';
import { Box, Chip, IconButton, Tooltip } from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ReplayIcon from '@mui/icons-material/Replay';
import BuildIcon from '@mui/icons-material/Build';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { PersonaAvatar } from './PersonaAvatar';
import { CodeBlock } from './CodeBlock';
import { extractText } from '../hooks/messageShape';
import type { AiConversationUIMessage } from '../types';

export interface AssistantMessageProps {
  message: AiConversationUIMessage;
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

/**
 * Renders one `tool-*` part in a pending/result/error state. Nothing in
 * this repo calls a tool yet (see HANDOFF-ai-sdk-migration.md "Future: MCP
 * readiness") — this exists so wiring an actual tool call later is "add a
 * `tools` param server-side", not "also build a renderer for it".
 */
const ToolCallPart: React.FC<{ part: any }> = ({ part }) => {
  const toolName = part.type?.startsWith('tool-') ? part.type.slice('tool-'.length) : 'tool';
  const state: string = part.state ?? 'input-available';
  if (state === 'output-error' || part.errorText) {
    return (
      <Chip
        size="small"
        icon={<ErrorOutlineIcon fontSize="small" />}
        label={`${toolName} failed`}
        color="error"
        variant="outlined"
        sx={{ mb: 0.5 }}
      />
    );
  }
  if (state === 'output-available') {
    return (
      <Chip
        size="small"
        icon={<BuildIcon fontSize="small" />}
        label={`${toolName} done`}
        variant="outlined"
        sx={{ mb: 0.5 }}
      />
    );
  }
  return (
    <Chip
      size="small"
      icon={<BuildIcon fontSize="small" />}
      label={`${toolName}…`}
      variant="outlined"
      sx={{ mb: 0.5 }}
    />
  );
};

const FilePart: React.FC<{ url: string; mediaType: string; filename?: string }> = ({
  url,
  mediaType,
  filename,
}) => {
  if (mediaType.startsWith('image/')) {
    return (
      <Box
        component="img"
        src={url}
        alt={filename ?? 'attachment'}
        sx={{ maxWidth: 240, maxHeight: 240, borderRadius: 1, display: 'block', mb: 0.5 }}
      />
    );
  }
  return (
    <Chip size="small" label={filename ?? mediaType} variant="outlined" sx={{ mb: 0.5 }} />
  );
};

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  isStreaming,
  avatarLabel = 'AI',
  onFeedback,
  onRegenerate,
}) => {
  const [copied, setCopied] = useState(false);
  const text = extractText(message);
  const showActions = !!text && !isStreaming;

  const handleCopy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const cursor = (
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
  );

  let body: React.ReactNode;
  if (message.parts.length > 0) {
    body = message.parts.map((part, i) => {
      if (part.type === 'text') {
        if (!part.text) return null;
        return (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{ code: CodeBlock }}
          >
            {part.text}
          </ReactMarkdown>
        );
      }
      if (part.type === 'file') {
        const p = part as { url: string; mediaType: string; filename?: string };
        return <FilePart key={i} url={p.url} mediaType={p.mediaType} filename={p.filename} />;
      }
      if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
        return <ToolCallPart key={i} part={part} />;
      }
      return null;
    });
  } else if (isStreaming) {
    body = cursor;
  } else {
    body = null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        alignSelf: 'flex-start',
        maxWidth: '85%',
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
          {body}
        </Box>
        {showActions && (
          <Box
            className="litellm-actions"
            sx={{ display: 'flex', gap: 0.25, mt: 0.25 }}
          >
            {onFeedback && (
              <>
                <IconButton
                  size="small"
                  aria-label="Good response"
                  color={message.metadata?.feedback === 'up' ? 'primary' : 'default'}
                  onClick={() => onFeedback(message.id, 'up')}
                >
                  {message.metadata?.feedback === 'up' ? (
                    <ThumbUpIcon fontSize="small" />
                  ) : (
                    <ThumbUpOutlinedIcon fontSize="small" />
                  )}
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Bad response"
                  color={message.metadata?.feedback === 'down' ? 'primary' : 'default'}
                  onClick={() => onFeedback(message.id, 'down')}
                >
                  {message.metadata?.feedback === 'down' ? (
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
