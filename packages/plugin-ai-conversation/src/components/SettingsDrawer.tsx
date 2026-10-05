import React from 'react';
import {
  Box,
  Button,
  Divider,
  Drawer,
  Stack,
  Switch,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import { OptionPicker } from './OptionPicker';
import { RADIUS } from '../theme';
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
  const theme = useTheme();

  const hasNonDefaults =
    toneId !== (traits.tones[0]?.id || '') ||
    focusId !== (traits.focuses[0]?.id || '') ||
    verbosityId !== (traits.verbosities[0]?.id || '') ||
    reasoningEffort !== '' ||
    webSearch ||
    customSystemPrompt.trim() !== '';

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
          p: 3,
        },
      }}
    >
      <Stack spacing={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TuneIcon />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Conversation settings
          </Typography>
        </Box>

        {/* Scrollable content */}
        <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
          <Stack spacing={3}>
            {/* Style section */}
            <Box>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  mb: 1.5,
                  color: theme.palette.text.primary,
                }}
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
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  mb: 1.5,
                  color: theme.palette.text.primary,
                }}
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
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  mb: 1.5,
                  color: theme.palette.text.primary,
                }}
              >
                Sources
              </Typography>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }} id="web-search-label">
                    Web search
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                    Let models with a web search tool look things up, alongside the
                    knowledge bases
                  </Typography>
                </Box>
                <Switch
                  checked={webSearch}
                  onChange={e => onWebSearchChange(e.target.checked)}
                  inputProps={{ 'aria-labelledby': 'web-search-label' }}
                />
              </Stack>
            </Box>

            <Divider />

            {/* Instructions section */}
            <Box>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  mb: 1.5,
                  color: theme.palette.text.primary,
                }}
              >
                Instructions
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={4}
                maxRows={10}
                placeholder="Add custom instructions for this conversation…"
                value={customSystemPrompt}
                onChange={e => onCustomSystemPromptChange(e.target.value)}
                variant="outlined"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: RADIUS.md,
                  },
                }}
              />
            </Box>
          </Stack>
        </Box>

        {/* Footer buttons */}
        <Stack spacing={1} sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={onResetDefaults}
            size="small"
            disabled={!hasNonDefaults}
            sx={{ textTransform: 'none' }}
          >
            Reset to defaults
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={onClose}
            size="small"
            sx={{ textTransform: 'none' }}
          >
            Done
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
};
