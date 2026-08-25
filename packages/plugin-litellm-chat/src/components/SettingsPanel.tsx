import React from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  TextField,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { PersonaPicker } from './PersonaPicker';
import { KeyPicker } from './KeyPicker';
import { OptionPicker } from './OptionPicker';
import { ModelPicker } from './ModelPicker';
import { CompareModelPicker } from './CompareModelPicker';
import { VectorStorePicker } from './VectorStorePicker';
import type { ChatConfig, ChatTraits, Persona, ReasoningEffort } from '../types';

const REASONING_EFFORT_OPTIONS: { id: ReasoningEffort; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

export interface SettingsPanelProps {
  configError: string | null;
  personaId: string;
  personas: Persona[];
  personasLoading: boolean;
  personasError: string | null;
  onPersonaChange: (id: string, persona: Persona | undefined) => void;
  toneId: string;
  onToneChange: (id: string) => void;
  traits: ChatTraits;
  traitsLoading: boolean;
  focusId: string;
  onFocusChange: (id: string) => void;
  customSystemPrompt: string;
  onCustomSystemPromptChange: (prompt: string) => void;
  keyVal: { alias: string; token: string };
  onKeyChange: (keyVal: { alias: string; token: string }) => void;
  onDeleteKey: () => void;
  compareMode: boolean;
  onCompareModeChange: (mode: boolean) => void;
  compareModelsSel: string[];
  onCompareModelsChange: (models: string[]) => void;
  model: string;
  onModelChange: (model: string) => void;
  config: ChatConfig;
  vectorStoreIds: string[];
  onVectorStoreIdsChange: (ids: string[]) => void;
  webSearch: boolean;
  onWebSearchChange: (enabled: boolean) => void;
  verbosityId: string;
  onVerbosityChange: (id: string) => void;
  reasoningEffort: ReasoningEffort | '';
  onReasoningEffortChange: (effort: ReasoningEffort | '') => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  configError,
  personaId,
  personas,
  personasLoading,
  personasError,
  onPersonaChange,
  toneId,
  onToneChange,
  traits,
  traitsLoading,
  focusId,
  onFocusChange,
  customSystemPrompt,
  onCustomSystemPromptChange,
  keyVal,
  onKeyChange,
  onDeleteKey,
  compareMode,
  onCompareModeChange,
  compareModelsSel,
  onCompareModelsChange,
  model,
  onModelChange,
  config,
  vectorStoreIds,
  onVectorStoreIdsChange,
  webSearch,
  onWebSearchChange,
  verbosityId,
  onVerbosityChange,
  reasoningEffort,
  onReasoningEffortChange,
}) => {
  return (
    <>
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
          description="How formal or casual the assistant's replies sound"
        />
        <OptionPicker
          label="Focus"
          value={focusId}
          options={traits.focuses}
          onChange={onFocusChange}
          loading={traitsLoading}
          description="What the assistant should prioritize or emphasize in answers"
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
      <KeyPicker
        value={keyVal}
        onChange={onKeyChange}
        onDelete={onDeleteKey}
      />
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={compareMode}
            onChange={e => onCompareModeChange(e.target.checked)}
          />
        }
        label={
          <Typography variant="body2">Compare models side-by-side</Typography>
        }
      />
      {compareMode ? (
        <CompareModelPicker value={compareModelsSel} onChange={onCompareModelsChange} />
      ) : (
        <ModelPicker value={model} onChange={onModelChange} defaultModel={config.defaultModel} />
      )}
      <Accordion
        disableGutters
        variant="outlined"
        sx={{ '&:before': { display: 'none' } }}
      >
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
              description="How long and detailed the assistant's replies are"
            />
            <OptionPicker
              label="Reasoning effort"
              value={reasoningEffort}
              options={REASONING_EFFORT_OPTIONS}
              onChange={id => onReasoningEffortChange(id as ReasoningEffort | '')}
              noneLabel="Model default"
            />
          </Box>
        </AccordionDetails>
      </Accordion>
    </>
  );
};
