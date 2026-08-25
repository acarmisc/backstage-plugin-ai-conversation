import React from 'react';
import {
  Box,
  IconButton,
  Typography,
  Tooltip,
  InputBase,
  Chip,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';

export interface ChatComposerProps {
  /**
   * URL preview chip (React.ReactNode already computed in ChatPage)
   */
  urlPreviewChip: React.ReactNode;

  /**
   * Whether URL preview is loading
   */
  urlPreviewLoading: boolean;

  /**
   * URL preview data (null if not loaded or dismissed)
   */
  urlPreview: { url: string; title: string } | null;

  /**
   * URL preview error message (null if no error)
   */
  urlPreviewError: string | null;

  /**
   * Current input text
   */
  input: string;

  /**
   * Called when input text changes
   */
  onInputChange: (value: string) => void;

  /**
   * Called on keydown (handles Enter to send)
   */
  onKeyDown: (e: React.KeyboardEvent) => void;

  /**
   * Current key value with alias and token
   */
  keyVal: { alias: string; token: string };

  /**
   * Whether a message is currently streaming
   */
  isStreaming: boolean;

  /**
   * Called when Stop button is clicked
   */
  onStop: () => void;

  /**
   * Called when Send button is clicked
   */
  onSend: () => void;

  /**
   * Whether the Send button should be disabled
   */
  sendDisabled: boolean;

  /**
   * Status parts to display (tokens, budget, etc.)
   */
  statusParts: string[];

  /**
   * Whether compare mode is active
   */
  compareMode: boolean;

  /**
   * Number of models selected for comparison
   */
  compareModelsCount: number;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  urlPreviewChip,
  urlPreviewLoading,
  urlPreview,
  urlPreviewError,
  input,
  onInputChange,
  onKeyDown,
  keyVal,
  isStreaming,
  onStop,
  onSend,
  sendDisabled,
  statusParts,
  compareMode,
  compareModelsCount,
}) => {
  const sendTooltipLabel =
    compareMode && compareModelsCount === 0 ? 'Select at least one model to compare' : 'Send';

  return (
    <>
      {/* #url attachment chip */}
      {(urlPreviewLoading || urlPreview || urlPreviewError) && (
        <Box sx={{ px: 2, pt: 1 }}>
          {urlPreviewChip}
        </Box>
      )}

      {/* Compare mode badge */}
      {compareMode && (
        <Box sx={{ px: 2, pt: 1 }}>
          <Chip
            size="small"
            label={`Compare · ${compareModelsCount} model${compareModelsCount !== 1 ? 's' : ''}`}
            color="primary"
            variant="outlined"
          />
        </Box>
      )}

      {/* Fixed composer */}
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
        <InputBase
          multiline
          minRows={1}
          maxRows={5}
          fullWidth
          placeholder={
            keyVal.token
              ? 'Send a message…  (#url to attach a page, Enter to send, Shift+Enter for newline)'
              : 'Generate a chat key in Settings to start…'
          }
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!keyVal.token}
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
          <Tooltip title={sendTooltipLabel}>
            <IconButton
              color="primary"
              onClick={onSend}
              disabled={sendDisabled}
            >
              <SendIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Status strip */}
      {statusParts.length > 0 && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {statusParts.join(' · ')}
          </Typography>
        </Box>
      )}
    </>
  );
};
