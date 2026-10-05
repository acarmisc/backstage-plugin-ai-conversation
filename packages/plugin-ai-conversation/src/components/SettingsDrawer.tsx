import React from 'react';
import {
  Box,
  Button,
  Divider,
  IconButton,
  Drawer,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { OptionPicker } from './OptionPicker';
import type { ChatTraits, ReasoningEffort } from '../types';

export interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  traits: ChatTraits;
  traitsLoading: boolean;
  toneId: string;
  onToneChange: (id: string) => void;
  focusId: string;
  onFocusChange: (id: string) => void;
  verbosityId: string;
  onVerbosityChange: (id: string) => void;
  reasoningEffort: ReasoningEffort | '';
  onReasoningEffortChange: (value: ReasoningEffort | '') => void;
  webSearch: boolean;
  onWebSearchChange: (enabled: boolean) => void;
  customSystemPrompt: string;
  onCustomSystemPromptChange: (value: string) => void;
  onResetDefaults?: () => void;
}

/** True when any conversation setting differs from its default (unset). */
export function hasCustomSettings(s: {
  toneId: string;
  focusId: string;
  verbosityId: string;
  reasoningEffort: string;
  webSearch: boolean;
  customSystemPrompt: string;
}): boolean {
  return (
    !!s.toneId ||
    !!s.focusId ||
    !!s.verbosityId ||
    !!s.reasoningEffort ||
    s.webSearch ||
    s.customSystemPrompt.trim() !== ''
  );
}

const REASONING_EFFORTS: { id: ReasoningEffort | ''; label: string }[] = [
  { id: '', label: 'Default' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  open,
  onClose,
  traits,
  traitsLoading,
  toneId,
  onToneChange,
  focusId,
  onFocusChange,
  verbosityId,
  onVerbosityChange,
  reasoningEffort,
  onReasoningEffortChange,
  webSearch,
  onWebSearchChange,
  customSystemPrompt,
  onCustomSystemPromptChange,
  onResetDefaults,
}) => {
  const hasNonDefaults = hasCustomSettings({
    toneId,
    focusId,
    verbosityId,
    reasoningEffort,
    webSearch,
    customSystemPrompt,
  });

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 360,
          maxWidth: '100vw',
          boxSizing: 'border-box',
          p: 2,
        },
      }}
    >
      <Stack spacing={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
          <Typography variant="h6">
            Conversation settings
          </Typography>
          <IconButton size="small" aria-label="Close settings" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider />

        {/* Scrollable content */}
        <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
          <Stack spacing={3}>
            {/* Style section */}
            <Box>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ mb: 1.5, display: 'block' }}
              >
                Style
              </Typography>
              <Stack spacing={2}>
                {traits.tones.length > 0 && (
                  <OptionPicker
                    label="Tone"
                    options={traits.tones}
                    value={toneId}
                    onChange={onToneChange}
                    loading={traitsLoading}
                  />
                )}
                {traits.focuses.length > 0 && (
                  <OptionPicker
                    label="Focus"
                    options={traits.focuses}
                    value={focusId}
                    onChange={onFocusChange}
                    loading={traitsLoading}
                  />
                )}
                {traits.verbosities.length > 0 && (
                  <OptionPicker
                    label="Verbosity"
                    options={traits.verbosities}
                    value={verbosityId}
                    onChange={onVerbosityChange}
                    loading={traitsLoading}
                  />
                )}
              </Stack>
            </Box>

            <Divider />

            {/* Reasoning effort section */}
            <Box>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ mb: 1.5, display: 'block' }}
              >
                Reasoning effort
              </Typography>
              <OptionPicker
                label="Effort level"
                options={REASONING_EFFORTS}
                value={reasoningEffort}
                onChange={id => onReasoningEffortChange(id as ReasoningEffort | '')}
              />
            </Box>

            <Divider />

            {/* Sources section */}
            <Box>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ mb: 1.5, display: 'block' }}
              >
                Sources
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={webSearch}
                    onChange={e => onWebSearchChange(e.target.checked)}
                  />
                }
                label={
                  <Stack spacing={0}>
                    <Typography variant="body2">Web search</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Let models with a web search tool look things up, alongside the
                      knowledge bases
                    </Typography>
                  </Stack>
                }
              />
            </Box>

            <Divider />

            {/* Instructions section */}
            <Box>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ mb: 1.5, display: 'block' }}
              >
                Instructions
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={4}
                placeholder="Add custom instructions for this conversation…"
                value={customSystemPrompt}
                onChange={e => onCustomSystemPromptChange(e.target.value)}
                variant="outlined"
                size="small"
              />
            </Box>
          </Stack>
        </Box>

        {/* Footer buttons */}
        <Divider />
        <Stack direction="row" spacing={1}>
          <Button
            variant="text"
            onClick={onResetDefaults}
            disabled={!hasNonDefaults}
            size="small"
          >
            Reset to defaults
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            onClick={onClose}
            size="small"
          >
            Done
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
};
