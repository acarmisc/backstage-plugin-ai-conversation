import React, { useEffect, useState } from 'react';
import { Autocomplete, TextField, Typography, Box } from '@mui/material';
import { useApi } from '@backstage/core-plugin-api';
import { liteLlmApiRef } from '@acarmisc/backstage-plugin-litellm';
import type { ModelInfo } from '@acarmisc/backstage-plugin-litellm';
import { filterModels, filterModelsByTeam } from './modelFilter';

export interface ModelPickerProps {
  value: string;
  onChange: (model: string) => void;
  defaultModel?: string | null;
  /** Operator-configured ids/prefixes to hide — see modelFilter.ts. */
  excludedModels?: string[] | null;
  /** The selected team's `models` allowlist (see govai's TeamInfo). The
   * catalogue is already global — this only narrows what the picker offers
   * to what the team can actually call, so a user can't pick a model the
   * proxy will reject. Undefined/empty means unrestricted. */
  teamModels?: string[] | null;
}

export const ModelPicker: React.FC<ModelPickerProps> = ({
  value,
  onChange,
  defaultModel,
  excludedModels,
  teamModels,
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

  // Team-scoped view of the catalogue. Kept separate from the state above so
  // changing the team doesn't refetch (the catalogue is global; only the
  // visible subset changes).
  const visible = filterModelsByTeam(models, teamModels);

  // The picked model must stay inside the team's allowlist. Switching teams
  // can strand the previous pick (e.g. user had a model the new team can't
  // call), so clear it — the effect below then selects a valid default.
  // Only enforced once the catalogue has loaded, so a value restored from a
  // thread isn't wiped before `models` is populated.
  useEffect(() => {
    if (loading || !value || models.length === 0) return;
    if (!visible.some(m => m.model_name === value)) onChange('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, loading, models.length]);

  useEffect(() => {
    if (value || visible.length === 0) return;
    const def =
      (defaultModel && visible.find(x => x.model_name === defaultModel)?.model_name) ||
      visible[0].model_name;
    onChange(def);
  }, [value, visible, defaultModel, onChange]);

  return (
    <Box>
      <Autocomplete
        freeSolo
        size="small"
        options={visible}
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
      {!error && !loading && visible.length === 0 && models.length > 0 && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
          No model in the catalogue is available to this team.
        </Typography>
      )}
    </Box>
  );
};
