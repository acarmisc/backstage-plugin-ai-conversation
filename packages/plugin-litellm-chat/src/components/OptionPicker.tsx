import React from 'react';
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';

export interface OptionPickerOption {
  id: string;
  label: string;
}

export interface OptionPickerProps {
  label: string;
  value: string;
  options: OptionPickerOption[];
  onChange: (id: string) => void;
  loading?: boolean;
  /** Label for the empty/unset choice. Defaults to "Default". */
  noneLabel?: string;
}

/**
 * Generic small Select for a single trait pick (tone/focus/verbosity/
 * reasoning effort) — same shape as PersonaPicker/ModelPicker, factored out
 * because those four pickers are otherwise identical apart from their
 * option list.
 */
export const OptionPicker: React.FC<OptionPickerProps> = ({
  label,
  value,
  options,
  onChange,
  loading,
  noneLabel = 'Default',
}) => {
  return (
    <FormControl size="small" sx={{ minWidth: 160 }}>
      <InputLabel shrink>{label}</InputLabel>
      <Select
        value={value}
        label={label}
        displayEmpty
        onChange={e => onChange(e.target.value as string)}
        disabled={loading}
      >
        <MenuItem value="">
          <em>{noneLabel}</em>
        </MenuItem>
        {options.map(o => (
          <MenuItem key={o.id} value={o.id}>
            {o.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
