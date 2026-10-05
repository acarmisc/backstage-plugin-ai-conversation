import React, { useState } from 'react';
import { Box, Chip, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography, Paper } from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ReplayIcon from '@mui/icons-material/Replay';
import BuildIcon from '@mui/icons-material/Build';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { StreamingAvatar } from './StreamingAvatar';
import { CodeBlock } from './CodeBlock';
import { TypingIndicator } from './TypingIndicator';
import { extractText } from '../hooks/messageShape';
import type { AiConversationUIMessage } from '../types';

export interface AssistantMessageProps {
  message: AiConversationUIMessage;
  isStreaming: boolean;
  avatarLabel?: string;
  modelLabel?: string;
  onFeedback?: (messageId: string, vote: 'up' | 'down') => void;
  onRegenerate?: (messageId: string) => void;
  onShowSources?: () => void;
}

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

const FilePart: React.FC<{ url: string; mediaType: string; filename?: string }> = (
  { url, mediaType, filename }: { url: string; mediaType: string; filename?: string },
) => {
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
  modelLabel,
  onFeedback,
  onRegenerate,
  onShowSources,
}) => {
  const [copied, setCopied] = useState(false);
  const text = extractText(message);

  // Check for citations and token usage in message parts
  // Data parts carry their payload in `data` (AI SDK UI message stream).
  const citationsData = (message.parts.find(p => p.type === 'data-citations') as any)?.data;
  const citationCount = Array.isArray(citationsData) ? citationsData.length : 0;

  const usageData = (message.parts.find(p => p.type === 'data-usage') as any)?.data;
  const tokenCount: number | undefined =
    typeof usageData?.total_tokens === 'number' ? usageData.total_tokens : undefined;

  const showActions = !!text || !isStreaming;

  const handleCopy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  let body: React.ReactNode;
  if (message.parts.length > 0) {
    body = message.parts.map((part: any, i: number) => {
      if (part.type === 'text') {
        if (!part.text) return null;
        return (
          <Box
            key={i}
            sx={{
              '& p': { m: 0, mb: '0.5em' },
              '& p:last-child': { mb: 0 },
              '& ul, & ol': { pl: 2, mb: '0.5em' },
              '& li': { mb: '0.25em' },
              '& blockquote': {
                borderLeftColor: 'divider',
                borderLeftWidth: '4px',
                borderLeftStyle: 'solid',
                paddingLeft: '1em',
                marginLeft: 0,
                color: 'text.secondary',
              },
              '& pre': {
                overflowX: 'auto',
              },
              '& a': { color: 'primary.main', textDecoration: 'none' },
              '& a:hover': { textDecoration: 'underline' },
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                code: CodeBlock,
                // Headings stay below the page and header titles.
                h1: ({ children }) => <Typography variant="h6" component="h3" sx={{ mt: 2, mb: 1 }}>{children}</Typography>,
                h2: ({ children }) => <Typography variant="subtitle1" component="h4" sx={{ mt: 2, mb: 0.5 }}>{children}</Typography>,
                h3: ({ children }) => <Typography variant="subtitle2" component="h5" sx={{ mt: 1.5, mb: 0.5 }}>{children}</Typography>,
                h4: ({ children }) => <Typography variant="subtitle2" component="h6" sx={{ mt: 1.5, mb: 0.5 }}>{children}</Typography>,
                table: ({ children }) => (
                  <TableContainer component={Paper} variant="outlined" sx={{ my: 1, overflowWrap: 'normal' }}>
                    <Table size="small">{children}</Table>
                  </TableContainer>
                ),
                thead: ({ children }) => <TableHead>{children}</TableHead>,
                tbody: ({ children }) => <TableBody>{children}</TableBody>,
                tr: ({ children }) => <TableRow>{children}</TableRow>,
                // The Backstage theme breaks words in table cells; in narrow
                // compare columns that splits short words mid-way.
                th: ({ children }) => <TableCell sx={{ wordBreak: 'normal' }}>{children}</TableCell>,
                td: ({ children }) => <TableCell sx={{ wordBreak: 'normal' }}>{children}</TableCell>,
              }}
            >
              {part.text}
            </ReactMarkdown>
          </Box>
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
    body = <TypingIndicator size={3} />;
  } else {
    body = null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        alignSelf: 'flex-start',
        width: '100%',
        '&:hover .litellm-actions': { opacity: 1 },
      }}
    >
      <StreamingAvatar label={avatarLabel.slice(0, 2).toUpperCase()} isStreaming={isStreaming} size={28} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {/* Model label caption */}
        {modelLabel && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 0.5 }}
          >
            {modelLabel}
          </Typography>
        )}

        {/* Message content */}
        <Box
          sx={{
            overflowWrap: 'anywhere',
            typography: 'body1',
            '& p': { m: 0, mb: '0.5em' },
            '& p:last-child': { mb: 0 },
            '& ul, & ol': { pl: 2, mb: '0.5em' },
            '& li': { mb: '0.25em' },
          }}
        >
          {body}
        </Box>

        {/* Sources chip */}
        {citationCount > 0 && (
          <Box sx={{ mt: 1 }}>
            <Chip
              icon={<MenuBookIcon />}
              label={`${citationCount} source${citationCount !== 1 ? 's' : ''}`}
              size="small"
              variant="outlined"
              onClick={onShowSources}
              sx={{
                cursor: onShowSources ? 'pointer' : 'default',
              }}
            />
          </Box>
        )}

        {/* Token count and actions */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 1,
            gap: 1,
          }}
        >
          {tokenCount !== undefined && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flex: 1 }}
            >
              {tokenCount.toLocaleString()} tokens
            </Typography>
          )}

          <Box
            className="litellm-actions"
            sx={{
              display: 'flex',
              gap: 0.5,
              opacity: showActions && !isStreaming ? 1 : 0,
              transition: 'opacity 0.15s',
            }}
          >
            {onFeedback && (
              <>
                <Tooltip title="Good response">
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
                </Tooltip>
                <Tooltip title="Bad response">
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
                </Tooltip>
              </>
            )}
            {onRegenerate && (
              <Tooltip title="Regenerate">
                <IconButton
                  size="small"
                  aria-label="Regenerate"
                  onClick={() => onRegenerate(message.id)}
                >
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
        </Box>
      </Box>
    </Box>
  );
};
