import React from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import type { Skill } from '../types';

export interface SkillPickerProps {
  value: string;
  skills: Skill[];
  onChange: (id: string) => void;
}

/**
 * Optional chat-skill selector. A skill is a catalog-authored (or bundled)
 * system-prompt preset — see the backend's `/skills`. The prompt text
 * itself never reaches the browser; picking one only sends `skill_id` with
 * the turn. Selecting a skill also prefills the model / knowledge bases it
 * declares as defaults (handled by the caller).
 *
 * Renders nothing but a disabled hint when no skills are configured, so the
 * setting doesn't look broken in an install that hasn't set any up.
 */
export const SkillPicker: React.FC<SkillPickerProps> = ({ value, skills, onChange }) => {
  const selected = skills.find(s => s.id === value);
  return (
    <FormControl size="small" fullWidth disabled={skills.length === 0}>
      <InputLabel shrink>Skill</InputLabel>
      <Select
        value={skills.some(s => s.id === value) ? value : ''}
        label="Skill"
        displayEmpty
        onChange={e => onChange(e.target.value as string)}
        renderValue={() =>
          selected ? (
            selected.title
          ) : (
            <Typography component="span" variant="body2" color="text.secondary">
              {skills.length === 0 ? 'No skills configured' : 'None'}
            </Typography>
          )
        }
      >
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
        {skills.map(s => (
          <MenuItem key={s.id} value={s.id} sx={{ display: 'block', py: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {s.title}
              </Typography>
              {s.tags?.slice(0, 3).map(t => (
                <Chip key={t} label={t} size="small" variant="outlined" sx={{ height: 18 }} />
              ))}
            </Box>
            {s.description && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', whiteSpace: 'normal' }}
              >
                {s.description}
              </Typography>
            )}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
