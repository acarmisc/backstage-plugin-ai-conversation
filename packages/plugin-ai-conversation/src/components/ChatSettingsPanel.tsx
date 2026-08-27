import React from 'react';
import {
  Box,
  Typography,
  Collapse,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ModelPicker } from './ModelPicker';
import { VectorStorePicker } from './VectorStorePicker';
import { PersonaPicker } from './PersonaPicker';
import { OptionPicker } from './OptionPicker';
import type { ChatConfig, ChatTraits, Persona, ReasoningEffort } from '../types';

const REASONING_EFFORT_OPTIONS: { id: ReasoningEffort; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

export interface ChatSettingsPanelProps {
  showSettings: boolean;
  onToggleShowSettings: () => void;
  configError: string | null;
  config: ChatConfig;
  personas: Persona[];
  personasLoading: boolean;
  personasError: string | null;
  personaId: string;
  onPersonaChange: (id: string, persona: Persona | undefined) => void;
  traits: ChatTraits;
  traitsLoading: boolean;
  toneId: string;
  onToneChange: (id: string) => void;
  focusId: string;
  onFocusChange: (id: string) => void;
  customSystemPrompt: string;
  onCustomSystemPromptChange: (value: string) => void;
  model: string;
  onModelChange: (model: string) => void;
  vectorStoreIds: string[];
  onVectorStoreIdsChange: (ids: string[]) => void;
  verbosityId: string;
  onVerbosityChange: (id: string) => void;
  reasoningEffort: ReasoningEffort | '';
  onReasoningEffortChange: (value: ReasoningEffort | '') => void;
}

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    variant="overline"
    sx={{ px: 1.5, pt: 1.5, display: 'block', color: 'text.secondary', fontSize: '0.7rem', letterSpacing: 1 }}
  >
    {children}
  </Typography>
);

export const ChatSettingsPanel: React.FC<ChatSettingsPanelProps> = ({
  showSettings,
  onToggleShowSettings,
  configError,
  config,
  personas,
  personasLoading,
  personasError,
  personaId,
  onPersonaChange,
  traits,
  traitsLoading,
  toneId,
  onToneChange,
  focusId,
  onFocusChange,
  customSystemPrompt,
  onCustomSystemPromptChange,
  model,
  onModelChange,
  vectorStoreIds,
  onVectorStoreIdsChange,
  verbosityId,
  onVerbosityChange,
  reasoningEffort,
  onReasoningEffortChange,
}) => (
  <Box sx={{ flexShrink: 0 }}>
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        px: 1.5,
        py: 1,
        bgcolor: 'action.hover',
      }}
      onClick={onToggleShowSettings}
    >
      <SettingsIcon fontSize="small" sx={{ mr: 1 }} />
      <Typography variant="overline" sx={{ flex: 1 }}>
        Settings
      </Typography>
      <ExpandMoreIcon
        fontSize="small"
        sx={{
          transform: showSettings ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
        }}
      />
    </Box>
    <Collapse in={showSettings}>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {configError && (
          <Typography variant="caption" color="error" sx={{ px: 1.5, pt: 1 }}>
            Couldn't load chat defaults: {configError}
          </Typography>
        )}

        {/* ── Identity ── */}
        <SectionHeader>Identity</SectionHeader>
        <Box sx={{ px: 1.5, pb: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <PersonaPicker
            value={personaId}
            personas={personas}
            loading={personasLoading}
            error={personasError}
            onChange={onPersonaChange}
          />
          <TextField
            label="Extra prompt"
            placeholder={
              personaId
                ? 'Appended after the persona system prompt…'
                : 'Used as the system prompt (no persona selected)…'
            }
            value={customSystemPrompt}
            onChange={e => onCustomSystemPromptChange(e.target.value)}
            multiline
            minRows={2}
            maxRows={6}
            size="small"
            fullWidth
          />
          <Accordion disableGutters variant="outlined" sx={{ '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Advanced
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <OptionPicker
                label="Tone"
                value={toneId}
                options={traits.tones}
                onChange={onToneChange}
                loading={traitsLoading}
              />
              <OptionPicker
                label="Focus"
                value={focusId}
                options={traits.focuses}
                onChange={onFocusChange}
                loading={traitsLoading}
              />
              <OptionPicker
                label="Verbosity"
                value={verbosityId}
                options={traits.verbosities}
                onChange={onVerbosityChange}
                loading={traitsLoading}
              />
            </AccordionDetails>
          </Accordion>
        </Box>

        {/* ── Intelligence ── */}
        <SectionHeader>Intelligence</SectionHeader>
        <Box sx={{ px: 1.5, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <ModelPicker value={model} onChange={onModelChange} defaultModel={config.defaultModel} />
          <OptionPicker
            label="Reasoning effort"
            value={reasoningEffort}
            options={REASONING_EFFORT_OPTIONS}
            onChange={id => onReasoningEffortChange(id as ReasoningEffort | '')}
            noneLabel="Model default"
          />
          <VectorStorePicker
            value={vectorStoreIds}
            onChange={onVectorStoreIdsChange}
            defaultVectorStoreIds={config.defaultVectorStoreIds}
          />
        </Box>
      </Box>
    </Collapse>
  </Box>
);
