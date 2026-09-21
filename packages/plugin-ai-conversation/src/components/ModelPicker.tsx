import React, { useEffect, useState } from 'react';
import { Autocomplete, TextField, Typography, Box } from '@mui/material';
import { useApi } from '@backstage/core-plugin-api';
import { liteLlmApiRef } from '@acarmisc/backstage-plugin-litellm';
import type { ModelInfo } from '@acarmisc/backstage-plugin-litellm';
import { filterModels } from './modelFilter';

export interface ModelPickerProps {
  value: string;
  onChange: (model: string) => void;
  defaultModel?: string | null;
  /** Operator-configured ids/prefixes to hide — see modelFilter.ts. */
  excludedModels?: string[] | null;
}

export const ModelPicker: React.FC<ModelPickerProps> = ({
  value,
  onChange,
  defaultModel,
  excludedModels,
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
        if (alive) setModels(filterModels(all, m => m.model_name, excludedModels));
      })
      .catch(err => {
        if (alive) setError(err.message ?? 'Failed to load models');
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [liteLlmApi, excludedModels]);

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