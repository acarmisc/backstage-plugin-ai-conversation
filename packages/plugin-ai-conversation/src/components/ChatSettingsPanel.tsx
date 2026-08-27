import React from 'react';
import {
  Box,
  Typography,
  Collapse,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ModelPicker } from './ModelPicker';
import { CompareModelPicker } from './CompareModelPicker';
import { VectorStorePicker } from './VectorStorePicker';
import { PersonaPicker } from './PersonaPicker';
import { KeyPicker } from './KeyPicker';
import { OptionPicker } from './OptionPicker';
import type { AiConversationApiInterface } from '../api';
import type { ChatConfig, ChatTraits, Persona, ReasoningEffort } from '../types';

// Fixed, provider-agnostic enum — no prompt text attached (see
// ReasoningEffort in types.ts), so unlike tone/focus/verbosity it doesn't
// need a backend round-trip.
const REASONING_EFFORT_OPTIONS: { id: ReasoningEffort; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

export interface ChatSettingsPanelProps {
  chatApi: AiConversationApiInterface;
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
  compareMode: boolean;
  onCompareModeChange: (enabled: boolean) => void;
  compareModelsSel: string[];
  onCompareModelsChange: (models: string[]) => void;
  model: string;
  onModelChange: (model: string) => void;
  vectorStoreIds: string[];
  onVectorStoreIdsChange: (ids: string[]) => void;
  webSearch: boolean;
  onWebSearchChange: (enabled: boolean) => void;
  verbosityId: string;
  onVerbosityChange: (id: string) => void;
  reasoningEffort: ReasoningEffort | '';
  onReasoningEffortChange: (value: ReasoningEffort | '') => void;
  keyVal: { alias: string; token: string };
  onKeyChange: (value: { alias: string; token: string }) => void;
  activeThreadKeyToken?: string;
}

/**
 * Settings panel extracted from ChatPage.tsx (HANDOFF-ai-sdk-migration.md
 * Phase 21 "UI tidy-up") — persona/tone/focus/model/compare/KB/web-search/
 * verbosity/reasoning/key pickers. Mechanical extraction, not a redesign:
 * same fields, same layout, just moved out of ChatPage's Collapse. State
 * ownership stays lifted in ChatPage (passed into useThreads), since these
 * values feed the active send request, not just this panel's own rendering.
 */
export const ChatSettingsPanel: React.FC<ChatSettingsPanelProps> = ({
  chatApi,
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
  compareMode,
  onCompareModeChange,
  compareModelsSel,
  onCompareModelsChange,
  model,
  onModelChange,
  vectorStoreIds,
  onVectorStoreIdsChange,
  webSearch,
  onWebSearchChange,
  verbosityId,
  onVerbosityChange,
  reasoningEffort,
  onReasoningEffortChange,
  keyVal,
  onKeyChange,
  activeThreadKeyToken,
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
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {configError && (
          <Typography variant="caption" color="error">
            Couldn't load chat defaults: {configError}
          </Typography>
        )}
        <PersonaPicker
          value={personaId}
          personas={personas}
          loading={personasLoading}
          error={personasError}
          onChange={onPersonaChange}
        />
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
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
        </Box>
        <TextField
          label="Custom system prompt"
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
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={compareMode}
              onChange={e => onCompareModeChange(e.target.checked)}
            />
          }
          label={<Typography variant="body2">Compare models side-by-side</Typography>}
        />
        {compareMode ? (
          <CompareModelPicker value={compareModelsSel} onChange={onCompareModelsChange} />
        ) : (
          <ModelPicker value={model} onChange={onModelChange} defaultModel={config.defaultModel} />
        )}
        <Accordion disableGutters variant="outlined" sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Advanced
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <VectorStorePicker
              value={vectorStoreIds}
              onChange={onVectorStoreIdsChange}
              defaultVectorStoreIds={config.defaultVectorStoreIds}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={webSearch}
                  onChange={e => onWebSearchChange(e.target.checked)}
                />
              }
              label={<Typography variant="body2">Include web search</Typography>}
            />
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <OptionPicker
                label="Verbosity"
                value={verbosityId}
                options={traits.verbosities}
                onChange={onVerbosityChange}
                loading={traitsLoading}
              />
              <OptionPicker
                label="Reasoning effort"
                value={reasoningEffort}
                options={REASONING_EFFORT_OPTIONS}
                onChange={id => onReasoningEffortChange(id as ReasoningEffort | '')}
                noneLabel="Model default"
              />
            </Box>
            <KeyPicker
              value={keyVal}
              onChange={onKeyChange}
              onDelete={() => {
                if (activeThreadKeyToken) {
                  chatApi.deleteChatKey(activeThreadKeyToken).catch(() => {});
                }
              }}
            />
          </AccordionDetails>
        </Accordion>
      </Box>
    </Collapse>
  </Box>
);
