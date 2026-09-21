import React, { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Box, Checkbox, Chip, TextField, Typography } from '@mui/material';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { useApi } from '@backstage/core-plugin-api';
import { aiConversationApiRef } from '../api';
import type { VectorStore } from '../types';

export interface VectorStorePickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  defaultVectorStoreIds?: string[] | null;
  /** Extra ids to surface as selected-but-unknown chips — the currently
   * selected team's attached stores (TeamInfo.object_permission
   * .vector_stores). They may not appear in the plugin's own store listing
   * (that route is a different upstream call), so they're merged in as
   * name-less options rather than silently dropped from the selection. */
  extraStores?: string[] | null;
}

export const VectorStorePicker: React.FC<VectorStorePickerProps> = ({
  value,
  onChange,
  defaultVectorStoreIds,
  extraStores,
}) => {
  const chatApi = useApi(aiConversationApiRef);
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

  // Merge in team stores the global listing doesn't know about, so selecting
  // a team's KBs doesn't render an empty picker. Options are id-keyed; an id
  // present in both keeps the real name.
  const options = useMemo(() => {
    const known = new Set(stores.map(s => s.id));
    const extras: VectorStore[] = (extraStores ?? [])
      .filter(id => !known.has(id))
      .map(id => ({ id, name: id }));
    return [...stores, ...extras];
  }, [stores, extraStores]);

  const selectedOptions = options.filter(s => value.includes(s.id));

  return (
    <Box>
      <Autocomplete
        multiple
        size="small"
        options={options}
        value={selectedOptions}
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
