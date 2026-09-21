import React from 'react';
import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import type { ChatTeamInfo } from '../types';


export interface TeamPickerProps {
  value: string;
  onChange: (teamId: string) => void;
  teams: ChatTeamInfo[];
  loading?: boolean;
  error?: string | null;
  /** When true a team must be selected before a chat key can be minted —
   * mirrors govai's `litellm.keyGeneration.teamRequired` (default true).
   * A required picker with no teams to choose from renders an explicit
   * warning instead of an unusable empty dropdown. */
  required?: boolean;
}

/**
 * Team selector for the settings panel. Mirrors govai's `KeyFormDialog`
 * team field: the chat key is minted with this team's id, so budget, rate
 * limits and model access are inherited from the team rather than the
 * individual user (LiteLLM resolves the ACL from `team_id` at query time).
 *
 * The team list comes from govai's `/api/litellm/teams`, which already
 * scopes to the teams the caller is a member of — no extra backend route.
 */
export const TeamPicker: React.FC<TeamPickerProps> = ({
  value,
  onChange,
  teams,
  loading,
  error,
  required,
}) => {
  const selected = teams.find(t => t.team_id === value) ?? null;

  if (teams.length === 0 && !loading) {
    if (required) {
      return (
        <Typography variant="body2" color="error">
          A team is required, but you don't belong to any team yet — contact
          your administrator.
        </Typography>
      );
    }
    return null;
  }

  return (
    <Box>
      <Autocomplete
        size="small"
        options={teams}
        loading={loading}
        getOptionLabel={t => t.team_alias || t.team_id}
        isOptionEqualToValue={(a, b) => a.team_id === b.team_id}
        value={selected}
        onChange={(_e, team) => onChange(team?.team_id ?? '')}
        renderInput={params => (
          <TextField
            {...params}
            label="Team"
            required={required}
            error={!!error || (required && !value)}
            helperText={
              error ?? (required ? 'Budget and model access come from this team' : undefined)
            }
            fullWidth
          />
        )}
      />
    </Box>
  );
};
