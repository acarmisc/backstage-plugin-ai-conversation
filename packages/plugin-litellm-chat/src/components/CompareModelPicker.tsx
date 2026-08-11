import React, { useEffect, useState } from 'react';
import { Autocomplete, Box, Checkbox, Chip, TextField, Typography } from '@mui/material';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { useApi } from '@backstage/core-plugin-api';
import { liteLlmApiRef } from '@acarmisc/backstage-plugin-litellm';
import type { ModelInfo } from '@acarmisc/backstage-plugin-litellm';

export interface CompareModelPickerProps {
  value: string[];
  onChange: (models: string[]) => void;
}

export const CompareModelPicker: React.FC<CompareModelPickerProps> = ({ value, onChange }) => {
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
        // Same claude-* exclusion as ModelPicker — see its comment.
        setModels(all.filter(x => !x.model_name.startsWith('claude')));
      })
      .catch(err => {
        if (alive) setError(err.message ?? 'Failed to load models');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [liteLlmApi]);

  return (
    <Box>
      <Autocomplete
        multiple
        size="small"
        options={models}
        value={models.filter(m => value.includes(m.model_name))}
        loading={loading}
        disableCloseOnSelect
        getOptionLabel={m => m.model_name}
        isOptionEqualToValue={(a, b) => a.model_name === b.model_name}
        onChange={(_e, newValue) => onChange(newValue.map(m => m.model_name))}
        renderOption={(props, option, { selected: isSelected }) => (
          <li {...props} key={option.model_name}>
            <Checkbox
              icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
              checkedIcon={<CheckBoxIcon fontSize="small" />}
              checked={isSelected}
              size="small"
              sx={{ mr: 1, p: 0 }}
            />
            {option.model_name}
          </li>
        )}
        renderTags={(tagValue, getTagProps) =>
          tagValue.map((option, index) => (
            <Chip {...getTagProps({ index })} key={option.model_name} size="small" label={option.model_name} />
          ))
        }
        renderInput={params => (
          <TextField
            {...params}
            label="Compare models"
            placeholder={value.length ? undefined : 'Pick 2+ models…'}
            error={!!error}
          />
        )}
        sx={{ minWidth: 200 }}
      />
      {error && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
};
