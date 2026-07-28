import React, { useEffect, useState } from 'react';
import { Select, MenuItem, FormControl, InputLabel, Typography } from '@mui/material';
import { useApi } from '@backstage/core-plugin-api';
import { liteLlmChatApiRef } from '../api';
import type { Persona } from '../types';

export interface PersonaPickerProps {
  value: string;
  /** Fires with the full Persona (or undefined for "None") so the parent
   * can prefill model/knowledge-base pickers from its defaults. */
  onChange: (personaId: string, persona: Persona | undefined) => void;
}

export const PersonaPicker: React.FC<PersonaPickerProps> = ({ value, onChange }) => {
  const chatApi = useApi(liteLlmChatApiRef);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    chatApi
      .listPersonas()
      .then(p => {
        if (alive) setPersonas(p);
      })
      .catch(err => {
        if (alive) setError(err.message ?? 'Failed to load personas');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [chatApi]);

  return (
    <FormControl size="small" error={!!error} sx={{ minWidth: 200 }}>
      <InputLabel>Persona</InputLabel>
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
