import React, { useEffect, useState } from 'react';
import { Autocomplete, Box, Checkbox, Chip, TextField, Typography } from '@mui/material';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { useApi } from '@backstage/core-plugin-api';
import { liteLlmChatApiRef } from '../api';
import type { VectorStore } from '../types';

export interface VectorStorePickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  defaultVectorStoreIds?: string[] | null;
}

export const VectorStorePicker: React.FC<VectorStorePickerProps> = ({
  value,
  onChange,
  defaultVectorStoreIds,
}) => {
  const chatApi = useApi(liteLlmChatApiRef);
  const [stores, setStores] = useState<VectorStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    chatApi
      .listVectorStores()
      .then(s => {
        if (!alive) return;
        setStores(s);
        if (value.length === 0 && s.length && defaultVectorStoreIds?.length) {
          const defaults = defaultVectorStoreIds.filter(id =>
            s.some(x => x.id === id),
          );
          if (defaults.length) onChange(defaults);
        }
      })
      .catch(err => {
        if (alive) setError(err.message ?? 'Failed to load knowledge bases');
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = stores.filter(s => value.includes(s.id));

  return (
    <Box>
      <Autocomplete
        multiple
        size="small"
        options={stores}
        value={selected}
        loading={loading}
        disableCloseOnSelect
        getOptionLabel={s => s.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onChange={(_e, newValue) => onChange(newValue.map(s => s.id))}
        renderOption={(props, option, { selected: isSelected }) => (
          <li {...props} key={option.id}>
            <Checkbox
              icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
              checkedIcon={<CheckBoxIcon fontSize="small" />}
              checked={isSelected}
              size="small"
              sx={{ mr: 1, p: 0 }}
            />
            {option.name} {option.file_count != null ? `(${option.file_count})` : ''}
          </li>
        )}
        renderTags={(tagValue, getTagProps) =>
          tagValue.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
              key={option.id}
              size="small"
              label={option.name}
            />
          ))
        }
        renderInput={params => (
          <TextField
            {...params}
            label="Knowledge bases"
            placeholder={value.length ? undefined : 'None (no grounding)'}
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
