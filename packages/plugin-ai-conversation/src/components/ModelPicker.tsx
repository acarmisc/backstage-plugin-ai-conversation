import React, { useEffect, useState } from 'react';
import { Select, MenuItem, FormControl, InputLabel, Typography } from '@mui/material';
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

  // Separate from the fetch above: `defaultModel` (sourced from the backend's
  // /config, itself from litellm.aiConversation.defaultModel in app-config)
  // typically resolves after this component mounts. Selecting here — keyed
  // on both `models` and `defaultModel` — means a late-arriving app-config
  // default still wins, instead of being silently dropped by a mount-only
  // effect that already picked models[0].
  useEffect(() => {
    if (value || models.length === 0) return;
    const def =
      (defaultModel && models.find(x => x.model_name === defaultModel)?.model_name) ||
      models[0].model_name;
    onChange(def);
  }, [value, models, defaultModel, onChange]);

  return (
    <FormControl size="small" error={!!error} sx={{ minWidth: 200 }}>
      <InputLabel>Model</InputLabel>
      <Select
        value={value}
        label="Model"
        onChange={e => onChange(e.target.value as string)}
        disabled={loading}
      >
        {models.map(m => (
          <MenuItem key={m.model_name} value={m.model_name}>
            {m.model_name}
          </MenuItem>
        ))}
      </Select>
      {error && (
        <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
          {error}
        </Typography>
      )}
    </FormControl>
  );
};