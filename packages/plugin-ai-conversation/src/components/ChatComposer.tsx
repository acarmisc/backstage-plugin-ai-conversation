import React from 'react';
import { Box, Chip, IconButton, InputBase, Tooltip } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import type { FileUIPart } from 'ai';
import type { UrlContextPreview } from '../types';

/** Mirrors the backend's attachments.ts allow-list. The two packages don't
 * share a types module, so it's kept in sync by hand — a mismatch only means
 * the user sees a later 400 instead of an earlier client-side warning. The
 * per-message *count* limit lives in useStagedFiles, next to the check. */
export const ALLOWED_ATTACHMENT_MEDIA_TYPES = 'image/png,image/jpeg,image/webp,image/gif';

export interface ChatComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  isStreaming: boolean;
  onStop: () => void;

  stagedFiles: FileUIPart[];
  onRemoveStagedFile: (index: number) => void;
  attachError: string | null;
  onDismissAttachError: () => void;
  attachInputRef: React.RefObject<HTMLInputElement>;
  onAttachFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;

  urlPreview: UrlContextPreview | null;
  urlPreviewLoading: boolean;
  urlPreviewError: string | null;
  onDismissUrlPreview: () => void;
}

/** One preview chip for the composer's `#url` affordance — loading, error,
 * or the resolved page title. Only ever shows title/snippet; the full page
 * text is fetched server-side at send time. */
const UrlPreviewChip: React.FC<{
  loading: boolean;
  error: string | null;
  preview: UrlContextPreview | null;
  onDismiss: () => void;
}> = ({ loading, error, preview, onDismiss }) => {
  if (loading) {
    return (
      <Chip
        size="small"
        icon={<LinkIcon fontSize="small" />}
        label="Fetching page…"
        variant="outlined"
      />
    );
  }
  if (error) {
    return (
      <Chip
        size="small"
        color="error"
        icon={<LinkIcon fontSize="small" />}
        label={error}
        variant="outlined"
        onDelete={onDismiss}
        deleteIcon={<CloseIcon fontSize="small" />}
      />
    );
  }
  if (preview) {
    return (
      <Tooltip title={preview.url}>
        <Chip
          size="small"
          icon={<LinkIcon fontSize="small" />}
          label={`Page attached: ${preview.title}`}
          variant="outlined"
          onDelete={onDismiss}
          deleteIcon={<CloseIcon fontSize="small" />}
        />
      </Tooltip>
    );
  }
  return null;
};

/**
 * The composer strip: attachment button, staged-file and `#url` chips, the
 * textarea, and the send/stop button. Presentational — all state lives in
 * ChatPage.
 */
export const ChatComposer: React.FC<ChatComposerProps> = ({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  isStreaming,
  onStop,
  stagedFiles,
  onRemoveStagedFile,
  attachError,
  onDismissAttachError,
  attachInputRef,
  onAttachFiles,
  urlPreview,
  urlPreviewLoading,
  urlPreviewError,
  onDismissUrlPreview,
}) => {
  const showUrlChip = urlPreviewLoading || !!urlPreview || !!urlPreviewError;
  const showAttachments = stagedFiles.length > 0 || !!attachError;

  return (
    <>
      {showUrlChip && (
        <Box sx={{ px: 2, pt: 1 }}>
          <UrlPreviewChip
            loading={urlPreviewLoading}
            error={urlPreviewError}
            preview={urlPreview}
            onDismiss={onDismissUrlPreview}
          />
        </Box>
      )}

      {showAttachments && (
        <Box sx={{ px: 2, pt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {stagedFiles.map((f, i) => (
            <Chip
              key={i}
              size="small"
              icon={<AttachFileIcon fontSize="small" />}
              label={f.filename ?? f.mediaType}
              variant="outlined"
              onDelete={() => onRemoveStagedFile(i)}
              deleteIcon={<CloseIcon fontSize="small" />}
            />
          ))}
          {attachError && (
            <Chip
              size="small"
              color="error"
              label={attachError}
              variant="outlined"
              onDelete={onDismissAttachError}
              deleteIcon={<CloseIcon fontSize="small" />}
            />
          )}
        </Box>
      )}

      <Box
        sx={{
          flexShrink: 0,
          borderTop: 1,
          borderColor: 'divider',
          px: 2,
          py: 1.5,
          display: 'flex',
          gap: 1,
          alignItems: 'flex-end',
        }}
      >
        <Tooltip title="Attach image">
          <IconButton size="small" onClick={() => attachInputRef.current?.click()}>
            <AttachFileIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <input
          ref={attachInputRef}
          type="file"
          accept={ALLOWED_ATTACHMENT_MEDIA_TYPES}
          multiple
          hidden
          onChange={onAttachFiles}
        />
        <InputBase
          multiline
          minRows={1}
          maxRows={5}
          fullWidth
          placeholder="Send a message…  (Enter to send, Shift+Enter for newline)"
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            px: 1.5,
            py: 0.75,
            fontSize: '0.9rem',
          }}
        />
        {isStreaming ? (
          <Tooltip title="Stop">
            <IconButton color="error" onClick={onStop}>
              <StopIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title="Send">
            <IconButton color="primary" onClick={onSend} disabled={!input.trim()}>
              <SendIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </>
  );
};
