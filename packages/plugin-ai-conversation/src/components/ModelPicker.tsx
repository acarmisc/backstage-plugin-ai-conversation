import React, { useEffect, useState } from 'react';
import { Autocomplete, TextField, Typography, Box } from '@mui/material';
import { useApi } from '@backstage/core-plugin-api';
import { liteLlmApiRef } from '@acarmisc/backstage-plugin-litellm';
import type { ModelInfo } from '@acarmisc/backstage-plugin-litellm';

export interface ModelPickerProps {
  value: string;
  onChange: (model: string) => void;
  defaultModel?: string | null;
}

export const ModelPicker: React.FC<ModelPickerProps> = ({
  value,
  onChange,
  defaultModel,
}) => {
  const liteLlmApi = useApi(liteLlmApiRef);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    liteLlmApi
      .listModels()
      .then(all => {
        if (!alive) return;
        // Filter out Anthropic/claude-* models: they require a per-user
        // Anthropic Max OAuth token that Claude Code injects client-side.
        // Backstage only forwards a LiteLLM virtual key, so the gateway has
        // no Anthropic credential and every claude-* call 401s. Hide them
        // rather than offer a model that always fails.
        const m = all.filter(x => !x.model_name.startsWith('claude'));
        setModels(m);
      })
      .catch(err => {
        if (alive) setError(err.message ?? 'Failed to load models');
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [liteLlmApi]);

  useEffect(() => {
    if (value || models.length === 0) return;
    const def =
      (defaultModel && models.find(x => x.model_name === defaultModel)?.model_name) ||
      models[0].model_name;
    onChange(def);
  }, [value, models, defaultModel, onChange]);

  return (
    <Box>
      <Autocomplete
        freeSolo
        size="small"
        options={models}
        getOptionLabel={(option) => {
          if (typeof option === 'string') return option;
          return option.model_name;
        }}
        value={value}
        inputValue={value}
        loading={loading}
        onChange={(_e, model) => {
          if (typeof model === 'string') {
            onChange(model);
          } else if (model && 'model_name' in model) {
            onChange(model.model_name);
          }
        }}
        onInputChange={(_e, inputValue) => {
          onChange(inputValue);
        }}
        renderInput={params => (
          <TextField
            {...params}
            label="Model"
            error={!!error}
            fullWidth
          />
        )}
      />
      {error && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
};