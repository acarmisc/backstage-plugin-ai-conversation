import React from 'react';
import { Select, MenuItem, FormControl, InputLabel, Typography } from '@mui/material';
import type { Persona } from '../types';

export interface PersonaPickerProps {
  value: string;
  personas: Persona[];
  loading: boolean;
  error: string | null;
  /** Fires with the full Persona (or undefined for "None") so the parent
   * can prefill model/knowledge-base pickers from its defaults. */
  onChange: (personaId: string, persona: Persona | undefined) => void;
}

export const PersonaPicker: React.FC<PersonaPickerProps> = ({
  value,
  personas,
  loading,
  error,
  onChange,
}) => {
  return (
    <FormControl size="small" error={!!error} sx={{ minWidth: 200 }}>
      <InputLabel shrink>Persona</InputLabel>
      <Select
        value={value}
        label="Persona"
        displayEmpty
        onChange={e => {
          const id = e.target.value as string;
          onChange(id, personas.find(p => p.id === id));
        }}
        disabled={loading}
      >
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
        {personas.map(p => (
          <MenuItem key={p.id} value={p.id}>
            {p.title}
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
