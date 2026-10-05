import React, { useState } from 'react';
import { Box, Button, Chip, IconButton, TextField, Tooltip, useTheme, alpha } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import { safeHref } from '../safeUrl';
import { extractText } from '../hooks/messageShape';
import { RADIUS } from '../theme';
import type { AiConversationUIMessage } from '../types';

export interface UserMessageProps {
  message: AiConversationUIMessage;
  onEditAndResend?: (messageId: string, newContent: string) => void;
}

export const UserMessage: React.FC<UserMessageProps> = ({ message, onEditAndResend }) => {
  const theme = useTheme();
  const text = extractText(message);
  const fileParts = message.parts.filter(
    (p): p is { type: 'file'; url: string; mediaType: string; filename?: string } => p.type === 'file',
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const startEdit = () => {
    setDraft(text);
    setEditing(true);
  };

  const saveEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== text) {
      onEditAndResend?.(message.id, trimmed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <Box sx={{ alignSelf: 'flex-end', maxWidth: '80%', width: '100%', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <TextField
          value={draft}
          onChange={e => setDraft(e.target.value)}
          multiline
          minRows={1}
          maxRows={8}
          size="small"
          fullWidth
          placeholder="Edit message..."
          aria-label="Edit message"
        />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button size="small" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={saveEdit} disabled={!draft.trim()}>
            Save &amp; resend
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 0.5,
        '&:hover .litellm-actions': { opacity: 1 },
      }}
    >
      {message.metadata?.attachedUrl && (
        <Tooltip title={message.metadata.attachedUrl.url}>
          {/* An imported thread can carry any string here, so only link out
              when it is a real http(s) URL — otherwise show a plain chip. */}
          <Chip
            size="small"
            icon={<LinkIcon fontSize="small" />}
            label={message.metadata.attachedUrl.title}
            variant="outlined"
            {...(safeHref(message.metadata.attachedUrl.url)
              ? {
                  component: 'a' as const,
                  href: safeHref(message.metadata.attachedUrl.url),
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  clickable: true,
                }
              : {})}
          />
        </Tooltip>
      )}
      {fileParts.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'flex-end' }}>
          {fileParts.map((p, i) =>
            p.mediaType.startsWith('image/') ? (
              <Box
                key={i}
                component="img"
                src={p.url}
                alt={p.filename ?? 'attachment'}
                sx={{ maxWidth: 160, maxHeight: 160, borderRadius: RADIUS.sm }}
              />
            ) : (
              <Chip key={i} size="small" label={p.filename ?? p.mediaType} variant="outlined" />
            ),
          )}
        </Box>
      )}
      {text && (
        <Box
          sx={{
            maxWidth: '80%',
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            borderRadius: `${RADIUS.lg} ${RADIUS.lg} ${RADIUS.sm} ${RADIUS.lg}`,
            px: 1.5,
            py: 1,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {text}
        </Box>
      )}
      <Box
        className="litellm-actions"
        sx={{
          display: 'flex',
          gap: 0.5,
          opacity: 0,
          transition: 'opacity 0.15s',
        }}
      >
        {onEditAndResend && (
          <Tooltip title="Edit & resend">
            <IconButton size="small" aria-label="Edit and resend" onClick={startEdit}>
              <EditIcon fontSize="small" />
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
  );
};
